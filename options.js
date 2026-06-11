/**
 * CKG Auto KlikPro — options.js
 * Template Builder: drag-drop step list, CRUD steps, import/export JSON
 * Phase 6 — Dynamic Workflow Management
 */

import { storage } from './src/lib/storage.js';

// ── Built-in workflows (cannot be deleted) ───────────────────────────────────

const BUILTIN_WORKFLOWS = ['pendaftaran', 'konfirmasi', 'kuesioner', 'pemeriksaan', 'selesai'];

const BUILTIN_DISPLAY = {
  pendaftaran: 'Pendaftaran',
  konfirmasi:  'Konfirmasi',
  kuesioner:   'Kuesioner',
  pemeriksaan: 'Pemeriksaan',
  selesai:     'Selesai',
};

// SVG icons for built-in workflows
const BUILTIN_ICONS = {
  pendaftaran: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  konfirmasi:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  kuesioner:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  pemeriksaan: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  selesai:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const CUSTOM_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15" x2="12" y2="15"/></svg>`;

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  click: {
    valueLabel: 'Teks Tombol (opsional)',
    valueHelp: '💡 Isi jika ingin mencocokkan tombol berdasarkan teksnya. Contoh: "Daftar", "Simpan".',
    selectorHelp: '💡 Kode penanda tombol/link yang akan diklik. Contoh: #btn-daftar',
    showValue: true, showSelector: true, showExcel: false,
    valuePlaceholder: 'Contoh: Daftar, Simpan, Lanjut (boleh kosong)',
  },
  click_button: {
    valueLabel: 'Teks Tombol',
    valueHelp: '💡 Teks yang terlihat di tombol. Plugin akan cari tombol berdasarkan teks ini.',
    selectorHelp: '',
    showValue: true, showSelector: false, showExcel: false,
    valuePlaceholder: 'Contoh: Simpan, Daftar, Lanjut, Kirim',
  },
  wait_button: {
    valueLabel: 'Teks Tombol yang Ditunggu',
    valueHelp: '💡 Plugin akan tunggu sampai tombol dengan teks ini muncul di halaman.',
    selectorHelp: '',
    showValue: true, showSelector: false, showExcel: false,
    valuePlaceholder: 'Contoh: Konfirmasi, Loading selesai, Lanjut',
  },
  type: {
    valueLabel: 'Teks yang Diketik (jika tidak dari Excel)',
    valueHelp: '💡 Isi jika nilainya selalu sama untuk semua pasien. Kosongkan jika data diambil dari Excel.',
    selectorHelp: '💡 Kode penanda kolom input yang akan diisi. Contoh: #input-nik, [name="NIK"]',
    showValue: true, showSelector: true, showExcel: true,
    valuePlaceholder: 'Contoh: Pekerjaan tetap (kosongkan jika pakai Excel)',
  },
  select: {
    valueLabel: 'Opsi yang Dipilih (jika tidak dari Excel)',
    valueHelp: '💡 Isi nama opsi yang selalu dipilih. Kosongkan jika opsi diambil dari Excel.',
    selectorHelp: '💡 Kode penanda dropdown/select. Contoh: [name="jenis_kelamin"]',
    showValue: true, showSelector: true, showExcel: true,
    valuePlaceholder: 'Contoh: Laki-laki (kosongkan jika pakai Excel)',
  },
  navigate: {
    valueLabel: 'Alamat Halaman (URL)',
    valueHelp: '💡 Alamat lengkap halaman yang akan dibuka. Contoh: https://ckg.kemkes.go.id/pendaftaran',
    selectorHelp: '',
    showValue: true, showSelector: false, showExcel: false,
    valuePlaceholder: 'https://...',
  },
  scroll: {
    valueLabel: '— (tidak diperlukan)',
    valueHelp: '',
    selectorHelp: '💡 Kode penanda elemen yang akan di-scroll ke tampilan. Boleh kosong untuk scroll bawah.',
    showValue: false, showSelector: true, showExcel: false,
    valuePlaceholder: '',
  },
  wait: {
    valueLabel: 'Durasi Tunggu (ms)',
    valueHelp: '💡 Berapa lama jeda dalam milidetik. 1000 ms = 1 detik. Contoh: 2000 = 2 detik.',
    selectorHelp: '',
    showValue: true, showSelector: false, showExcel: false,
    valuePlaceholder: 'Contoh: 2000',
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

let workflows    = [...BUILTIN_WORKFLOWS];   // ordered list of wf keys
let wfDisplay    = { ...BUILTIN_DISPLAY };   // key → display name
let currentWf    = 'pendaftaran';
let templates    = {};
let editingIdx   = null;
let dragSrcIdx   = null;
let editingWfKey = null;                     // null = add, string = rename
let builderMode  = 'beginner';               // 'beginner' | 'expert'
let currentView  = 'workflow';               // 'workflow' | 'marketplace'
let stepView     = 'list';                   // 'list' | 'flow'

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadWorkflowRegistry();
  await loadAllTemplates();
  // Load saved builder mode (default: beginner)
  const savedMode = await storage.get('templateBuilderMode');
  builderMode = savedMode?.mode || 'beginner';
  renderSidebar();
  bindTopbar();
  bindModal();
  bindWfModal();
  bindJSONModal();
  bindImportExport();
  bindImportRecorder();
  bindRecorder();
  bindPicker();
  bindMarketplace();
  bindViewToggle();
  applyBuilderMode(builderMode); // apply before first render
  renderStepList();
}

// ── Workflow Registry (persist custom workflows) ──────────────────────────────

async function loadWorkflowRegistry() {
  const saved = await storage.get('workflow_registry');
  if (saved && Array.isArray(saved.workflows)) {
    // merge: built-ins first (in order), then custom
    const custom = saved.workflows.filter(k => !BUILTIN_WORKFLOWS.includes(k));
    workflows = [...BUILTIN_WORKFLOWS, ...custom];
    // merge display names
    wfDisplay = { ...BUILTIN_DISPLAY, ...(saved.display || {}) };
  }
}

async function saveWorkflowRegistry() {
  await storage.set('workflow_registry', {
    workflows,
    display: wfDisplay,
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadAllTemplates() {
  for (const wf of workflows) {
    const saved = await storage.get(`template_${wf}`);
    if (saved) {
      templates[wf] = saved;
    } else {
      // try bundled default for built-ins
      if (BUILTIN_WORKFLOWS.includes(wf)) {
        try {
          const r = await fetch(chrome?.runtime?.getURL
            ? chrome.runtime.getURL(`templates/${wf}.json`)
            : `templates/${wf}.json`
          );
          templates[wf] = await r.json();
        } catch {
          templates[wf] = makeEmptyTemplate(wf);
        }
      } else {
        templates[wf] = makeEmptyTemplate(wf);
      }
      await saveTemplate(wf);
    }
  }
}

function makeEmptyTemplate(wf) {
  return { meta: { name: wf, displayName: wfDisplay[wf] || wf, version: '1.0.0', custom: !BUILTIN_WORKFLOWS.includes(wf) }, steps: [] };
}

async function saveTemplate(wf) {
  await storage.set(`template_${wf}`, templates[wf]);
}

// ── Sidebar (dynamic) ─────────────────────────────────────────────────────────

function renderSidebar() {
  const nav = document.getElementById('wfNav');

  // Remove old wf-btn rows (keep .nav-label)
  nav.querySelectorAll('.wf-btn, .wf-btn-row').forEach(el => el.remove());

  workflows.forEach(wf => {
    const isBuiltin = BUILTIN_WORKFLOWS.includes(wf);
    const isActive  = wf === currentWf;
    const icon      = isBuiltin ? (BUILTIN_ICONS[wf] || CUSTOM_ICON) : CUSTOM_ICON;

    const row = document.createElement('div');
    row.className = 'wf-btn-row';
    row.dataset.wf = wf;

    const btn = document.createElement('button');
    btn.className = `wf-btn${isActive ? ' active' : ''}`;
    btn.dataset.wf = wf;
    btn.innerHTML = `${icon}<span class="wf-btn-label">${wfDisplay[wf] || wf}</span>`;
    btn.addEventListener('click', () => switchWorkflow(wf));

    row.appendChild(btn);

    // custom workflows get rename + delete icons
    if (!isBuiltin) {
      const actions = document.createElement('div');
      actions.className = 'wf-row-actions';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'wf-action-btn';
      renameBtn.title = 'Ganti nama';
      renameBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      renameBtn.addEventListener('click', e => { e.stopPropagation(); openWfModal('rename', wf); });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'wf-action-btn wf-action-del';
      deleteBtn.title = 'Hapus workflow';
      deleteBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>`;
      deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteWorkflow(wf); });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);
    }

    nav.appendChild(row);
  });

  // update page title
  document.getElementById('pageTitle').textContent = wfDisplay[currentWf] || currentWf;
}

function switchWorkflow(wf) {
  currentWf = wf;
  // Jika sedang di marketplace, kembali ke view workflow dulu
  if (currentView === 'marketplace') {
    switchView('workflow');
  } else {
    renderSidebar();
    renderStepList();
  }
}

// ── Workflow CRUD ─────────────────────────────────────────────────────────────

/** Convert display name → safe key: lowercase, spaces→underscore, strip special chars */
function toWfKey(displayName) {
  return displayName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

async function addWorkflow(key, displayName) {
  if (workflows.includes(key)) {
    showToast(`ID "${key}" sudah digunakan`, 'error');
    return false;
  }
  workflows.push(key);
  wfDisplay[key] = displayName;
  templates[key] = makeEmptyTemplate(key);
  await saveTemplate(key);
  await saveWorkflowRegistry();
  return true;
}

async function renameWorkflow(key, newDisplayName) {
  wfDisplay[key] = newDisplayName;
  if (templates[key]?.meta) templates[key].meta.displayName = newDisplayName;
  await saveTemplate(key);
  await saveWorkflowRegistry();
}

async function deleteWorkflow(wf) {
  const stepsCount = templates[wf]?.steps?.length || 0;
  const label = wfDisplay[wf] || wf;
  const msg = stepsCount > 0
    ? `Hapus workflow "${label}"? Workflow ini berisi ${stepsCount} step yang akan ikut terhapus.`
    : `Hapus workflow "${label}"?`;
  if (!confirm(msg)) return;

  workflows = workflows.filter(k => k !== wf);
  delete wfDisplay[wf];
  delete templates[wf];
  await storage.remove(`template_${wf}`);
  await saveWorkflowRegistry();

  if (currentWf === wf) {
    currentWf = workflows[0] || 'pendaftaran';
  }
  renderSidebar();
  renderStepList();
  showToast(`Workflow "${label}" dihapus`);
}

// ── Builder Mode (Beginner / Expert) ──────────────────────────────────────────

/** Apply beginner/expert mode: update toggle UI, show/hide expert-only fields, re-render cards */
function applyBuilderMode(mode) {
  builderMode = mode;
  const isExpert = mode === 'expert';

  // ── Toggle button UI ──
  const toggleBtn   = document.getElementById('modeToggle');
  const lblBeginner = document.getElementById('modeLabelBeginner');
  const lblExpert   = document.getElementById('modeLabelExpert');
  if (toggleBtn) toggleBtn.setAttribute('aria-checked', isExpert ? 'true' : 'false');
  if (lblBeginner) lblBeginner.classList.toggle('active', !isExpert);
  if (lblExpert)   lblExpert.classList.toggle('active', isExpert);

  // ── Body class for CSS-driven differences ──
  document.body.classList.toggle('mode-beginner', !isExpert);
  document.body.classList.toggle('mode-expert', isExpert);

  // Apply to modal fields (if modal is open)
  applyModeToModal();

  // Re-render cards so human descriptions update
  renderStepList();
}

/** Apply mode visibility only to modal fields (no renderStepList). Safe to call from openModal. */
function applyModeToModal() {
  const isExpert   = builderMode === 'expert';
  const fgSelector = document.getElementById('fgSelector');
  const advToggle  = document.getElementById('advToggle');
  const advBody    = document.getElementById('advBody');

  if (fgSelector) {
    if (!isExpert) {
      fgSelector.style.display = 'none';
    } else {
      const activeType = document.querySelector('.type-card.active')?.dataset.type || 'click';
      const cfg = TYPE_CONFIG[activeType] || TYPE_CONFIG.click;
      fgSelector.style.display = cfg.showSelector ? '' : 'none';
    }
  }

  if (advToggle) advToggle.style.display = isExpert ? '' : 'none';
  if (advBody && !isExpert) {
    advBody.classList.add('hidden');
    document.querySelector('.adv-chevron')?.classList.remove('open');
  }
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function bindTopbar() {
  document.getElementById('btnAddStep').addEventListener('click', () => openModal(null));
  document.getElementById('btnPreviewJSON').addEventListener('click', openJSONModal);

  // Mode toggle
  document.getElementById('modeToggle')?.addEventListener('click', async () => {
    const newMode = builderMode === 'beginner' ? 'expert' : 'beginner';
    await storage.set('templateBuilderMode', { mode: newMode });
    applyBuilderMode(newMode);
  });
}

// ── Step List ─────────────────────────────────────────────────────────────────

function renderStepList() {
  const list  = document.getElementById('stepList');
  const empty = document.getElementById('emptyState');
  const steps = templates[currentWf]?.steps || [];

  document.getElementById('pageTitle').textContent = wfDisplay[currentWf] || currentWf;
  document.getElementById('stepCount').textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''}`;

  [...list.children].forEach(c => { if (!c.id || c.id !== 'emptyState') c.remove(); });

  if (steps.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  steps.forEach((step, idx) => list.appendChild(buildStepCard(step, idx)));
}

function buildStepCard(step, idx) {
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.idx = idx;
  card.draggable = true;

  const isExpert = builderMode === 'expert';

  // ── Expert view: raw selector + value (original) ──
  const selPreview = (step.selector || '').length > 50
    ? step.selector.slice(0, 47) + '…' : (step.selector || '—');

  const noSelectorTypes = ['click_button', 'wait_button', 'navigate', 'wait'];
  const showSel = isExpert && (!noSelectorTypes.includes(step.type) || step.selector);

  const excelBadge = step.excelColumn
    ? `<span class="step-meta-item"><span class="meta-key">excel:</span> ${step.excelColumn}</span>` : '';
  const valueLine = step.value && !['click_button','wait_button'].includes(step.type)
    ? `<span class="step-meta-item"><span class="meta-key">val:</span> ${String(step.value).slice(0, 50)}</span>` : '';
  const btnTextLine = ['click_button','wait_button'].includes(step.type) && step.value
    ? `<span class="step-meta-btn">👆 ${String(step.value).slice(0, 50)}</span>` : '';
  const selLine = showSel
    ? `<span class="step-meta-item sel-line"><span class="meta-key">sel:</span> ${selPreview}</span>` : '';

  // ── Beginner view: human-readable description ──
  function humanDesc(s) {
    const TYPE_EMOJI = {
      click: '👆', click_button: '👆', type: '⌨️', select: '📋',
      navigate: '🌐', scroll: '📜', wait: '⏳', wait_button: '⏳', date_picker: '📅',
    };
    const emoji = TYPE_EMOJI[s.type] || '▶';
    switch (s.type) {
      case 'type':
        if (s.excelColumn) return `${emoji} Isi kolom <strong>${s.excelColumn}</strong> dari Excel`;
        if (s.value)       return `${emoji} Ketik: <em>"${String(s.value).slice(0, 40)}"</em>`;
        return `${emoji} Isi kolom teks`;
      case 'select':
        if (s.excelColumn) return `${emoji} Pilih dari Excel (<strong>${s.excelColumn}</strong>)`;
        if (s.value)       return `${emoji} Pilih: <em>"${String(s.value).slice(0, 40)}"</em>`;
        return `${emoji} Pilih dari dropdown`;
      case 'click':
        if (s.value) return `${emoji} Klik tombol <em>"${String(s.value).slice(0, 40)}"</em>`;
        return `${emoji} Klik elemen`;
      case 'click_button':
        return `${emoji} Klik per teks: <em>"${String(s.value || '').slice(0, 40)}"</em>`;
      case 'wait_button':
        return `${emoji} Tunggu tombol <em>"${String(s.value || '').slice(0, 40)}"</em>`;
      case 'navigate':
        return `${emoji} Buka halaman`;
      case 'wait':
        return `${emoji} Tunggu ${s.value || ''}ms`;
      case 'scroll':
        return `${emoji} Scroll halaman`;
      case 'date_picker':
        return `${emoji} Pilih tanggal${s.excelColumn ? ` (${s.excelColumn})` : ''}`;
      default:
        return `${emoji} ${s.type}`;
    }
  }

  const metaHTML = isExpert
    ? `${selLine}${valueLine}${btnTextLine}${excelBadge}`
    : `<span class="step-meta-human">${humanDesc(step)}</span>`;

  card.innerHTML = `
    <span class="drag-handle" title="Drag untuk urutkan">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    </span>
    <span class="step-num">${idx + 1}</span>
    <div class="step-body">
      <div class="step-top">
        <span class="step-badge badge-${step.type}">${step.type}</span>
        <span class="step-label">${step.label || '(tanpa label)'}</span>
      </div>
      <div class="step-meta">
        ${metaHTML}
      </div>
    </div>
    <div class="step-actions">
      <button class="icon-btn btn-test" title="Uji step di tab aktif">
        ▶
      </button>
      <button class="icon-btn btn-dup" title="Duplikat">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="icon-btn btn-edit" title="Edit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="icon-btn btn-del delete" title="Hapus">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.btn-edit').addEventListener('click', () => openModal(idx));
  card.querySelector('.btn-del').addEventListener('click',  () => deleteStep(idx));
  card.querySelector('.btn-dup').addEventListener('click',  () => duplicateStep(idx));
  card.querySelector('.btn-test').addEventListener('click', () => testStep(step, card));

  card.addEventListener('dragstart', e => { dragSrcIdx = idx; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  card.addEventListener('dragend',   () => card.classList.remove('dragging'));
  card.addEventListener('dragover',  e => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', async e => {
    e.preventDefault(); card.classList.remove('drag-over');
    if (dragSrcIdx === null || dragSrcIdx === idx) return;
    const steps = templates[currentWf].steps;
    const [moved] = steps.splice(dragSrcIdx, 1);
    steps.splice(idx, 0, moved);
    dragSrcIdx = null;
    await saveTemplate(currentWf);
    renderStepList();
    showToast('Urutan diperbarui', 'success');
  });

  return card;
}

// ── Step CRUD ─────────────────────────────────────────────────────────────────

async function deleteStep(idx) {
  templates[currentWf].steps.splice(idx, 1);
  await saveTemplate(currentWf);
  renderStepList();
  showToast('Step dihapus');
}

async function duplicateStep(idx) {
  const steps = templates[currentWf].steps;
  const copy = JSON.parse(JSON.stringify(steps[idx]));
  copy.label = copy.label + ' (copy)';
  steps.splice(idx + 1, 0, copy);
  await saveTemplate(currentWf);
  renderStepList();
  showToast('Step diduplikat', 'success');
}

async function testStep(step, cardEl) {
  const testBtn = cardEl?.querySelector('.btn-test');
  if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳'; }

  try {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_test_step', step });
    const ok  = res?.ok && res?.result?.success;
    const msg = res?.result?.message || res?.message || (ok ? 'Berhasil' : 'Gagal');

    showToast(ok ? `✅ ${step.label}: ${msg}` : `❌ ${step.label}: ${msg}`, ok ? 'success' : 'error');

    // Visual feedback on card
    if (cardEl) {
      cardEl.classList.remove('test-ok', 'test-fail');
      cardEl.classList.add(ok ? 'test-ok' : 'test-fail');
      setTimeout(() => cardEl.classList.remove('test-ok', 'test-fail'), 2500);
    }
  } catch (e) {
    showToast(`❌ Uji gagal: ${e.message}`, 'error');
  } finally {
    if (testBtn) { testBtn.disabled = false; testBtn.textContent = '▶'; }
  }
}

// ── Step Modal ────────────────────────────────────────────────────────────────

function openModal(idx) {
  editingIdx = idx;
  const step   = idx !== null ? templates[currentWf].steps[idx] : null;
  const isEdit = step !== null;

  document.getElementById('modalTitle').textContent    = isEdit ? 'Edit Step' : 'Tambah Step Baru';
  document.getElementById('modalSubtitle').textContent = isEdit ? 'Ubah pengaturan step ini' : 'Pilih jenis aksi yang ingin dilakukan';

  const type = step?.type || 'click';
  document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  applyTypeConfig(type);

  setFieldVal('fLabel',     step?.label || '');
  setFieldVal('fSelector',  step?.selector || '');
  setFieldVal('fValue',     step?.value ?? '');
  setFieldVal('fExcelCol',  step?.excelColumn || '');
  setFieldVal('fCondition', step?.condition ? JSON.stringify(step.condition) : '');
  setFieldVal('fMaxRetry',  step?.recovery?.maxRetry ?? 3);
  setFieldVal('fWaitMs',    step?.recovery?.waitMs ?? 1500);

  const advBody    = document.getElementById('advBody');
  const advChevron = document.querySelector('.adv-chevron');
  advBody.classList.add('hidden');
  advChevron.classList.remove('open');
  if (step?.condition) { advBody.classList.remove('hidden'); advChevron.classList.add('open'); }

  // Apply builder mode constraints to modal fields only (no re-render)
  applyModeToModal();

  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById('fLabel').focus();
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.add('hidden');
  editingIdx = null;
}

function applyTypeConfig(type) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.click;
  const isExpert = builderMode === 'expert';

  const fgSel = document.getElementById('fgSelector');
  if (fgSel) {
    // In Beginner mode, selector is always hidden regardless of type
    fgSel.style.display = (!isExpert) ? 'none' : (cfg.showSelector ? '' : 'none');
    const h = document.getElementById('selectorHelp');
    if (h) h.textContent = cfg.selectorHelp;
  }

  const fgVal = document.getElementById('fgValue');
  if (fgVal) {
    fgVal.style.display = cfg.showValue ? '' : 'none';
    const lbl = document.getElementById('valueLabelText');
    const hlp = document.getElementById('valueHelpText');
    const inp = document.getElementById('fValue');
    if (lbl) lbl.textContent = cfg.valueLabel;
    if (hlp) hlp.textContent = cfg.valueHelp;
    if (inp) inp.placeholder = cfg.valuePlaceholder;
  }

  const fgExcel = document.getElementById('fgExcel');
  if (fgExcel) fgExcel.style.display = cfg.showExcel ? '' : 'none';

  _renumberSteps(cfg);
}

function _renumberSteps(cfg) {
  let n = 3;
  const valNum   = document.getElementById('valueStepNum');
  const excelNum = document.getElementById('excelStepNum');
  if (!cfg.showSelector) n--;
  if (cfg.showValue && valNum)   valNum.textContent   = n + 1;
  if (cfg.showExcel && excelNum) excelNum.textContent = n + 2;
}

function bindModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyTypeConfig(card.dataset.type);
    });
  });

  document.getElementById('advToggle').addEventListener('click', () => {
    const body    = document.getElementById('advBody');
    const chevron = document.querySelector('.adv-chevron');
    const isOpen  = !body.classList.contains('hidden');
    body.classList.toggle('hidden', isOpen);
    chevron.classList.toggle('open', !isOpen);
  });

  document.getElementById('btnSaveStep').addEventListener('click', saveStep);
}

async function saveStep() {
  const type  = document.querySelector('.type-card.active')?.dataset.type || 'click';
  const label = document.getElementById('fLabel').value.trim();
  if (!label) { showToast('Nama step wajib diisi', 'error'); return; }

  let condition = null;
  const condRaw = document.getElementById('fCondition').value.trim();
  if (condRaw) {
    try { condition = JSON.parse(condRaw); }
    catch { showToast('Kondisi bukan format JSON yang valid', 'error'); return; }
  }

  const step = {
    type, label,
    selector:    document.getElementById('fSelector').value.trim() || null,
    value:       parseValue(type, document.getElementById('fValue').value.trim()),
    excelColumn: document.getElementById('fExcelCol').value || null,
    condition,
    recovery: {
      maxRetry: parseInt(document.getElementById('fMaxRetry').value) || 3,
      waitMs:   parseInt(document.getElementById('fWaitMs').value)   || 1500,
    }
  };

  const steps = templates[currentWf].steps;
  if (editingIdx !== null) { steps[editingIdx] = step; } else { steps.push(step); }

  await saveTemplate(currentWf);
  closeModal();
  renderStepList();
  showToast(editingIdx !== null ? 'Step diperbarui ✓' : 'Step ditambahkan ✓', 'success');
}

function parseValue(type, raw) {
  if (!raw) return null;
  if (type === 'wait') return parseInt(raw) || 1500;
  return raw;
}

// ── Workflow Modal (Add / Rename) ─────────────────────────────────────────────

function openWfModal(mode, wf = null) {
  editingWfKey = wf;

  const isRename = mode === 'rename';
  document.getElementById('wfModalTitle').textContent = isRename ? 'Ganti Nama Workflow' : 'Tambah Workflow Baru';
  document.getElementById('wfModalSaveLabel').textContent = isRename ? 'Simpan' : 'Buat Workflow';

  const keyGroup = document.getElementById('wfKeyGroup');
  keyGroup.style.display = isRename ? 'none' : ''; // hide key field on rename

  setFieldVal('wfDisplayName', isRename ? (wfDisplay[wf] || wf) : '');
  setFieldVal('wfKey', isRename ? (wf || '') : '');

  document.getElementById('wfModalBackdrop').classList.remove('hidden');
  document.getElementById('wfDisplayName').focus();
}

function closeWfModal() {
  document.getElementById('wfModalBackdrop').classList.add('hidden');
  editingWfKey = null;
}

function bindWfModal() {
  // open via sidebar "+" button
  document.getElementById('btnAddWorkflow').addEventListener('click', () => openWfModal('add'));

  document.getElementById('wfModalClose').addEventListener('click', closeWfModal);
  document.getElementById('wfModalCancel').addEventListener('click', closeWfModal);
  document.getElementById('wfModalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeWfModal();
  });

  // auto-fill key from display name (add mode only)
  document.getElementById('wfDisplayName').addEventListener('input', e => {
    if (editingWfKey !== null) return; // rename mode: key is fixed
    const keyInput = document.getElementById('wfKey');
    keyInput.value = toWfKey(e.target.value);
  });

  document.getElementById('wfModalSave').addEventListener('click', saveWfModal);
}

async function saveWfModal() {
  const displayName = document.getElementById('wfDisplayName').value.trim();
  if (!displayName) { showToast('Nama workflow wajib diisi', 'error'); return; }

  if (editingWfKey !== null) {
    // Rename mode
    await renameWorkflow(editingWfKey, displayName);
    closeWfModal();
    renderSidebar();
    renderStepList();
    showToast(`Workflow diganti menjadi "${displayName}" ✓`, 'success');
  } else {
    // Add mode
    const key = document.getElementById('wfKey').value.trim();
    if (!key) { showToast('ID workflow wajib diisi', 'error'); return; }
    if (!/^[a-z0-9_]+$/.test(key)) {
      showToast('ID hanya boleh huruf kecil, angka, dan underscore (_)', 'error');
      return;
    }
    if (workflows.includes(key)) {
      showToast(`ID "${key}" sudah digunakan`, 'error');
      return;
    }

    const ok = await addWorkflow(key, displayName);
    if (!ok) return;

    closeWfModal();
    currentWf = key;
    renderSidebar();
    renderStepList();
    showToast(`Workflow "${displayName}" dibuat ✓`, 'success');
  }
}

// ── JSON Preview Modal ────────────────────────────────────────────────────────

function openJSONModal() {
  document.getElementById('jsonModalWf').textContent = currentWf;
  document.getElementById('jsonPreview').textContent = JSON.stringify(templates[currentWf], null, 2);
  document.getElementById('jsonBackdrop').classList.remove('hidden');
}

function bindJSONModal() {
  document.getElementById('jsonModalClose').addEventListener('click', () =>
    document.getElementById('jsonBackdrop').classList.add('hidden')
  );
  document.getElementById('jsonBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('jsonBackdrop').classList.add('hidden');
  });
  document.getElementById('btnCopyJSON').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('jsonPreview').textContent)
      .then(() => showToast('JSON disalin', 'success'));
  });
  document.getElementById('btnDownloadJSON').addEventListener('click', () => {
    downloadBlob(document.getElementById('jsonPreview').textContent, `${currentWf}.json`, 'application/json');
    showToast('JSON diunduh', 'success');
  });
}

// ── Import / Export / Reset ───────────────────────────────────────────────────

function bindImportExport() {
  const importInput = document.getElementById('importInput');
  document.getElementById('btnImport').addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Format tidak valid');

      let wf = parsed.meta?.name;
      // if wf not in current list, register it
      if (!workflows.includes(wf)) {
        const guessed = workflows.find(w => file.name.includes(w));
        if (guessed) {
          wf = guessed;
        } else if (wf) {
          // register as new custom workflow from meta
          const displayName = parsed.meta?.displayName || wf;
          await addWorkflow(wf, displayName);
        } else {
          wf = currentWf;
        }
      }

      templates[wf] = parsed;
      await saveTemplate(wf);
      currentWf = wf;
      renderSidebar();
      renderStepList();
      showToast(`Template "${wf}" diimpor (${parsed.steps.length} steps)`, 'success');
    } catch (err) {
      showToast('Import gagal: ' + err.message, 'error');
    }
    importInput.value = '';
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    downloadBlob(JSON.stringify(templates[currentWf], null, 2), `${currentWf}.json`, 'application/json');
    showToast(`Template "${currentWf}" diekspor`, 'success');
  });

  document.getElementById('btnResetDefault').addEventListener('click', async () => {
    const label = wfDisplay[currentWf] || currentWf;
    if (!confirm(`Reset template "${label}" ke default bawaan? Data kustom akan hilang.`)) return;
    await storage.remove(`template_${currentWf}`);
    if (BUILTIN_WORKFLOWS.includes(currentWf)) {
      try {
        const r = await fetch(chrome?.runtime?.getURL
          ? chrome.runtime.getURL(`templates/${currentWf}.json`)
          : `templates/${currentWf}.json`
        );
        templates[currentWf] = await r.json();
      } catch {
        templates[currentWf] = makeEmptyTemplate(currentWf);
      }
    } else {
      templates[currentWf] = makeEmptyTemplate(currentWf);
    }
    renderStepList();
    showToast(`Template "${label}" direset`, 'success');
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setFieldVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg, level = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast${level ? ' ' + level : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ── Recorder JSON Parser ──────────────────────────────────────────────────────

const FIELD_TO_EXCEL = {
  'NIK':'NIK','Nama':'Nama','TTL':'TTL','Jenis_Kelamin':'Jenis_Kelamin',
  'No_WA':'No_WA','Pekerjaan':'Pekerjaan','Alamat':'Alamat','Provinsi':'Provinsi',
  'Kabupaten':'Kabupaten','Kecamatan':'Kecamatan','Kelurahan':'Kelurahan',
  'Status_Nikah':'Status_Nikah','BB':'BB','TB':'TB','GDS':'GDS',
  'TD_Sistolik':'TD_Sistolik','TD_Diastolik':'TD_Diastolik','Diagnosa':'Diagnosa',
  'Tanggal_Periksa':'Tanggal_Periksa','No_Antrian':'No_Antrian',
  'masukkan nik':'NIK','masukkan nama lengkap':'Nama','no. whatsapp':'No_WA',
  'berat badan':'BB','tinggi badan':'TB','gula darah sewaktu':'GDS',
  'sistole':'TD_Sistolik','diastole':'TD_Diastolik',
};

function bestSelector(el) {
  if (el.id && !el.id.includes(' '))     return `#${el.id}`;
  if (el.name && !el.name.includes(' ')) return `[name="${el.name}"]`;
  if (el.placeholder)                    return `[placeholder="${el.placeholder}"]`;
  const sel = el.selector || '';
  const parts = sel.split(' > ');
  const last  = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  const generic = ['div','span','i','button'];
  if (generic.includes(last.split('.')[0]) && second) return `${second} > ${last}`;
  return last || sel;
}

function resolveExcelColumn(el) {
  const candidates = [el.name, el.id, el.placeholder?.toLowerCase(), el.ariaLabel];
  for (const c of candidates) {
    if (!c) continue;
    if (FIELD_TO_EXCEL[c]) return FIELD_TO_EXCEL[c];
    if (FIELD_TO_EXCEL[c.toLowerCase()]) return FIELD_TO_EXCEL[c.toLowerCase()];
  }
  return null;
}

function isDatePicker(recStep) {
  const sel = recStep.element?.selector || '';
  const cls = (recStep.element?.classes || []).join(' ');
  return sel.includes('mx-datepicker') || sel.includes('mx-input-wrapper') ||
    cls.includes('mx-') || recStep.element?.id?.includes('Tanggal') ||
    recStep.element?.text?.toLowerCase().includes('tanggal');
}

function isSelectElement(recStep) {
  return recStep.element?.tag === 'select' || recStep.element?.tag === 'option';
}

export function parseRecorderJSON(recorderData) {
  const raw = recorderData.steps || [];
  const steps = [];
  const seen  = new Set();

  const firstUrl = raw[0]?.pageUrl;
  if (firstUrl) {
    steps.push({ type:'navigate', label:'Buka halaman', selector:null, value:firstUrl,
      excelColumn:null, condition:null, recovery:{ maxRetry:2, waitMs:2000 } });
  }

  let i = 0;
  while (i < raw.length) {
    const rec = raw[i];
    const el  = rec.element || {};
    const recType = rec.type;

    if (recType === 'submit') { i++; continue; }
    if (recType === 'click' && (el.tag === 'input' || el.tag === 'textarea') && el.type !== 'checkbox' && el.type !== 'radio') { i++; continue; }
    if (recType === 'dblclick') { i++; continue; }

    const dedupeKey = `${recType}|${el.selector}`;
    if (recType === 'input' || recType === 'change') {
      if (seen.has(`change|${el.selector}`) || seen.has(`input|${el.selector}`)) { i++; continue; }
    }
    seen.add(dedupeKey);

    if (isDatePicker(rec) && recType === 'click') {
      const excol = resolveExcelColumn(el) || 'TTL';
      let j = i + 1;
      while (j < raw.length && isDatePicker(raw[j])) j++;
      steps.push({ type:'date_picker', label:`Pilih tanggal (${excol})`,
        selector: el.selector?.includes('mx-input-wrapper') ? '.mx-input-wrapper' : (bestSelector(el) || '.mx-input-wrapper'),
        value:null, excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:1000 } });
      i = j; continue;
    }

    if (recType === 'input' || recType === 'change') {
      const excol = resolveExcelColumn(el);
      steps.push({ type:'type', label:`Isi ${el.placeholder || el.name || el.id || 'field'}`,
        selector:bestSelector(el), value:excol ? null : (rec.value || el.value || null),
        excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:500 } });
      i++; continue;
    }

    if (isSelectElement(rec) || recType === 'change' && el.tag === 'select') {
      const excol = resolveExcelColumn(el);
      steps.push({ type:'select', label:`Pilih ${el.placeholder || el.name || el.id || 'dropdown'}`,
        selector:bestSelector(el), value:excol ? null : (rec.value || el.value || null),
        excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:500 } });
      i++; continue;
    }

    if (recType === 'click') {
      const text = el.text?.trim();
      steps.push({ type:'click',
        label: text ? `Klik "${text.slice(0,40)}"` : `Klik ${el.tag}${el.classes?.[0] ? '.'+el.classes[0] : ''}`,
        selector:bestSelector(el), value:text||null, excelColumn:null, condition:null,
        recovery:{ maxRetry:3, waitMs:1000 }, ...(text ? { textHint:text } : {}) });
      i++; continue;
    }

    if (recType === 'scroll') { i++; continue; }
    i++;
  }
  return steps;
}

function detectWorkflowFromRecorder(recorderData, filename) {
  const url  = recorderData.steps?.[0]?.pageUrl || '';
  const name = filename.toLowerCase();
  for (const wf of workflows) {
    if (url.includes(wf) || name.includes(wf)) return wf;
  }
  return null;
}

function bindImportRecorder() {
  const input = document.getElementById('recorderInput');
  document.getElementById('btnImportRecorder').addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Bukan file recorder yang valid');
      if (!parsed.meta?.totalSteps) throw new Error('Format recorder tidak dikenal');

      const detectedWf = detectWorkflowFromRecorder(parsed, file.name) || currentWf;
      const ckgSteps   = parseRecorderJSON(parsed);
      if (!ckgSteps.length) throw new Error('Tidak ada step yang bisa diparse');

      openRecorderPreview(detectedWf, ckgSteps, parsed.meta);
    } catch (err) {
      showToast('Import recorder gagal: ' + err.message, 'error');
    }
    input.value = '';
  });
}

function openRecorderPreview(wf, steps, meta) {
  document.getElementById('recorderPreviewBackdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'recorderPreviewBackdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  const typeColors = { navigate:'#6366f1', type:'#0ea5e9', click:'#f59e0b', select:'#8b5cf6', date_picker:'#ec4899', wait:'#64748b' };

  const stepRows = steps.map((s, i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
      <td style="padding:5px 8px;color:#64748b;font-size:11px">${i+1}</td>
      <td style="padding:5px 8px"><span style="background:${typeColors[s.type]||'#475569'};color:white;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">${s.type}</span></td>
      <td style="padding:5px 8px;font-size:11px;color:#e2e8f0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.label}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:10px;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.selector||'—'}</td>
      <td style="padding:5px 8px;font-size:10px;color:#34d399">${s.excelColumn||(s.value?`"${String(s.value).slice(0,20)}"` : '—')}</td>
    </tr>
  `).join('');

  const wfOptions = workflows.map(w => `<option value="${w}" ${w===wf?'selected':''}>${wfDisplay[w]||w}</option>`).join('');

  backdrop.innerHTML = `
    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:14px;width:780px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:700;color:#f1f5f9;font-size:14px">🎬 Preview Import Recorder</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${meta?.totalSteps||0} steps rekaman → <strong style="color:#38bdf8">${steps.length} steps CKG</strong> · Workflow: <strong style="color:#a78bfa">${wfDisplay[wf]||wf}</strong></div>
        </div>
        <button id="recorderPreviewClose" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;padding:4px">✕</button>
      </div>
      <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px">
        <span style="font-size:12px;color:#94a3b8">Simpan ke workflow:</span>
        <select id="recorderWfSelect" style="background:#0f172a;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f1f5f9;padding:4px 10px;font-size:12px;cursor:pointer;">${wfOptions}</select>
        <span style="font-size:11px;color:#475569">· Mode:</span>
        <select id="recorderModeSelect" style="background:#0f172a;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f1f5f9;padding:4px 10px;font-size:12px;cursor:pointer;">
          <option value="replace">Ganti semua (replace)</option>
          <option value="append">Tambahkan di akhir (append)</option>
        </select>
      </div>
      <div style="overflow-y:auto;flex:1;padding:0 20px 8px">
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:600">#</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:600">TYPE</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:600">LABEL</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:600">SELECTOR</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:#475569;font-weight:600">EXCEL / VALUE</th>
          </tr></thead>
          <tbody>${stepRows}</tbody>
        </table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:flex-end;gap:8px">
        <button id="recorderPreviewCancel" style="padding:7px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;font-size:12px;">Batal</button>
        <button id="recorderPreviewSave" style="padding:7px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;cursor:pointer;font-size:12px;font-weight:600;">✓ Simpan ${steps.length} Steps</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  backdrop._steps = steps;

  const close = () => backdrop.remove();
  document.getElementById('recorderPreviewClose').addEventListener('click', close);
  document.getElementById('recorderPreviewCancel').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  document.getElementById('recorderPreviewSave').addEventListener('click', async () => {
    const targetWf = document.getElementById('recorderWfSelect').value;
    const mode     = document.getElementById('recorderModeSelect').value;
    const newSteps = backdrop._steps;

    if (mode === 'replace') { templates[targetWf].steps = newSteps; }
    else { templates[targetWf].steps.push(...newSteps); }

    await saveTemplate(targetWf);
    currentWf = targetWf;
    renderSidebar();
    renderStepList();
    close();
    showToast(`✓ ${newSteps.length} steps dari recorder diimpor ke "${wfDisplay[targetWf]||targetWf}"`, 'success');
  });
}

// ── Recorder (live dari tab aktif) ────────────────────────────────────────────

function bindRecorder() {
  const btnRecord     = document.getElementById('btnRecord');
  const btnStopRecord = document.getElementById('btnStopRecord');
  const recordCount   = document.getElementById('recordCount');

  if (!btnRecord) return;

  // Listener dari background: update jumlah aksi saat merekam
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'ckg_record_tick' && recordCount) {
      recordCount.textContent = msg.count || 0;
    }
  });

  btnRecord.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_start_record' });
    if (!res?.ok) {
      showToast('Rekam gagal: ' + (res?.error || 'Tidak ada tab aktif'), 'error');
      return;
    }
    btnRecord.classList.add('hidden');
    btnStopRecord.classList.remove('hidden');
    if (recordCount) recordCount.textContent = '0';
    showToast('🔴 Rekam dimulai di tab aktif', 'success');
  });

  btnStopRecord.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_stop_record' });
    btnStopRecord.classList.add('hidden');
    btnRecord.classList.remove('hidden');

    if (!res?.ok || !res.buffer?.length) {
      showToast('Tidak ada aksi yang direkam', 'error');
      return;
    }

    // Konversi buffer raw events → CKG steps
    const rawData = { steps: res.buffer.map(ev => ({
      type: ev.type,
      pageUrl: null,
      element: {
        tag: ev.tag, id: ev.id, name: ev.name,
        placeholder: ev.placeholder, selector: ev.selector,
        text: ev.text, classes: [],
      },
      value: ev.value,
    })), meta: { totalSteps: res.buffer.length } };

    const ckgSteps = parseRecorderJSON(rawData);
    if (!ckgSteps.length) { showToast('Tidak ada step yang berhasil diparse', 'error'); return; }

    openRecorderPreview(currentWf, ckgSteps, rawData.meta);
    showToast(`✅ ${ckgSteps.length} step berhasil direkam`, 'success');
  });
}

