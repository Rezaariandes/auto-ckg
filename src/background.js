// background.js - CKG Auto KlikPro v1.0
// Service Worker MV3: queue manager, message router, orchestrator utama

import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from './engine/recovery.js';
import { runQueue } from './engine/scheduler.js';
import { MetadataRegistry } from './engine/metadata_registry.js';

// ── Floating Overlay (inject ke halaman aktif) ─────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  // Buka popup.html sebagai tab penuh — bisa resize, tidak terbatas 600px
  const existingTabs = await chrome.tabs.query({
    url: chrome.runtime.getURL('popup.html') + '*'
  });
  if (existingTabs.length) {
    // Sudah terbuka — fokus saja
    await chrome.tabs.update(existingTabs[0].id, { active: true });
    await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html'), active: true });
});

// ── Auto re-inject overlay saat halaman navigasi ──────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || !tab.url.startsWith('https://sehatindonesiaku.kemkes.go.id')) return;

  // Auto-aktifkan overlay saat user masuk ke halaman target (tanpa perlu klik icon)
  await chrome.storage.local.set({ ckg_overlay_active: true });

  await injectOverlay(tabId);
});

async function injectOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/lib/xlsx.min.js'],
    }).catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/ui/popup_overlay.js'],
    });
  } catch (err) {
    console.warn('[CKG] Gagal inject overlay:', err.message);
  }
}

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  running: false,
  paused: false,
  stopped: false,
  workflow: null,
  queue: [],
  currentIndex: 0,
  settings: null,
  activeTabId: null,
};

// ── Recorder state ──────────────────────────────────────

let _recording       = false;
let _recordingPaused = false;
let _recordBuffer    = [];   // Array of raw events from recorder.js
let _recorderTabId   = null;

// ── Picker state ────────────────────────────────────────────────────

let _pickerActive  = false;
let _pickerTabId   = null;

// ── Message Router ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {

    case 'ckg_start':
      handleStart(msg).then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'ckg_stop':
      state.stopped = true;
      state.running = false;
      state.paused = false;
      clearCheckpoint();
      broadcast({ action: 'ckg_log', level: 'warn', message: '[STOP] Run dihentikan' });
      sendResponse({ ok: true });
      return true;

    case 'ckg_pause':
      state.paused = !state.paused;
      broadcast({ action: 'ckg_log', level: 'info', message: state.paused ? '[PAUSE]' : '[RESUME]' });
      sendResponse({ ok: true, paused: state.paused });
      return true;

    case 'ckg_get_state':
      sendResponse({ ...state, queue: state.queue.length });
      return true;

    case 'ckg_step_result':
      handleStepResult(msg.result, sendResponse);
      return true;

    case 'ckg_get_run_log':
      getRunLog().then(logs => sendResponse({ ok: true, logs })).catch(() => sendResponse({ ok: false, logs: [] }));
      return true;

    case 'ckg_clear_run_log':
      chrome.storage.local.remove('ckg_run_log').then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;

    case 'ckg_overlay_closed':
      chrome.storage.local.set({ ckg_overlay_active: false });
      sendResponse({ ok: true });
      return true;

    case 'ckg_settings_updated':
      if (msg.settings) state.settings = msg.settings;
      sendResponse({ ok: true });
      return true;

    // ── Recorder ──

    case 'ckg_start_record':
      handleStartRecord(sendResponse);
      return true;

    case 'ckg_stop_record':
      handleStopRecord(sendResponse);
      return true;

    case 'ckg_undo_record':
      if (_recording && _recordBuffer.length > 0) _recordBuffer.pop();
      sendResponse({ ok: true, count: _recordBuffer.length });
      return true;

    case 'ckg_pause_record':
      _recordingPaused = !_recordingPaused;
      sendResponse({ ok: true, paused: _recordingPaused });
      return true;

    case 'ckg_record_event':
      if (_recording && !_recordingPaused && msg.event) _recordBuffer.push(msg.event);
      return false;

    // ── Element Picker ──

    case 'ckg_start_pick':
      handleStartPick(sendResponse);
      return true;

    case 'ckg_element_picked':
      // Forward dari element_picker.js ke options.html
      _pickerActive = false;
      broadcast({ action: 'ckg_element_picked', selector: msg.selector, tag: msg.tag, text: msg.text });
      sendResponse({ ok: true });
      return true;

    case 'ckg_pick_cancelled':
      _pickerActive = false;
      broadcast({ action: 'ckg_pick_cancelled' });
      return false;

    // ── Test Step ──

    case 'ckg_test_step':
      handleTestStep(msg.step, sendResponse);
      return true;

    default:
      return false;
  }
});

