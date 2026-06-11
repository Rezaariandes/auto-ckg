/**
 * popup_builder_quiz.js
 * Fitur KUESIONER di Builder:
 * - Scan form SATUSEHAT → simpan ke storage
 * - Tampilkan di sidebar sebagai quiz items
 * - Edit mapping per pertanyaan (Excel column / fixed / skip)
 * - Export/backup semua schema ke JSON
 */

import { loadColumnConfig, getExcelColumnOptions } from '../lib/column_config.js';

// EXCEL_COLUMNS dimuat dinamis dari column_config (Setting → Kolom Excel)
let _excelColumns = null;
async function _getExcelColumns() {
  if (!_excelColumns) {
    const cfg = await loadColumnConfig();
    _excelColumns = getExcelColumnOptions(cfg);
  }
  return _excelColumns;
}
export function invalidateColumnCache() { _excelColumns = null; }

// ── Auto-suggest: cocokkan pertanyaan → kolom Excel ─────────────────────────

const SUGGEST_RULES = [
  [/status.?per?kaw|menikah|nikah/i,            'Status_Nikah'],
  [/jenis.?kelamin|gender|laki|perempuan/i,     'Jenis_Kelamin'],
  [/pendidikan|sekolah|ijazah/i,                'Pendidikan'],
  [/pekerjaan|profesi|bekerja/i,                'Pekerjaan'],
  [/agama|religi/i,                             'Agama'],
  [/berat.?badan|\bbb\b/i,                      'BB'],
  [/tinggi.?badan|\btb\b/i,                     'TB'],
  [/sistolik|diastolik|tekanan.?darah|hipertensi/i, 'Tekanan_Darah'],
  [/gula.?darah|diabetes|glukosa|hba1c/i,       'Gula_Darah'],
  [/kolesterol/i,                               'Kolesterol'],
  [/disabilitas|difabel/i,                      'Disabilitas'],
  [/merokok|rokok|nikotin/i,                    'Merokok'],
  [/aktivitas.?fisik|olahraga/i,                'Aktivitas'],
  [/provinsi/i,                                 'Provinsi'],
  [/kabupaten|kota\b/i,                         'Kabupaten'],
  [/kecamatan/i,                                'Kecamatan'],
  [/kelurahan|desa/i,                           'Kelurahan'],
  [/alamat/i,                                   'Alamat'],
  [/tanggal.?lahir|ttl|lahir/i,                 'TTL'],
  [/nik\b|ktp\b|identitas/i,                    'NIK'],
  [/nama\b/i,                                   'Nama'],
  [/usia|umur|\busia\b/i,                       'TTL'],
  [/frekuensi.?nadi|denyut.?nadi/i,             'Tekanan_Darah'],
  [/saturasi|spo2|oksigen/i,                    'Tekanan_Darah'],
  [/suhu.?tubuh|temperatur/i,                   'Tekanan_Darah'],
  [/lingkar.?perut|abdominal/i,                 'BB'],
  [/diagnos|penyakit/i,                         'Diagnosa'],
];

// Pertanyaan yang biasanya jawabannya tetap
const FIXED_PATTERNS = [
  [/hamil|kehamilan/i,              'Tidak'],
  [/penyandang.?disabilitas/i,      'Non disabilitas'],
  [/apakah.+tb|riwayat.+tb|tuberkulosis/i, 'Tidak'],
  [/apakah.+stroke/i,               'Tidak'],
  [/apakah.+jantung/i,              'Tidak'],
  [/apakah.+kanker/i,               'Tidak'],
  [/apakah.+hiv/i,                  'Tidak'],
  [/apakah.+minum.?obat/i,          'Tidak'],
  [/apakah.+alergi/i,               'Tidak'],
];

function autoSuggest(questionText) {
  for (const [rx, col] of SUGGEST_RULES) {
    if (rx.test(questionText)) return { mode: 'direct_match', excelColumn: col };
  }
  for (const [rx, ans] of FIXED_PATTERNS) {
    if (rx.test(questionText)) return { mode: 'fixed', fixedAnswer: ans };
  }
  return { mode: 'direct_match', excelColumn: '' };
}

// ── State ────────────────────────────────────────────────────────────────────

let quizSchemas      = {};   // { screenName: schemaObj }
let currentQuizKey   = null; // schema aktif di panel kanan
let editingQuizQIdx  = null; // index pertanyaan yang sedang diedit

// ── Entry point (dipanggil dari initBuilderTab) ───────────────────────────────