// ── Element Picker ────────────────────────────────────────────────────────────

function bindPicker() {
  const btnPick = document.getElementById('btnPickElement');
  if (!btnPick) return;

  let _pickListener = null;

  btnPick.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_start_pick' });
    if (!res?.ok) {
      showToast('Picker gagal: ' + (res?.error || 'Tidak ada tab aktif'), 'error');
      return;
    }

    // Visual feedback: tombol aktif
    btnPick.classList.add('picking');
    btnPick.textContent = '… Pilih elemen';
    showToast('🎯 Klik elemen di tab aktif. Esc untuk batal.', '');

    // Bersihkan listener lama jika ada
    if (_pickListener) {
      chrome.runtime.onMessage.removeListener(_pickListener);
      _pickListener = null;
    }

    _pickListener = (msg) => {
      if (msg.action === 'ckg_element_picked') {
        const selectorInput = document.getElementById('fSelector');
        if (selectorInput) {
          selectorInput.value = msg.selector;
          selectorInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        showToast(`✅ Selector: ${msg.selector}`, 'success');
        _resetPickBtn();
      } else if (msg.action === 'ckg_pick_cancelled') {
        showToast('Pemilihan elemen dibatalkan', '');
        _resetPickBtn();
      }
    };
    chrome.runtime.onMessage.addListener(_pickListener);

    function _resetPickBtn() {
      btnPick.classList.remove('picking');
      btnPick.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        + Pilih dari Halaman
      `;
      if (_pickListener) {
        chrome.runtime.onMessage.removeListener(_pickListener);
        _pickListener = null;
      }
    }
  });
}

// ── Phase 4: Marketplace ──────────────────────────────────────────────────────

/** Daftar template di marketplace (fetched dari extension files) */
const MARKETPLACE_ITEMS = [
  {
    key:         'pendaftaran',
    displayName: 'Pendaftaran Baru',
    icon:        '👤',
    description: 'Otomasi daftar pasien baru: NIK, nama, TTL, jenis kelamin, alamat, faskes',
    tags:        ['pendaftaran', 'pasien baru'],
    file:        'templates/marketplace/pendaftaran.json',
    stepCount:   26,
    targetWf:    'pendaftaran',
    author:      'KlikPro Official',
  },
  {
    key:         'konfirmasi',
    displayName: 'Konfirmasi Hadir',
    icon:        '✅',
    description: 'Konfirmasi kehadiran pasien yang sudah terdaftar di antrian',
    tags:        ['konfirmasi', 'hadir'],
    file:        'templates/marketplace/konfirmasi.json',
    stepCount:   8,
    targetWf:    'konfirmasi',
    author:      'KlikPro Official',
  },
  {
    key:         'kuesioner',
    displayName: 'Isi Kuesioner',
    icon:        '📋',
    description: 'Isi seluruh section kuesioner CKG menggunakan jawaban bawaan quiz_rules',
    tags:        ['kuesioner', 'quiz'],
    file:        'templates/marketplace/kuesioner.json',
    stepCount:   10,
    targetWf:    'kuesioner',
    author:      'KlikPro Official',
  },
  {
    key:         'pemeriksaan',
    displayName: 'Input Pemeriksaan',
    icon:        '🩺',
    description: 'Input BB, TB, GDS, tekanan darah sistolik & diastolik untuk tiap pasien',
    tags:        ['pemeriksaan', 'bb', 'tb'],
    file:        'templates/marketplace/pemeriksaan.json',
    stepCount:   20,
    targetWf:    'pemeriksaan',
    author:      'KlikPro Official',
  },
  {
    key:         'selesai',
    displayName: 'Selesaikan Layanan',
    icon:        '🏁',
    description: 'Klik Selesaikan Layanan dan konfirmasi modal untuk menutup sesi CKG',
    tags:        ['selesai', 'layanan'],
    file:        'templates/marketplace/selesai.json',
    stepCount:   4,
    targetWf:    'selesai',
    author:      'KlikPro Official',
  },
  {
    key:         'lengkap',
    displayName: 'Bundle Lengkap CKG',
    icon:        '📦',
    description: 'Paket komplit 5 workflow: Pendaftaran → Konfirmasi → Kuesioner → Pemeriksaan → Selesai',
    tags:        ['bundle', 'lengkap', 'semua'],
    file:        'templates/marketplace/lengkap.json',
    stepCount:   null,
    targetWf:    null,
    bundle:      true,
    author:      'KlikPro Official',
  },
];

/** Ganti tampilan utama: 'workflow' atau 'marketplace' */
function switchView(view) {
  currentView = view;

  const stepList        = document.getElementById('stepList');
  const flowList        = document.getElementById('flowList');
  const marketPanel     = document.getElementById('marketplacePanel');
  const topbarRight     = document.querySelector('.topbar-right');
  const viewToggle      = document.getElementById('viewToggle');
  const btnMarketplace  = document.getElementById('btnMarketplace');

  const isMarket = view === 'marketplace';

  stepList?.classList.toggle('hidden', isMarket);
  flowList?.classList.toggle('hidden', true);      // reset ke list saat switch
  marketPanel?.classList.toggle('hidden', !isMarket);
  viewToggle?.classList.toggle('hidden', isMarket);
  topbarRight?.classList.toggle('hidden', isMarket);

  // Sidebar: highlight marketplace button
  btnMarketplace?.classList.toggle('active', isMarket);

  if (isMarket) {
    document.getElementById('pageTitle').textContent = 'Marketplace';
    document.getElementById('stepCount').textContent = '';
    renderMarketplace();
  } else {
    stepView = 'list';
    document.getElementById('btnViewList')?.classList.add('active');
    document.getElementById('btnViewFlow')?.classList.remove('active');
    renderSidebar();
    renderStepList();
  }
}

/** Render grid kartu marketplace */
async function renderMarketplace() {
  const grid = document.getElementById('marketplaceGrid');
  if (!grid) return;

  // Cek template mana yang sudah diinstall
  const installedSteps = {};
  for (const wf of workflows) {
    installedSteps[wf] = templates[wf]?.steps?.length || 0;
  }

  grid.innerHTML = MARKETPLACE_ITEMS.map(item => {
    const tagBadges = item.tags.map(t =>
      `<span class="mkt-tag">${t}</span>`
    ).join('');

    const stepText = item.bundle ? '5 workflow' : `${item.stepCount} steps`;
    const isBundle = item.bundle;

    // Cek apakah sudah diinstall
    const installed = !isBundle && installedSteps[item.targetWf] > 0;
    const installLabel = installed
      ? `<span class="mkt-installed-badge">✓ Terinstall (${installedSteps[item.targetWf]} steps)</span>`
      : '';

    return `
      <div class="mkt-card ${isBundle ? 'mkt-bundle' : ''}" data-key="${item.key}">
        <div class="mkt-card-icon">${item.icon}</div>
        <div class="mkt-card-body">
          <div class="mkt-card-header">
            <span class="mkt-card-title">${item.displayName}</span>
            ${isBundle ? '<span class="mkt-bundle-badge">BUNDLE</span>' : ''}
          </div>
          <p class="mkt-card-desc">${item.description}</p>
          <div class="mkt-card-tags">${tagBadges}</div>
          <div class="mkt-card-meta">
            <span class="mkt-author">by ${item.author}</span>
            <span class="mkt-steps">${stepText}</span>
          </div>
          ${installLabel}
        </div>
        <div class="mkt-card-actions">
          ${isBundle
            ? `<button class="btn-mkt-use btn-mkt-bundle" data-key="${item.key}">⚡ Install Bundle</button>`
            : `<button class="btn-mkt-preview" data-key="${item.key}">👁 Preview</button>
               <button class="btn-mkt-use" data-key="${item.key}">⬇ Gunakan</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Bind events
  grid.querySelectorAll('.btn-mkt-use').forEach(btn => {
    btn.addEventListener('click', () => importMarketplaceTemplate(btn.dataset.key));
  });
  grid.querySelectorAll('.btn-mkt-preview').forEach(btn => {
    btn.addEventListener('click', () => previewMarketplaceTemplate(btn.dataset.key));
  });
}

/** Preview template dari marketplace */
async function previewMarketplaceTemplate(key) {
  const item = MARKETPLACE_ITEMS.find(i => i.key === key);
  if (!item || item.bundle) return;

  try {
    const url  = chrome.runtime.getURL(item.file);
    const r    = await fetch(url);
    const data = await r.json();
    openRecorderPreview(item.targetWf, data.steps, {
      totalSteps: data.steps.length,
      ...data.meta,
    });
  } catch (e) {
    showToast('Gagal load preview: ' + e.message, 'error');
  }
}

/** Import template dari marketplace ke workflow aktif */
async function importMarketplaceTemplate(key) {
  const item = MARKETPLACE_ITEMS.find(i => i.key === key);
  if (!item) return;

  try {
    const url  = chrome.runtime.getURL(item.file);
    const r    = await fetch(url);
    const data = await r.json();

    if (item.bundle) {
      // Bundle: import semua workflow sekaligus
      const bundleIncludes = data.workflows || {};
      let count = 0;
      for (const [wf, filePath] of Object.entries(bundleIncludes)) {
        try {
          const wfUrl  = chrome.runtime.getURL(`templates/marketplace/${wf}.json`);
          const wfRes  = await fetch(wfUrl);
          const wfData = await wfRes.json();
          if (wfData.steps?.length) {
            if (!templates[wf]) templates[wf] = { meta: {}, steps: [] };
            templates[wf].steps = wfData.steps;
            await saveTemplate(wf);
            count++;
          }
        } catch (_) {}
      }
      renderSidebar();
      showToast(`📦 Bundle diinstall: ${count} workflow diperbarui`, 'success');
    } else {
      // Single workflow
      const targetWf = item.targetWf || currentWf;
      if (!templates[targetWf]) templates[targetWf] = { meta: {}, steps: [] };

      const existingCount = templates[targetWf].steps?.length || 0;
      if (existingCount > 0) {
        // Gunakan openRecorderPreview agar user bisa memilih replace/append
        openRecorderPreview(targetWf, data.steps, {
          totalSteps: data.steps.length,
          ...data.meta,
        });
      } else {
        templates[targetWf].steps = data.steps;
        await saveTemplate(targetWf);
        currentWf = targetWf;
        switchView('workflow');
        showToast(`✅ Template "${item.displayName}" diinstall ke ${wfDisplay[targetWf] || targetWf}`, 'success');
      }
    }
    // Re-render grid untuk update badge installed
    renderMarketplace();
  } catch (e) {
    showToast('Gagal import template: ' + e.message, 'error');
  }
}

/** Bind tombol Marketplace di sidebar */
function bindMarketplace() {
  document.getElementById('btnMarketplace')?.addEventListener('click', () => {
    if (currentView === 'marketplace') {
      switchView('workflow');
    } else {
      switchView('marketplace');
    }
  });
}

// ── Phase 4: Visual Flow View ─────────────────────────────────────────────────

/** Bind toggle List/Flow di topbar */
function bindViewToggle() {
  const btnList = document.getElementById('btnViewList');
  const btnFlow = document.getElementById('btnViewFlow');

  btnList?.addEventListener('click', () => {
    if (stepView === 'list') return;
    stepView = 'list';
    btnList.classList.add('active');
    btnFlow.classList.remove('active');
    document.getElementById('stepList').classList.remove('hidden');
    document.getElementById('flowList').classList.add('hidden');
  });

  btnFlow?.addEventListener('click', () => {
    if (stepView === 'flow') return;
    stepView = 'flow';
    btnFlow.classList.add('active');
    btnList.classList.remove('active');
    document.getElementById('stepList').classList.add('hidden');
    const flowEl = document.getElementById('flowList');
    flowEl.classList.remove('hidden');
    renderFlowView(flowEl);
  });
}

/** Warna per type untuk flow node */
const FLOW_TYPE_COLOR = {
  navigate:        { bg: '#ede9fe', border: '#7c3aed', dot: '#7c3aed', label: '#5b21b6' },
  click:           { bg: '#fef3c7', border: '#d97706', dot: '#d97706', label: '#92400e' },
  click_button:    { bg: '#fef3c7', border: '#d97706', dot: '#d97706', label: '#92400e' },
  wait_button:     { bg: '#e0f2fe', border: '#0284c7', dot: '#0284c7', label: '#0c4a6e' },
  type:            { bg: '#dcfce7', border: '#16a34a', dot: '#16a34a', label: '#14532d' },
  wait:            { bg: '#f1f5f9', border: '#64748b', dot: '#64748b', label: '#334155' },
  date_picker:     { bg: '#fce7f3', border: '#db2777', dot: '#db2777', label: '#831843' },
  select_dropdown: { bg: '#f0fdf4', border: '#15803d', dot: '#15803d', label: '#14532d' },
  quiz_section:    { bg: '#eff6ff', border: '#2563eb', dot: '#2563eb', label: '#1e40af' },
  default:         { bg: '#f8fafc', border: '#94a3b8', dot: '#94a3b8', label: '#475569' },
};

function renderFlowView(container) {
  const steps = templates[currentWf]?.steps || [];
  if (!steps.length) {
    container.innerHTML = '<div class="flow-empty">Belum ada step di workflow ini.</div>';
    return;
  }

  const nodes = steps.map((step, idx) => {
    const c = FLOW_TYPE_COLOR[step.type] || FLOW_TYPE_COLOR.default;
    const isCondition = step.condition?.ifVisible;
    const desc = step.selector
      ? `<span class="flow-selector">${String(step.selector).slice(0, 40)}</span>`
      : step.value
      ? `<span class="flow-value">${String(step.value).slice(0, 40)}</span>`
      : '';
    return `
      <div class="flow-node-wrap">
        <div class="flow-node ${isCondition ? 'flow-node-condition' : ''}"
             style="background:${c.bg};border-color:${c.border}"
             title="${step.label}">
          <div class="flow-node-type" style="color:${c.label}">
            <span class="flow-dot" style="background:${c.dot}"></span>
            ${step.type}
          </div>
          <div class="flow-node-label">${step.label}</div>
          ${desc}
          ${isCondition ? '<span class="flow-cond-badge">? opsional</span>' : ''}
        </div>
        ${idx < steps.length - 1 ? '<div class="flow-connector"><div class="flow-arrow"></div></div>' : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flow-container">
      <div class="flow-title">Alur Eksekusi — ${wfDisplay[currentWf] || currentWf} (${steps.length} steps)</div>
      ${nodes}
    </div>
  `;
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────



document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('modalBackdrop').classList.add('hidden');
    document.getElementById('jsonBackdrop').classList.add('hidden');
    document.getElementById('wfModalBackdrop').classList.add('hidden');
  }
});

// ── Entrypoint ────────────────────────────────────────────────────────────────

init().catch(console.error);