// ── Start Handler ──────────────────────────────────────────────────────────

async function handleStart(msg) {
  if (state.running) return { ok: false, error: 'Sudah berjalan' };

  const storeRes = await chrome.storage.local.get('ckg_settings');
  const settings = storeRes['ckg_settings'] || getDefaultSettings();

  const templateKeys = ['pendaftaran','konfirmasi','kuesioner','pemeriksaan','selesai']
    .map(w => 'ckg_' + 'template_' + w);
  const tplRes = await chrome.storage.local.get(templateKeys);
  const templates = {};
  templateKeys.forEach(key => {
    const wf = key.replace('ckg_template_', '');
    templates[wf] = tplRes[key] || null;
  });

  if (!templates.pendaftaran?.steps?.length) {
    return { ok: false, error: 'Template pendaftaran tidak ditemukan. Jalankan Phase 1 install dulu.' };
  }

  const checkpoint = await loadCheckpoint();
  let startIndex = 0;
  if (checkpoint && msg.resume) {
    startIndex = checkpoint.queueIndex;
    log('info', `[RESUME] Lanjut dari pasien index ${startIndex}`);
  }

  const tabs = await chrome.tabs.query({ url: 'https://sehatindonesiaku.kemkes.go.id/*' });
  let tabId;
  if (!tabs.length) {
    const targetUrl = templates.pendaftaran.meta?.targetUrl || 'https://sehatindonesiaku.kemkes.go.id';
    const tab = await chrome.tabs.create({ url: targetUrl, active: true });
    tabId = tab.id;
    await waitForTabLoad(tabId);
  } else {
    tabId = tabs[0].id;
  }

  await injectScripts(tabId);

  Object.assign(state, {
    running: true, paused: false, stopped: false,
    workflow: msg.workflow || 'all',
    queue: msg.data || [],
    currentIndex: startIndex,
    settings, templates,
    activeTabId: tabId,
  });

  runScheduler().catch(err => {
    log('error', `[FATAL] ${err.message}`);
    state.running = false;
  });

  return { ok: true };
}

async function runScheduler() {
  const summary = await runQueue(
    state.queue,
    state.templates,
    state.settings,
    {
      startIndex: state.currentIndex,
      tabId:      state.activeTabId,
      onProgress: (p) => broadcast({ action: 'ckg_progress', ...p }),
      onLog: (level, message) => log(level, message),
      checkStop:  () => state.stopped,
      checkPause: () => state.paused,
    }
  );

  state.running = false;
  await clearCheckpoint();

  log('info', `[DONE ALL] ✓ ${summary.ok} sukses, ✗ ${summary.fail} gagal`);
  broadcast({ action: 'ckg_done', summary });
}

// ── Utilities ──────────────────────────────────────────────────────────────

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

function log(level, message) {
  const safeLevel = (level === 'error' || level === 'warn') ? level : 'log';
  const safeMsg = (message !== undefined && message !== null) ? message : '(no message)';
  console[safeLevel]('[CKG BG]', safeMsg);
  broadcast({ action: 'ckg_log', level: safeLevel, message: safeMsg });
}

async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/lib/xlsx.min.js'],
    }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/engine/executor_inject.js'] });
  } catch (e) {
    console.warn('[CKG] injectScripts error:', e.message);
  }
}

// ── Recorder Handlers ──────────────────────────────────────────────────

const TARGET_URL = 'https://sehatindonesiaku.kemkes.go.id';