export async function initQuizBuilder(showToastFn, downloadBlobFn) {
  _toast = showToastFn;
  _download = downloadBlobFn;
  await loadQuizSchemas();
  renderQuizSidebar();
  bindScanModal();
  bindQuizModal();
  bindBackupBtn();
}

let _toast    = (msg, lvl) => console.log('[QUIZ]', msg);
let _download = (content, name, type) => {};

// ── Load schemas from storage ─────────────────────────────────────────────────

async function loadQuizSchemas() {
  try {
    const all = await chrome.storage.local.get(null);
    quizSchemas = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith('ckg_schema_') && v?.screen) {
        quizSchemas[v.screen] = v;
      }
    }
  } catch (e) {
    console.warn('[Quiz] loadQuizSchemas error:', e.message);
  }
}

async function saveQuizSchema(schema) {
  schema.savedAt = new Date().toISOString();
  await chrome.storage.local.set({ [`ckg_schema_${schema.screen}`]: schema });
  quizSchemas[schema.screen] = schema;
}

async function deleteQuizSchema(screenName) {
  await chrome.storage.local.remove(`ckg_schema_${screenName}`);
  delete quizSchemas[screenName];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function renderQuizSidebar() {
  const nav = document.getElementById('quizNav');
  if (!nav) return;
  nav.querySelectorAll('.bld-quiz-btn-row').forEach(el => el.remove());

  const schemas = Object.values(quizSchemas);

  if (schemas.length === 0) {
    let empty = nav.querySelector('.bld-quiz-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'bld-quiz-empty';
      empty.style.cssText = 'font-size:10px;color:var(--text3);padding:6px 10px;font-style:italic';
      empty.textContent = 'Belum ada kuesioner. Klik 🔍 untuk scan.';
      nav.appendChild(empty);
    }
    return;
  }

  nav.querySelector('.bld-quiz-empty')?.remove();

  schemas.forEach(schema => {
    const key      = schema.screen;
    const label    = schema.displayName || schema.title || key;
    const isActive = key === currentQuizKey;
    const count    = schema.questions?.length || 0;

    const row = document.createElement('div');
    row.className = 'bld-wf-btn-row bld-quiz-btn-row';
    row.dataset.quizKey = key;

    row.innerHTML = `
      <button class="bld-wf-btn bld-quiz-btn${isActive ? ' active' : ''}" data-quiz="${key}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span>${label}</span>
        <span style="font-size:9px;opacity:.6;margin-left:auto">${count}Q</span>
      </button>
      <div class="bld-wf-row-acts">
        <button class="bld-wf-act-btn bld-quiz-export-btn" data-key="${key}" title="Export JSON schema ini">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </button>
        <button class="bld-wf-act-btn bld-wf-act-del bld-quiz-del-btn" data-key="${key}" title="Hapus kuesioner">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    `;

    row.querySelector('.bld-quiz-btn').addEventListener('click', () => switchToQuiz(key));
    row.querySelector('.bld-quiz-export-btn').addEventListener('click', e => { e.stopPropagation(); exportSingleSchema(key); });
    row.querySelector('.bld-quiz-del-btn').addEventListener('click', e => { e.stopPropagation(); confirmDeleteSchema(key); });

    nav.appendChild(row);
  });
}

function switchToQuiz(key) {
  currentQuizKey = key;
  renderQuizSidebar();
  renderQuizPanel();

  // Sembunyikan workflow controls, tampilkan quiz panel
  document.getElementById('stepList')?.classList.add('hidden');
  document.getElementById('flowList')?.classList.add('hidden');
  document.getElementById('quizPanel')?.classList.remove('hidden');
  document.getElementById('btnAddStep')?.classList.add('hidden');
  document.getElementById('btnPreviewJSON')?.classList.add('hidden');

  // Update topbar
  const schema = quizSchemas[key];
  const label  = schema?.displayName || schema?.title || key;
  if (document.getElementById('pageTitle')) document.getElementById('pageTitle').textContent = label;
  if (document.getElementById('stepCount')) document.getElementById('stepCount').textContent = `${schema?.questions?.length || 0} pertanyaan`;
}

export function resetToWorkflow() {
  currentQuizKey = null;
  document.getElementById('stepList')?.classList.remove('hidden');
  document.getElementById('quizPanel')?.classList.add('hidden');
  document.getElementById('btnAddStep')?.classList.remove('hidden');
  document.getElementById('btnPreviewJSON')?.classList.remove('hidden');
}

// ── Quiz Panel (panel kanan) ─────────────────────────────────────────────────

function ensureQuizPanel() {
  let panel = document.getElementById('quizPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'quizPanel';
  panel.className = 'hidden';

  // Topbar quiz
  panel.innerHTML = `
    <div class="bld-quiz-topbar">
      <div id="quizPanelInfo" style="font-size:11px;color:var(--text3)"></div>
      <div style="display:flex;gap:8px">
        <button class="bld-btn bld-btn-ghost" id="btnQuizScanAgain" style="font-size:11px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Scan Ulang
        </button>
        <button class="bld-btn bld-btn-ghost" id="btnQuizExportAll" style="font-size:11px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Export JSON
        </button>
      </div>
    </div>
    <div id="quizQuestionList" class="bld-step-list"></div>
  `;

  document.querySelector('.bld-main')?.appendChild(panel);

  panel.querySelector('#btnQuizScanAgain')?.addEventListener('click', () => openScanModal(currentQuizKey));
  panel.querySelector('#btnQuizExportAll')?.addEventListener('click', () => exportSingleSchema(currentQuizKey));

  return panel;
}

function renderQuizPanel() {
  const panel  = ensureQuizPanel();
  const schema = quizSchemas[currentQuizKey];
  if (!schema) return;

  const list   = panel.querySelector('#quizQuestionList');
  const info   = panel.querySelector('#quizPanelInfo');
  const fp     = schema.fingerprint || '?';
  const saved  = schema.savedAt ? new Date(schema.savedAt).toLocaleString('id-ID') : '?';

  if (info) info.textContent = `FP: ${fp} · Disimpan: ${saved}`;

  list.innerHTML = '';
  if (!schema.questions?.length) {
    list.innerHTML = '<div class="bld-empty"><p>Belum ada pertanyaan. Klik Scan Ulang.</p></div>';
    return;
  }

  schema.questions.forEach((q, idx) => {
    const card = buildQuizCard(q, idx);
    list.appendChild(card);
  });
}

function buildQuizCard(q, idx) {
  const card = document.createElement('div');
  card.className = 'bld-step-card bld-quiz-card';
  card.dataset.idx = idx;

  const mode = q.answerMode || 'direct_match';
  const fallbackPart = (mode === 'direct_match' && q.defaultFallback)
    ? ` <span style="font-size:9px;color:#b45309;background:rgba(245,158,11,0.15);padding:1px 4px;border-radius:2px">⚡ default: ${q.defaultFallback}</span>`
    : '';

  const modeLabel = mode === 'direct_match'
    ? `📊 Excel: <strong>${q.excelColumn || '(belum dipilih)'}</strong>${fallbackPart}`
    : mode === 'fixed'
    ? `📌 Tetap: <strong>${q.fixedAnswer || '(belum dipilih)'}</strong>`
    : `⏭ Lewati`;

  const configured = (mode === 'direct_match' && q.excelColumn) ||
                     (mode === 'fixed' && q.fixedAnswer) ||
                     q.defaultFallback || // punya fallback = sudah terkonfigurasi
                     mode === 'skip';

  card.innerHTML = `
    <span class="bld-snum">${idx + 1}</span>
    <div class="bld-sbody">
      <div class="bld-stop">
        <span class="bld-sbadge bld-badge-quiz">QUIZ</span>
        <span class="bld-slabel">${q.question}</span>
        ${!configured ? '<span style="font-size:9px;color:#f59e0b;margin-left:6px">⚠ Belum dikonfigurasi</span>' : ''}
      </div>
      <div class="bld-smeta">
        <span class="bld-smeta-human">${modeLabel}</span>
      </div>
    </div>
    <div class="bld-sacts">
      <button class="bld-icon-btn bld-quiz-edit-btn" title="Edit mapping" data-idx="${idx}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.bld-quiz-edit-btn').addEventListener('click', () => openQuizModal(idx));
  return card;
}

// ── Quiz Question Modal ───────────────────────────────────────────────────────

function bindQuizModal() {
  document.getElementById('quizModalClose')?.addEventListener('click',  closeQuizModal);
  document.getElementById('quizModalCancel')?.addEventListener('click', closeQuizModal);
  document.getElementById('quizModalBackdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeQuizModal();
  });
  document.getElementById('quizModalSave')?.addEventListener('click', saveQuizQuestion);

  document.querySelectorAll('input[name="quizAnswerMode"]').forEach(r => {
    r.addEventListener('change', updateQuizModalFields);
  });
}

async function openQuizModal(idx) {
  const schema = quizSchemas[currentQuizKey];
  if (!schema?.questions?.[idx]) return;

  editingQuizQIdx = idx;
  const q = schema.questions[idx];

  // Tampilkan pertanyaan
  document.getElementById('quizQText').textContent = q.question;

  // Tampilkan pilihan
  const optList = document.getElementById('quizOptionsList');
  optList.innerHTML = '';
  (q.options || []).forEach(opt => {
    const chip = document.createElement('span');
    chip.style.cssText = 'padding:3px 8px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.3);border-radius:20px;font-size:10px;color:#06b6d4';
    chip.textContent = opt.label || opt.value || opt;
    optList.appendChild(chip);
  });

  // Set mode
  const mode = q.answerMode || 'direct_match';
  const radio = document.querySelector(`input[name="quizAnswerMode"][value="${mode}"]`);
  if (radio) radio.checked = true;

  // Populate Excel columns dropdown — ambil dari column_config
  const EXCEL_COLUMNS = await _getExcelColumns();
  const selExcel = document.getElementById('quizExcelCol');
  selExcel.innerHTML = '<option value="">— Pilih kolom Excel —</option>';
  EXCEL_COLUMNS.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.value;
    opt.textContent = col.label;
    if (col.value === q.excelColumn) opt.selected = true;
    selExcel.appendChild(opt);
  });

  // Populate fixed answer dropdown
  const selFixed = document.getElementById('quizFixedAnswer');
  selFixed.innerHTML = '<option value="">— Pilih jawaban —</option>';
  (q.options || []).forEach(opt => {
    const label = opt.label || opt.value || opt;
    const o = document.createElement('option');
    o.value = label;
    o.textContent = label;
    if (label === q.fixedAnswer) o.selected = true;
    selFixed.appendChild(o);
  });

  // Populate Default Fallback dropdown (opsi yang sama seperti fixed)
  const selFallback = document.getElementById('quizDefaultFallback');
  selFallback.innerHTML = '<option value="">— Tidak ada (lewati jika tidak cocok) —</option>';
  (q.options || []).forEach(opt => {
    const label = opt.label || opt.value || opt;
    const o = document.createElement('option');
    o.value = label;
    o.textContent = label;
    if (label === q.defaultFallback) o.selected = true;
    selFallback.appendChild(o);
  });

  updateQuizModalFields();
  document.getElementById('quizModalBackdrop')?.classList.remove('hidden');
}

function updateQuizModalFields() {
  const mode = document.querySelector('input[name="quizAnswerMode"]:checked')?.value || 'direct_match';
  document.getElementById('quizFgDirect').style.display = mode === 'direct_match' ? '' : 'none';
  document.getElementById('quizFgFixed').style.display  = mode === 'fixed'        ? '' : 'none';
}

function closeQuizModal() {
  document.getElementById('quizModalBackdrop')?.classList.add('hidden');
  editingQuizQIdx = null;
}

async function saveQuizQuestion() {
  const schema = quizSchemas[currentQuizKey];
  if (!schema || editingQuizQIdx === null) return;

  const mode = document.querySelector('input[name="quizAnswerMode"]:checked')?.value || 'direct_match';
  const q    = schema.questions[editingQuizQIdx];

  q.answerMode      = mode;
  q.excelColumn     = mode === 'direct_match' ? (document.getElementById('quizExcelCol').value || null) : null;
  q.fixedAnswer     = mode === 'fixed'        ? (document.getElementById('quizFixedAnswer').value || null) : null;
  // defaultFallback hanya berlaku saat direct_match
  q.defaultFallback = mode === 'direct_match' ? (document.getElementById('quizDefaultFallback').value || null) : null;

  await saveQuizSchema(schema);
  closeQuizModal();
  renderQuizPanel();
  _toast('Konfigurasi pertanyaan disimpan ✓', 'success');
}

// ── Scan Modal ────────────────────────────────────────────────────────────────

function bindScanModal() {
  document.getElementById('btnScanNewSchema')?.addEventListener('click', () => openScanModal());
  document.getElementById('scanModalClose')?.addEventListener('click',  closeScanModal);
  document.getElementById('scanModalCancel')?.addEventListener('click', closeScanModal);
  document.getElementById('scanModalBackdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeScanModal();
  });
  document.getElementById('btnDoScan')?.addEventListener('click', doScan);
}

function openScanModal(prefillKey = null) {
  const schema = prefillKey ? quizSchemas[prefillKey] : null;
  document.getElementById('scanSchemaName').value = schema?.displayName || schema?.title || '';
  document.getElementById('scanStatus').textContent = '';
  document.getElementById('scanModalBackdrop')?.classList.remove('hidden');
  document.getElementById('scanSchemaName')?.focus();
}

function closeScanModal() {
  document.getElementById('scanModalBackdrop')?.classList.add('hidden');
}

function setScanStatus(msg, color = 'var(--text2)') {
  const el = document.getElementById('scanStatus');
  if (el) { el.textContent = msg; el.style.color = color; }
}

async function doScan() {
  const displayName = document.getElementById('scanSchemaName').value.trim();
  if (!displayName) {
    setScanStatus('⚠ Nama kuesioner wajib diisi!', '#f59e0b');
    document.getElementById('scanSchemaName').focus();
    return;
  }

  const btn = document.getElementById('btnDoScan');
  btn.disabled = true;
  btn.textContent = '⏳ Scanning...';
  setScanStatus('Menghubungi halaman SATUSEHAT...', '#06b6d4');

  try {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_extract_schema' });

    if (!res?.ok) {
      setScanStatus(`❌ ${res?.error || 'Scan gagal'}`, '#ef4444');
      return;
    }

    const schema = res.schema;
    schema.displayName = displayName;

    // Auto-suggest mapping untuk setiap pertanyaan
    (schema.questions || []).forEach(q => {
      if (!q.answerMode) {
        const suggest = autoSuggest(q.question);
        q.answerMode  = suggest.mode;
        q.excelColumn = suggest.excelColumn || null;
        q.fixedAnswer = suggest.fixedAnswer || null;
      }
    });

    await saveQuizSchema(schema);
    const srcLabel = res.source === 'react-state' ? 'Metadata Form Builder (React state)'
                   : res.source === 'dom+meta'    ? 'DOM + metadata tersimpan'
                   : 'DOM (fallback)';
    setScanStatus(`✅ ${schema.questions?.length || 0} pertanyaan di-scan via ${srcLabel}!`, '#10b981');

    renderQuizSidebar();
    setTimeout(() => {
      closeScanModal();
      switchToQuiz(schema.screen);
      _toast(`Kuesioner "${displayName}" disimpan ✓`, 'success');
    }, 900);

  } catch (e) {
    setScanStatus(`❌ Error: ${e.message}`, '#ef4444');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Scan Sekarang`;
  }
}

// ── Export / Backup ───────────────────────────────────────────────────────────

function exportSingleSchema(key) {
  const schema = quizSchemas[key];
  if (!schema) return;
  const name = (schema.displayName || key).replace(/\s+/g, '_').toLowerCase();
  _download(JSON.stringify(schema, null, 2), `schema_${name}.json`, 'application/json');
  _toast(`Schema "${schema.displayName || key}" diekspor ✓`, 'success');
}

function bindBackupBtn() {
  // Tombol backup semua schema sekaligus
  document.getElementById('btnBackupAllSchemas')?.addEventListener('click', exportAllSchemas);
}

export function exportAllSchemas() {
  const schemas = Object.values(quizSchemas);
  if (!schemas.length) {
    _toast('Belum ada schema yang tersimpan', 'error');
    return;
  }

  const bundle = {
    exportedAt:   new Date().toISOString(),
    version:      '2.0',
    totalSchemas: schemas.length,
    schemas,
    readme: [
      'File ini adalah backup semua kuesioner yang sudah di-scan.',
      'Untuk menjadikan schema permanen di extension:',
      '1. Salin setiap item dari array "schemas" ke file JSON terpisah di folder /schemas/',
      '   Contoh: schemas/demografi_dewasa_perempuan.json',
      '2. Reload extension di chrome://extensions',
      '3. Schema akan otomatis dimuat saat extension start.',
    ].join('\n'),
  };

  const ts   = new Date().toISOString().slice(0, 10);
  _download(JSON.stringify(bundle, null, 2), `ckg_schemas_backup_${ts}.json`, 'application/json');
  _toast(`${schemas.length} schema diekspor sebagai backup ✓`, 'success');
}

// ── Delete schema ─────────────────────────────────────────────────────────────

async function confirmDeleteSchema(key) {
  const label = quizSchemas[key]?.displayName || key;
  if (!confirm(`Hapus kuesioner "${label}"? Data mapping juga akan ikut terhapus.`)) return;

  await deleteQuizSchema(key);

  if (currentQuizKey === key) {
    currentQuizKey = null;
    resetToWorkflow();
  }

  renderQuizSidebar();
  _toast(`Kuesioner "${label}" dihapus`, 'success');
}