async function handleStartRecord(sendResponse) {
  try {
    // Cari tab target yang sudah terbuka (Q2: gunakan yang sudah ada)
    const existingTabs = await chrome.tabs.query({ url: TARGET_URL + '/*' });
    let tab;
    if (existingTabs.length > 0) {
      // Tab sudah ada → fokuskan
      tab = existingTabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      // Belum ada → buka baru dan tunggu load
      tab = await chrome.tabs.create({ url: TARGET_URL, active: true });
      await waitForTabLoad(tab.id);
      // Ambil data tab terbaru (url sudah final setelah redirect)
      tab = await chrome.tabs.get(tab.id);
    }

    _recording       = true;
    _recordingPaused = false;
    _recordBuffer    = [];
    _recorderTabId   = tab.id;
    await injectRecorder(tab.id);
    sendResponse({ ok: true, tabUrl: tab.url });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

async function handleStopRecord(sendResponse) {
  _recording       = false;
  _recordingPaused = false;
  const buffer     = [..._recordBuffer];
  _recordBuffer    = [];

  // Kirim pesan stop ke recorder.js di tab (matikan toolbar)
  if (_recorderTabId) {
    chrome.tabs.sendMessage(_recorderTabId, { action: 'ckg_stop_recorder' }).catch(() => {});
    _recorderTabId = null;
  }

  // Broadcast buffer ke semua halaman ekstensi (popup_builder.js / options.html)
  // Ini yang membuat preview + tombol Save muncul di Builder
  chrome.runtime.sendMessage({
    action: 'ckg_record_done',
    buffer,
  }).catch(() => {}); // ignore jika tidak ada listener (builder belum terbuka)

  sendResponse({ ok: true, buffer });
}


async function injectRecorder(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/recorder.js'],
    });
  } catch (e) {
    console.warn('[CKG] injectRecorder error:', e.message);
  }
}

// ── Element Picker Handlers ───────────────────────────────────────────

async function handleStartPick(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) { sendResponse({ ok: false, error: 'Tidak ada tab aktif' }); return; }
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      sendResponse({ ok: false, error: 'Tidak bisa pick di halaman Chrome internal' }); return;
    }
    _pickerActive = true;
    _pickerTabId  = tab.id;
    await injectPicker(tab.id);
    sendResponse({ ok: true, tabUrl: tab.url });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

async function injectPicker(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files:  ['src/element_picker.js'],
    });
  } catch (e) {
    console.warn('[CKG] injectPicker error:', e.message);
  }
}

// ── Test Step Handler ─────────────────────────────────────────────────

async function handleTestStep(step, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) { sendResponse({ ok: false, message: 'Tidak ada tab aktif' }); return; }
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      sendResponse({ ok: false, message: 'Tidak bisa uji di halaman Chrome internal' }); return;
    }
    // Inject content + executor jika belum ada
    await injectScripts(tab.id);
    // Jalankan step sekali
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'ckg_exec_step',
      step,
      pasienData: {},
      settings:   {},
    });
    sendResponse({ ok: true, result });
  } catch (e) {
    sendResponse({ ok: false, message: e.message });
  }
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 10000);
  });
}

async function appendRunLog(entry) {
  const key = 'ckg_run_log';
  const res = await chrome.storage.local.get(key);
  const logs = res[key] || [];
  logs.push({ ...entry, time: Date.now() });
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  await chrome.storage.local.set({ [key]: logs });
}

async function getRunLog() {
  const res = await chrome.storage.local.get('ckg_run_log');
  return res['ckg_run_log'] || [];
}

function getDefaultSettings() {
  return {
    retryMax: 3,
    retryDelayMs: 1500,
    stepDelayMs: 500,
    navigateTimeoutMs: 10000,
    elementTimeoutMs: 8000,
    activeWorkflows: {
      pendaftaran: true, konfirmasi: true,
      kuesioner: true, pemeriksaan: true, selesai: true
    }
  };
}

function handleStepResult(result, sendResponse) {
  sendResponse({ ok: true });
}

// ── Alarm keepalive ────────────────────────────────────────────────────────

chrome.alarms.create('ckg_keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'ckg_keepalive' && state.running) {
    chrome.storage.session.set({ ckg_sw_heartbeat: Date.now() });
  }
});

// ── Global Error Boundary ──────────────────────────────────────────────────

self.addEventListener('unhandledrejection', event => {
  const msg = event.reason?.message || String(event.reason);
  if (msg.includes('Could not establish connection') || msg.includes('No SW')) {
    event.preventDefault();
    return;
  }
  console.error('[CKG FATAL unhandledrejection]', msg);
  appendRunLog({ type: 'fatal', message: msg }).catch(() => {});
  broadcast({ action: 'ckg_log', level: 'error', message: `[FATAL] ${msg}` });
  if (state.running) {
    state.running = false;
    state.paused  = false;
    broadcast({
      action: 'ckg_done',
      summary: { ok: 0, fail: state.queue.length - state.currentIndex, aborted: true, error: msg }
    });
  }
  event.preventDefault();
});

self.addEventListener('error', event => {
  const msg = event.message || 'Unknown error';
  console.error('[CKG FATAL error]', msg, event.filename, event.lineno);
  appendRunLog({ type: 'fatal', message: `${msg} @ ${event.filename}:${event.lineno}` });
  broadcast({ action: 'ckg_log', level: 'error', message: `[FATAL] ${msg}` });
});

// ── Sync templates dari file JSON ke storage (selalu overwrite) ──────────────
// Dipanggil tiap SW wake + onInstalled — pastikan file JSON terbaru selalu aktif.

async function syncTemplates() {
  const WORKFLOWS = ['pendaftaran', 'konfirmasi', 'kuesioner', 'pemeriksaan', 'selesai'];
  for (const wf of WORKFLOWS) {
    const key = 'ckg_template_' + wf;
    try {
      const r    = await fetch(chrome.runtime.getURL(`templates/${wf}.json`));
      const data = await r.json();
      await chrome.storage.local.set({ [key]: data });
      console.log('[CKG] Template synced:', wf, data.steps?.length, 'steps');
    } catch (e) {
      console.warn('[CKG] Gagal sync template:', wf, e.message);
    }
  }
}

// ── v2: Schema Sync (load JSON schemas bundled with extension) ──────────────

async function syncSchemas() {
  const SCREEN_NAMES = [
    'perilaku_merokok', 'tb_dewasa', 'diabetes', 'hipertensi',
    'jantung', 'stroke', 'aktivitas_fisik', 'pola_makan',
  ];
  for (const screen of SCREEN_NAMES) {
    try {
      const r    = await fetch(chrome.runtime.getURL(`schemas/${screen}.json`));
      if (!r.ok) continue; // file belum ada — skip tanpa error
      const data = await r.json();
      // Only store if storage version is empty (don't overwrite live-extracted)
      const stored = await chrome.storage.local.get(`ckg_schema_${screen}`);
      if (!stored[`ckg_schema_${screen}`]) {
        await chrome.storage.local.set({ [`ckg_schema_${screen}`]: data });
        console.log('[CKG] Schema synced:', screen);
      }
    } catch (e) {
      console.warn('[CKG] Gagal sync schema:', screen, e.message);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  syncTemplates();
  syncSchemas();
});

console.log('[CKG AutoKlikPro Pro v2] Background service worker started v2.0 ✓');

// Sync tiap SW wake
syncTemplates().catch(e => console.warn('[CKG] syncTemplates error:', e.message));
syncSchemas().catch(e  => console.warn('[CKG] syncSchemas error:', e.message));


// ── v2: Schema Message Handlers ────────────────────────────────────────────

/**
 * Find the SATUSEHAT tab across ALL windows.
 * CRITICAL FIX: popup.html is opened as a tab, so querying
 * { active: true, currentWindow: true } returns the POPUP itself.
 * We must query ALL tabs across all windows for the SATUSEHAT URL.
 */
async function findSatusehatTab() {
  const tabs = await chrome.tabs.query({ url: 'https://sehatindonesiaku.kemkes.go.id/*' });
  if (tabs.length > 0) return tabs[0];

  // Fallback: search all tabs manually
  const allTabs = await chrome.tabs.query({});
  return allTabs.find(t => t.url && t.url.includes('sehatindonesiaku.kemkes.go.id')) || null;
}

/**
 * Metadata-First extractor: baca Survey Model dari React runtime state.
 * Dijalankan di MAIN world (properti React Fiber hanya terlihat di konteks
 * halaman). Dua langkah: (1) inject modul → define window.__ckgExtractReactMetadata,
 * (2) panggil fungsinya dan kembalikan hasil.
 * @param {number} tabId
 * @returns {Promise<{ok:boolean, schema?:Object, error?:string}>}
 */
async function extractReactMetadata(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world:  'MAIN',
      files:  ['src/engine/react_state_discovery.js'],
    });
  } catch (e) {
    return { ok: false, error: 'inject react_state_discovery gagal: ' + e.message };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world:  'MAIN',
      func: () => (typeof window.__ckgExtractReactMetadata === 'function'
        ? window.__ckgExtractReactMetadata()
        : { ok: false, error: '__ckgExtractReactMetadata tidak tersedia' }),
    });
    return results?.[0]?.result || { ok: false, error: 'hasil metadata null' };
  } catch (e) {
    return { ok: false, error: 'panggil metadata gagal: ' + e.message };
  }
}

// Extract schema from active SATUSEHAT tab — METADATA-FIRST, DOM sebagai fallback
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_extract_schema') return;

  (async () => {
    try {
      const tab = await findSatusehatTab();
      if (!tab) {
        sendResponse({ ok: false, error: 'Tidak ada tab SATUSEHAT terbuka.\nBuka halaman kuesioner SATUSEHAT terlebih dahulu, lalu coba lagi.' });
        return;
      }

      // ── PRIORITY 1: Metadata Form Builder dari React runtime state ──────────
      const meta = await extractReactMetadata(tab.id);
      if (meta?.ok && meta.schema?.questions?.length) {
        try { await MetadataRegistry.upsertMetadata(meta.schema); } catch (_) {}
        sendResponse({ ok: true, schema: meta.schema, source: 'react-state' });
        return;
      }

      // ── PRIORITY 2 (fallback): DOM scraping (perilaku lama) ─────────────────
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _contentExtractSchema,
      });

      let schema = results?.[0]?.result;

      // Enrich schema DOM dengan PPV/PPM dari metadata terakhir yang diketahui
      if (schema && schema.screen) {
        try {
          const lastMeta = await MetadataRegistry.getMetadata(schema.screen);
          if (lastMeta) schema = MetadataRegistry.mergeMetaIntoDom(schema, lastMeta);
        } catch (_) {}
      }

      if (schema && schema.questions && schema.questions.length > 0) {
        sendResponse({ ok: true, schema, source: schema._enrichedFromMeta ? 'dom+meta' : 'dom', metaError: meta?.error });
      } else if (schema) {
        sendResponse({
          ok: false,
          error: `Tidak ada pertanyaan ditemukan di halaman ini.\nURL: ${tab.url}\nTitle: ${tab.title}\n\nPastikan form kuesioner sudah terbuka sepenuhnya.`,
          schema, // kirim tetap, meski kosong
          metaError: meta?.error,
        });
      } else {
        sendResponse({ ok: false, error: 'Schema extraction gagal — hasil null', metaError: meta?.error });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep channel open
});

/**
 * _contentExtractSchema — diinjeksikan ke dalam halaman SATUSEHAT.
 *
 * Strategi multi-layer (fallback cascade):
 * 1. SurveyJS v1: .sv-question / .sv-row
 * 2. SurveyJS v2/SD: .sd-question / .sd-row
 * 3. Custom SATUSEHAT card: [class*="question"], [class*="Question"]
 * 4. Generic: elemen yang mengandung radio/checkbox/input di dalam card/panel
 * 5. Last resort: ambil semua input[type=radio] grouping by name
 */
function _contentExtractSchema() {

  // ── Utility: ekstrak teks label dari radio button ───────────────────────
  function extractRadioLabel(radioEl) {
    const strategies = [
      // SurveyJS v1 span
      () => radioEl.closest('label')?.querySelector('.sv-string-viewer')?.innerText?.trim(),
      // SurveyJS v2 span
      () => radioEl.closest('label')?.querySelector('.sd-string-viewer, .sd-item__control-label')?.innerText?.trim(),
      // Sibling span/div after input
      () => {
        const label = radioEl.closest('label');
        if (!label) return '';
        const spans = label.querySelectorAll('span');
        for (const s of spans) {
          const t = s.innerText?.trim();
          if (t && t.length > 0 && t.length < 200) return t;
        }
        return '';
      },
      // Parent label text (strip leading whitespace)
      () => {
        const label = radioEl.closest('label');
        if (!label) return '';
        const clone = label.cloneNode(true);
        clone.querySelectorAll('input').forEach(i => i.remove());
        return clone.innerText?.trim();
      },
      // Next sibling text
      () => {
        let sib = radioEl.nextSibling;
        while (sib) {
          const t = sib.textContent?.trim();
          if (t) return t;
          sib = sib.nextSibling;
        }
        return '';
      },
      // data-value or aria-label
      () => radioEl.getAttribute('aria-label') || radioEl.getAttribute('data-label') || '',
    ];

    for (const fn of strategies) {
      try {
        const t = fn();
        if (t && t.length > 0 && t.length < 300) return t;
      } catch (_) {}
    }
    return radioEl.value || '';
  }

  // ── Utility: ekstrak teks pertanyaan dari container ─────────────────────
  function extractQuestionTitle(el) {
    const selectors = [
      '.sv-string-viewer',
      '.sd-string-viewer',
      '.sv-question__title span',
      '.sd-question__title span',
      '.sv-title',
      '.sd-element__title span',
      '[class*="title"] span',
      '[class*="question-text"]',
      '[class*="questionTitle"]',
      'legend',
      'h3', 'h4',
    ];

    for (const sel of selectors) {
      try {
        const found = el.querySelector(sel);
        if (found) {
          const t = found.innerText?.trim();
          if (t && t.length > 1 && t.length < 500) return t;
        }
      } catch (_) {}
    }

    // Fallback: first substantial text node
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.trim();
      if (t && t.length > 3 && t.length < 500) return t;
    }
    return '';
  }

  // ── Utility: proses satu container question ─────────────────────────────
  function processQuestionEl(el) {
    const question = extractQuestionTitle(el);
    if (!question || question.length < 2) return null;

    const radioEls    = el.querySelectorAll('input[type="radio"]');
    const checkboxEls = el.querySelectorAll('input[type="checkbox"]');
    const textEl      = el.querySelector('input[type="text"], input[type="number"], input[type="date"], textarea, select');

    if (radioEls.length > 0) {
      const options = [];
      radioEls.forEach(r => {
        options.push({
          id:    r.id    || '',
          value: r.value || '',
          label: extractRadioLabel(r),
        });
      });
      return { question, type: 'radio', options };
    }

    if (checkboxEls.length > 0) {
      const options = [];
      checkboxEls.forEach(c => {
        options.push({
          id:    c.id    || '',
          value: c.value || '',
          label: extractRadioLabel(c),
        });
      });
      return { question, type: 'checkbox', options };
    }

    if (textEl) {
      const tag = textEl.tagName.toLowerCase();
      if (tag === 'select') {
        const options = Array.from(textEl.options).map(o => ({
          value: o.value, label: o.text,
        }));
        return { question, type: 'select', id: textEl.id || '', options };
      }
      return {
        question,
        type: textEl.type === 'number' ? 'number'
            : textEl.type === 'date'   ? 'date' : 'text',
        id:          textEl.id          || '',
        placeholder: textEl.placeholder || '',
      };
    }

    return { question, type: 'unknown' };
  }

  // ── Strategy 1-4: cari question container ──────────────────────────────
  const CONTAINER_SELECTORS = [
    // SurveyJS v1
    '.sv-question',
    '.sv-row .sv-question',
    // SurveyJS v2 (SD)
    '.sd-question',
    '.sd-row .sd-question',
    '.sd-element',
    // SATUSEHAT custom wrappers
    '[class*="question"]:not(body):not(html)',
    '[class*="Question"]:not(body):not(html)',
    '[class*="survey-question"]',
    '[class*="form-question"]',
    // Generic: card yang mengandung input
    '.card:has(input[type="radio"])',
    '.panel:has(input[type="radio"])',
    '.form-group:has(input)',
    // Bootstrap/Ant/custom
    '[role="radiogroup"]',
    'fieldset',
  ];

  const seen      = new Set();
  const questions = [];

  for (const sel of CONTAINER_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;

      els.forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const q = processQuestionEl(el);
        if (q && q.question) {
          // Deduplicate by question text
          if (!questions.find(x => x.question === q.question)) {
            questions.push(q);
          }
        }
      });

      if (questions.length > 0) break; // strategi ini berhasil
    } catch (_) {}
  }

  // ── Strategy 5 (last resort): group radio by name ──────────────────────
  if (questions.length === 0) {
    const allRadios = document.querySelectorAll('input[type="radio"]');
    const groups    = {};
    allRadios.forEach(r => {
      const name = r.name || r.getAttribute('name') || '_unnamed';
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });

    for (const [name, radios] of Object.entries(groups)) {
      // Cari label pertanyaan: elemen di atas group ini
      const firstRadio = radios[0];
      let questionEl = firstRadio.closest('fieldset, [role="radiogroup"], .form-group, .card, .panel, section, article');
      const questionText = questionEl ? extractQuestionTitle(questionEl) : name;

      const options = radios.map(r => ({
        id:    r.id    || '',
        value: r.value || '',
        label: extractRadioLabel(r),
      }));

      questions.push({ question: questionText || name, type: 'radio', options });
    }
  }

  // ── Detect screen name ──────────────────────────────────────────────────
  // Try multiple title sources
  const titleCandidates = [
    document.querySelector('.sv-header__title, .sd-header__title')?.innerText,
    document.querySelector('.survey-title, .form-title, [class*="survey-title"]')?.innerText,
    document.querySelector('h1')?.innerText,
    document.querySelector('h2')?.innerText,
    document.querySelector('.page-title, [class*="pageTitle"]')?.innerText,
    document.title,
  ];
  const pageTitle = titleCandidates.find(t => t && t.trim().length > 0)?.trim() || '';

  // Auto-generate screen name: lowercase snake_case dari judul
  function titleToScreenName(t) {
    // Known mappings
    const KNOWN = [
      [/merokok|rokok/i,              'perilaku_merokok'],
      [/tuberkulosis|tbc?\b/i,        'tb_dewasa'],
      [/diabetes|kencing manis/i,     'diabetes'],
      [/hipertensi|darah tinggi/i,    'hipertensi'],
      [/jantung/i,                    'jantung'],
      [/stroke/i,                     'stroke'],
      [/aktivitas.?fisik/i,           'aktivitas_fisik'],
      [/pola.?makan/i,                'pola_makan'],
      [/demografi.+perempuan/i,       'demografi_dewasa_perempuan'],
      [/demografi.+laki/i,            'demografi_dewasa_laki'],
      [/demografi.+wanita/i,          'demografi_dewasa_perempuan'],
      [/demografi/i,                  'demografi'],
      [/riwayat.+penyakit/i,          'riwayat_penyakit'],
      [/identitas|biodata|profil/i,   'identitas_pasien'],
      [/pemeriksaan|fisik/i,          'pemeriksaan_fisik'],
      [/gaya.?hidup/i,                'gaya_hidup'],
      [/nutrisi|gizi/i,               'nutrisi'],
      [/mental|jiwa|psikologi/i,      'kesehatan_mental'],
      [/imunisasi|vaksin/i,           'imunisasi'],
      [/kehamilan|hamil/i,            'kehamilan'],
      [/balita|anak/i,                'kesehatan_anak'],
      [/lansia|geriatri/i,            'kesehatan_lansia'],
    ];

    for (const [pattern, name] of KNOWN) {
      if (pattern.test(t)) return name;
    }

    // Fallback: auto snake_case dari title
    return t
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40)
      || 'unknown_screen';
  }

  const screen = titleToScreenName(pageTitle);

  // ── Fingerprint ─────────────────────────────────────────────────────────
  const fpSource = questions.map(q => q.question).join('|').slice(0, 300);
  let fingerprint = 'fp_' + fpSource.length + '_' + questions.length;
  try {
    fingerprint = btoa(unescape(encodeURIComponent(fpSource)))
      .replace(/[+/=]/g, '')
      .slice(0, 20);
  } catch (_) {}

  return {
    screen,
    title: pageTitle,
    version: 1,
    generatedAt: new Date().toISOString(),
    fingerprint,
    questions,
    _sourceUrl: location.href,
    _questionCount: questions.length,
    _strategy: questions.length > 0 ? 'multi-strategy' : 'empty',
  };
}


// Save schema to chrome.storage.local
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_save_schema') return;
  (async () => {
    try {
      const schema = msg.schema;
      if (!schema?.screen) { sendResponse({ ok: false, error: 'Schema tidak valid' }); return; }
      await chrome.storage.local.set({ [`ckg_schema_${schema.screen}`]: schema });
      // Notify all open popup tabs
      broadcast({ action: 'ckg_schema_extracted', screen: schema.screen });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});

// Get all stored schemas
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_get_schemas') return;
  (async () => {
    try {
      const all = await chrome.storage.local.get(null);
      const schemas = Object.entries(all)
        .filter(([k]) => k.startsWith('ckg_schema_'))
        .map(([, v]) => v);
      sendResponse({ ok: true, schemas });
    } catch (e) {
      sendResponse({ ok: false, schemas: [], error: e.message });
    }
  })();
  return true;
});

// Compare schema: live DOM vs stored
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_compare_schema') return;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.includes('sehatindonesiaku.kemkes.go.id')) {
        sendResponse({ ok: false, error: 'Tidak ada tab SATUSEHAT aktif' });
        return;
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: _contentExtractSchema,
      });
      const live = results?.[0]?.result;
      if (!live?.screen) { sendResponse({ ok: false, error: 'Gagal extract live schema' }); return; }

      const stored = await chrome.storage.local.get(`ckg_schema_${live.screen}`);
      const base   = stored[`ckg_schema_${live.screen}`];
      if (!base) {
        sendResponse({ ok: true, diff: { severity: 'none' }, report: `ℹ️ Belum ada schema tersimpan untuk "${live.screen}" — ini adalah schema baru.` });
        return;
      }

      // Compare questions
      const baseQ   = (base.questions || []).map(q => q.question);
      const liveQ   = (live.questions || []).map(q => q.question);
      const added   = liveQ.filter(q => !baseQ.includes(q));
      const removed = baseQ.filter(q => !liveQ.includes(q));

      let severity = 'none';
      if (removed.length > 0) severity = 'critical';
      else if (added.length > 0) severity = 'warning';

      const report = [
        `🔍 Schema Compare: ${live.screen}`,
        `Stored FP: ${base.fingerprint || '?'}`,
        `Live FP:   ${live.fingerprint}`,
        ``,
        `Added (${added.length}): ${added.join(', ') || '—'}`,
        `Removed (${removed.length}): ${removed.join(', ') || '—'}`,
        ``,
        `Severity: ${severity.toUpperCase()}`,
      ].join('\n');

      sendResponse({ ok: true, diff: { severity, added, removed }, report });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true;
});

// Get unknown questions log
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_get_unknown') return;
  chrome.storage.local.get('ckg_unknown_questions', res => {
    sendResponse({ ok: true, items: res['ckg_unknown_questions'] || [] });
  });
  return true;
});

// Get audit log
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_get_audit_log') return;
  chrome.storage.local.get('ckg_audit_log', res => {
    sendResponse({ ok: true, logs: res['ckg_audit_log'] || [] });
  });
  return true;
});

// Clear audit log
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_clear_audit_log') return;
  chrome.storage.local.set({ ckg_audit_log: [] }, () => {
    sendResponse({ ok: true });
  });
  return true;
});

// Export audit log as CSV
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ckg_export_audit_csv') return;
  chrome.storage.local.get('ckg_audit_log', res => {
    const logs = res['ckg_audit_log'] || [];
    if (!logs.length) { sendResponse({ ok: false }); return; }

    const HEADERS = ['Timestamp','Screen','NIK Pasien','Pertanyaan','Jawaban','PPV','Status'];
    const rows    = logs.map(e => [
      e.timestamp || '',
      e.screen    || '',
      e.pasienNIK || '',
      e.question  || '',
      e.answer    || '',
      e.ppv       || '',
      e.success ? 'Berhasil' : 'Gagal',
    ]);

    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv    = [HEADERS, ...rows].map(r => r.map(escape).join(',')).join('\n');
    sendResponse({ ok: true, csv, count: logs.length });
  });
  return true;
});
