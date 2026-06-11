/**
 * src/ui/popup_builder.js
 * Template Builder — ditanam sebagai tab di dalam popup.html
 * Logika identik dengan options.js, dibungkus sebagai export function.
 */

import { storage } from './../../src/lib/storage.js';
import { initQuizBuilder, renderQuizSidebar, resetToWorkflow, exportAllSchemas } from './popup_builder_quiz.js';


// ── Built-in workflows ────────────────────────────────────────────────────────

const BUILTIN_WORKFLOWS = ['pendaftaran', 'konfirmasi', 'kuesioner', 'pemeriksaan', 'selesai'];

const BUILTIN_DISPLAY = {
  pendaftaran: 'Pendaftaran',
  konfirmasi:  'Konfirmasi',
  kuesioner:   'Kuesioner',
  pemeriksaan: 'Pemeriksaan',
  selesai:     'Selesai',
};

const BUILTIN_ICONS = {
  pendaftaran: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  konfirmasi:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  kuesioner:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  pemeriksaan: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  selesai:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const CUSTOM_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15" x2="12" y2="15"/></svg>`;

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  click: {
    valueLabel: 'Teks Tombol (opsional)', showValue: true, showSelector: true, showExcel: false,
    valueHelp: '💡 Isi jika ingin mencocokkan tombol berdasarkan teksnya.',
    selectorHelp: '💡 Kode penanda tombol/link yang akan diklik. Contoh: #btn-daftar',
    valuePlaceholder: 'Contoh: Daftar, Simpan, Lanjut (boleh kosong)',
  },
  click_button: {
    valueLabel: 'Teks Tombol', showValue: true, showSelector: false, showExcel: false,
    valueHelp: '💡 Teks yang terlihat di tombol. Plugin akan cari tombol berdasarkan teks ini.',
    selectorHelp: '', valuePlaceholder: 'Contoh: Simpan, Daftar, Lanjut, Kirim',
    isButtonText: true,
  },
  wait_button: {
    valueLabel: 'Teks Tombol yang Ditunggu', showValue: true, showSelector: false, showExcel: false,
    valueHelp: '💡 Plugin akan tunggu sampai tombol dengan teks ini muncul.',
    selectorHelp: '', valuePlaceholder: 'Contoh: Konfirmasi, Lanjut',
    isButtonText: true,
  },
  type: {
    valueLabel: 'Teks yang Diketik (jika tidak dari Excel)', showValue: true, showSelector: true, showExcel: true,
    valueHelp: '💡 Isi jika nilainya selalu sama. Kosongkan jika data dari Excel.',
    selectorHelp: '💡 Kode penanda kolom input. Contoh: #input-nik, [name="NIK"]',
    valuePlaceholder: 'Contoh: Pekerjaan tetap (kosongkan jika pakai Excel)',
  },
  select: {
    valueLabel: 'Opsi yang Dipilih (jika tidak dari Excel)', showValue: true, showSelector: true, showExcel: true,
    valueHelp: '💡 Isi nama opsi yang selalu dipilih. Kosongkan jika dari Excel.',
    selectorHelp: '💡 Kode penanda dropdown. Contoh: [name="jenis_kelamin"]',
    valuePlaceholder: 'Contoh: Laki-laki (kosongkan jika pakai Excel)',
  },
  navigate: {
    valueLabel: 'Alamat Halaman (URL)', showValue: true, showSelector: false, showExcel: false,
    valueHelp: '💡 Alamat lengkap halaman yang akan dibuka.',
    selectorHelp: '', valuePlaceholder: 'https://...',
  },
  scroll: {
    valueLabel: '— (tidak diperlukan)', showValue: false, showSelector: true, showExcel: false,
    valueHelp: '', selectorHelp: '💡 Kode penanda elemen yang akan di-scroll. Boleh kosong.',
    valuePlaceholder: '',
  },
  wait: {
    valueLabel: 'Durasi Tunggu (ms)', showValue: true, showSelector: false, showExcel: false,
    valueHelp: '💡 Berapa lama jeda dalam milidetik. 1000 ms = 1 detik.',
    selectorHelp: '', valuePlaceholder: 'Contoh: 2000',
  },
  // ── Tipe khusus CKG ────────────────────────────────────────────────────
  date_picker: {
    valueLabel: '— (nilai dari Excel)', showValue: false, showSelector: true, showExcel: true,
    valueHelp: '',
    selectorHelp: '💡 Selector container datepicker mx-vue. Default: div.mx-datepicker',
    valuePlaceholder: '',
    infoText: '📅 Klik tanggal dari kolom Excel. Format kolom: tanggal Excel (Date cell) atau teks DD/MM/YYYY. Kolom umum: TTL (Tanggal Lahir).',
  },
  select_dropdown: {
    valueLabel: 'Teks Pilihan (jika nilai tetap, bukan dari Excel)', showValue: true, showSelector: true, showExcel: true,
    valueHelp: '💡 Isi jika nilainya selalu sama untuk semua baris. Kosongkan jika tiap baris beda (pakai Excel).',
    selectorHelp: '💡 Selector trigger dropdown Vue/custom. Biasanya div dengan placeholder. Contoh: div[placeholder="Pilih jenis kelamin"]',
    valuePlaceholder: 'Contoh: Laki-laki, Tidak memiliki disabilitas',
    infoText: '🔽 Untuk dropdown Vue kustom (bukan <select> HTML biasa). Engine akan klik trigger → cari opsi teks → klik opsi. Kolom umum: Jenis_Kelamin, Status_Nikah.',
  },
  select_antrian: {
    valueLabel: '— (nilai dari Excel)', showValue: false, showSelector: false, showExcel: true,
    valueHelp: '',
    selectorHelp: '',
    valuePlaceholder: '',
    infoText: '🗓️ Klik tanggal di kalender Tanggal Pemeriksaan. Isi kolom Excel dengan format tanggal (Date cell). Nama kolom default: Tgl_Periksa. Engine otomatis deteksi bulan dan navigasi kalender jika perlu.',
  },
  select_pekerjaan: {
    valueLabel: 'Nama Pekerjaan (jika nilai tetap, bukan dari Excel)', showValue: true, showSelector: true, showExcel: true,
    valueHelp: '💡 Isi jika pekerjaannya selalu sama. Kosongkan jika tiap baris beda (pakai Excel).',
    selectorHelp: '💡 Selector trigger dropdown pekerjaan. Contoh: div[placeholder="Pilih pekerjaan"]',
    valuePlaceholder: 'Contoh: Wiraswasta, Karyawan Swasta',
    infoText: '💼 Dropdown pekerjaan dengan search. Engine akan klik trigger → ketik nama pekerjaan → pilih hasil pertama. Kolom Excel: Pekerjaan.',
  },
  select_alamat: {
    valueLabel: '— (cascade dari Excel)', showValue: false, showSelector: false, showExcel: false,
    valueHelp: '',
    selectorHelp: '',
    valuePlaceholder: '',
    infoText: '🗺️ Otomatis isi cascade: Provinsi → Kabupaten → Kecamatan → Kelurahan. Butuh 4 kolom Excel: Provinsi, Kabupaten, Kecamatan, Kelurahan. Nilai harus persis sama dengan opsi di website.',
  },
  quiz_answer: {
    valueLabel: 'Jawaban (jika tetap) atau kosongkan jika dari Excel', showValue: true, showSelector: false, showExcel: true,
    valueHelp: '💡 Isi jawaban tetap (ya/tidak/normal/dll) atau kosongkan jika tiap baris beda.',
    selectorHelp: '',
    valuePlaceholder: 'Contoh: Ya, Tidak, Normal, Tidak Normal',
    infoText: '📋 Untuk pertanyaan kuesioner / checkbox pemeriksaan. Engine cari label teks lalu klik opsi jawaban. Kolom Excel sesuai nama field kuesioner.',
  },
  run_schema_quiz: {
    valueLabel: '— (tidak diperlukan)', showValue: false, showSelector: false, showExcel: false,
    valueHelp: '',
    selectorHelp: '',
    valuePlaceholder: '',
    infoText: '🗂 Jalankan kuesioner dari schema yang sudah di-mapping di Builder. Pilih nama schema di kolom "Kode Schema" di bawah. Semua pertanyaan akan diisi otomatis sesuai mapping Excel yang sudah dikonfigurasi.',
    isSchemaQuiz: true,
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

let workflows    = [...BUILTIN_WORKFLOWS];
let wfDisplay    = { ...BUILTIN_DISPLAY };
let currentWf    = 'pendaftaran';
let templates    = {};
let editingIdx   = null;
let dragSrcIdx   = null;
let editingWfKey = null;
let builderMode  = 'beginner';
let currentView  = 'workflow';
let stepView     = 'list';

// ── Entry point ───────────────────────────────────────────────────────────────

export async function initBuilderTab() {
  await loadWorkflowRegistry();
  await loadAllTemplates();
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
  applyBuilderMode(builderMode);
  renderStepList();
  bindKeyboardShortcuts();
  // ── Quiz Builder (v2) ──
  await initQuizBuilder(showToast, downloadBlob);
  // Backup All button
  document.getElementById('btnBackupAllSchemas')?.addEventListener('click', exportAllSchemas);
}


// ── Workflow Registry ─────────────────────────────────────────────────────────

async function loadWorkflowRegistry() {
  const saved = await storage.get('workflow_registry');
  if (saved && Array.isArray(saved.workflows)) {
    const custom = saved.workflows.filter(k => !BUILTIN_WORKFLOWS.includes(k));
    workflows = [...BUILTIN_WORKFLOWS, ...custom];
    wfDisplay = { ...BUILTIN_DISPLAY, ...(saved.display || {}) };
  }
}

async function saveWorkflowRegistry() {
  await storage.set('workflow_registry', { workflows, display: wfDisplay });
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadAllTemplates() {
  for (const wf of workflows) {
    const saved = await storage.get(`template_${wf}`);
    if (saved) {
      templates[wf] = saved;
    } else {
      if (BUILTIN_WORKFLOWS.includes(wf)) {
        try {
          const r = await fetch(chrome.runtime.getURL(`templates/${wf}.json`));
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  const nav = document.getElementById('wfNav');
  if (!nav) return;
  nav.querySelectorAll('.bld-wf-btn, .bld-wf-btn-row').forEach(el => el.remove());

  workflows.forEach(wf => {
    const isBuiltin = BUILTIN_WORKFLOWS.includes(wf);
    const isActive  = wf === currentWf;
    const icon      = isBuiltin ? (BUILTIN_ICONS[wf] || CUSTOM_ICON) : CUSTOM_ICON;

    const row = document.createElement('div');
    row.className = 'bld-wf-btn-row';
    row.dataset.wf = wf;

    const btn = document.createElement('button');
    btn.className = `bld-wf-btn${isActive ? ' active' : ''}`;
    btn.dataset.wf = wf;
    btn.innerHTML = `${icon}<span>${wfDisplay[wf] || wf}</span>`;
    btn.addEventListener('click', () => switchWorkflow(wf));
    row.appendChild(btn);

    if (!isBuiltin) {
      const acts = document.createElement('div');
      acts.className = 'bld-wf-row-acts';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'bld-wf-act-btn';
      renameBtn.title = 'Ganti nama';
      renameBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      renameBtn.addEventListener('click', e => { e.stopPropagation(); openWfModal('rename', wf); });

      const delBtn = document.createElement('button');
      delBtn.className = 'bld-wf-act-btn bld-wf-act-del';
      delBtn.title = 'Hapus workflow';
      delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>`;
      delBtn.addEventListener('click', e => { e.stopPropagation(); deleteWorkflow(wf); });

      acts.appendChild(renameBtn);
      acts.appendChild(delBtn);
      row.appendChild(acts);
    }

    nav.appendChild(row);
  });

  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = wfDisplay[currentWf] || currentWf;
}

function switchWorkflow(wf) {
  currentWf = wf;
  resetToWorkflow(); // pastikan quiz panel tersembunyi
  if (currentView === 'marketplace') {
    switchView('workflow');
  } else {
    renderSidebar();
    renderStepList();
  }
}


// ── Workflow CRUD ─────────────────────────────────────────────────────────────

function toWfKey(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

async function addWorkflow(key, displayName) {
  if (workflows.includes(key)) { showToast(`ID "${key}" sudah digunakan`, 'error'); return false; }
  workflows.push(key);
  wfDisplay[key] = displayName;
  templates[key] = makeEmptyTemplate(key);
  await saveTemplate(key);
  await saveWorkflowRegistry();
  return true;
}

async function renameWorkflow(key, newName) {
  wfDisplay[key] = newName;
  if (templates[key]?.meta) templates[key].meta.displayName = newName;
  await saveTemplate(key);
  await saveWorkflowRegistry();
}

async function deleteWorkflow(wf) {
  const count = templates[wf]?.steps?.length || 0;
  const label = wfDisplay[wf] || wf;
  const msg = count > 0
    ? `Hapus workflow "${label}"? Berisi ${count} step yang akan ikut terhapus.`
    : `Hapus workflow "${label}"?`;
  if (!confirm(msg)) return;
  workflows = workflows.filter(k => k !== wf);
  delete wfDisplay[wf];
  delete templates[wf];
  await storage.remove(`template_${wf}`);
  await saveWorkflowRegistry();
  if (currentWf === wf) currentWf = workflows[0] || 'pendaftaran';
  renderSidebar();
  renderStepList();
  showToast(`Workflow "${label}" dihapus`);
}

// ── Builder Mode ──────────────────────────────────────────────────────────────

function applyBuilderMode(mode) {
  builderMode = mode;
  const isExpert = mode === 'expert';
  document.getElementById('modeToggle')?.setAttribute('aria-checked', isExpert ? 'true' : 'false');
  document.getElementById('modeLabelBeginner')?.classList.toggle('active', !isExpert);
  document.getElementById('modeLabelExpert')?.classList.toggle('active', isExpert);
  applyModeToModal();
  renderStepList();
}

function applyModeToModal() {
  const isExpert = builderMode === 'expert';
  const fgSel = document.getElementById('fgSelector');
  const advToggle = document.getElementById('advToggle');
  const advBody   = document.getElementById('advBody');

  if (fgSel) {
    if (!isExpert) {
      fgSel.style.display = 'none';
    } else {
      const activeType = document.querySelector('.bld-type-card.active')?.dataset.type || 'click';
      const cfg = TYPE_CONFIG[activeType] || TYPE_CONFIG.click;
      fgSel.style.display = cfg.showSelector ? '' : 'none';
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
  document.getElementById('btnAddStep')?.addEventListener('click', () => openModal(null));
  document.getElementById('btnPreviewJSON')?.addEventListener('click', openJSONModal);
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
  if (!list || !empty) return;
  const steps = templates[currentWf]?.steps || [];
  document.getElementById('pageTitle').textContent = wfDisplay[currentWf] || currentWf;
  document.getElementById('stepCount').textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''}`;
  [...list.children].forEach(c => { if (!c.id || c.id !== 'emptyState') c.remove(); });
  if (!steps.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  steps.forEach((step, idx) => list.appendChild(buildStepCard(step, idx)));
}

function buildStepCard(step, idx) {
  const card = document.createElement('div');
  card.className = 'bld-step-card';
  card.dataset.idx = idx;
  card.draggable = true;

  const isExpert = builderMode === 'expert';
  const selPreview = (step.selector || '').length > 45 ? step.selector.slice(0, 42) + '…' : (step.selector || '—');
  const noSel = ['click_button', 'wait_button', 'navigate', 'wait', 'select_antrian', 'select_alamat'];
  const showSel = isExpert && (!noSel.includes(step.type) || step.selector);

  const excelBadge = step.excelColumn ? `<span class="bld-smeta-item"><span class="bld-meta-key">excel:</span> ${step.excelColumn}</span>` : '';
  const noValTypes = ['click_button','wait_button','date_picker','select_alamat'];
  const valueLine  = step.value && !noValTypes.includes(step.type)
    ? `<span class="bld-smeta-item"><span class="bld-meta-key">val:</span> ${String(step.value).slice(0, 45)}</span>` : '';
  const btnTextRaw = step.buttonText || (['click_button','wait_button'].includes(step.type) ? step.value : null);
  const btnText = ['click_button','wait_button'].includes(step.type) && btnTextRaw
    ? `<span class="bld-smeta-btn">👆 ${String(btnTextRaw).slice(0, 45)}</span>` : '';
  const selLine = showSel ? `<span class="bld-smeta-item bld-sel-line"><span class="bld-meta-key">sel:</span> ${selPreview}</span>` : '';

  function humanDesc(s) {
    const E = {
      click:'👆', click_button:'👆', type:'⌨️', select:'📋', navigate:'🌐',
      scroll:'📜', wait:'⏳', wait_button:'⏳', date_picker:'📅',
      select_dropdown:'🔽', select_antrian:'🗓️', select_pekerjaan:'💼', select_alamat:'🗺️',
    };
    const e = E[s.type] || '▶';
    switch (s.type) {
      case 'type':             return s.excelColumn ? `${e} Isi kolom <strong>${s.excelColumn}</strong> dari Excel` : s.value ? `${e} Ketik: <em>"${String(s.value).slice(0,38)}"</em>` : `${e} Isi kolom teks`;
      case 'select':           return s.excelColumn ? `${e} Pilih dari Excel (<strong>${s.excelColumn}</strong>)` : s.value ? `${e} Pilih: <em>"${String(s.value).slice(0,38)}"</em>` : `${e} Pilih dari dropdown`;
      case 'click':            return s.value ? `${e} Klik tombol <em>"${String(s.value).slice(0,38)}"</em>` : `${e} Klik elemen`;
      case 'click_button':     return `${e} Klik per teks: <em>"${String(s.buttonText||s.value||'').slice(0,38)}"</em>`;
      case 'wait_button':      return `${e} Tunggu tombol <em>"${String(s.buttonText||s.value||'').slice(0,38)}"</em>`;
      case 'navigate':         return `${e} Buka halaman`;
      case 'wait':             return `${e} Tunggu ${s.value||''}ms`;
      case 'scroll':           return `${e} Scroll halaman`;
      case 'date_picker':      return s.excelColumn ? `${e} Pilih tanggal dari Excel (<strong>${s.excelColumn}</strong>)` : `${e} Pilih tanggal`;
      case 'select_dropdown':  return s.excelColumn ? `${e} Dropdown: kolom <strong>${s.excelColumn}</strong>` : s.value ? `${e} Dropdown: <em>"${String(s.value).slice(0,35)}"</em>` : `${e} Pilih dropdown kustom`;
      case 'select_antrian':   return s.excelColumn ? `${e} Pilih tanggal periksa dari Excel (<strong>${s.excelColumn}</strong>)` : `${e} Pilih tanggal pemeriksaan`;
      case 'select_pekerjaan': return s.excelColumn ? `${e} Pekerjaan dari Excel (<strong>${s.excelColumn}</strong>)` : s.value ? `${e} Pekerjaan: <em>"${String(s.value).slice(0,35)}"</em>` : `${e} Pilih pekerjaan`;
      case 'select_alamat':    return `${e} Isi Provinsi → Kabupaten → Kecamatan → Kelurahan`;
      default:                 return `${e} ${s.type}`;
    }
  }

  const metaHTML = isExpert
    ? `${selLine}${valueLine}${btnText}${excelBadge}`
    : `<span class="bld-smeta-human">${humanDesc(step)}</span>`;

  card.innerHTML = `
    <span class="bld-drag-handle" title="Drag untuk urutkan">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    </span>
    <span class="bld-snum">${idx + 1}</span>
    <div class="bld-sbody">
      <div class="bld-stop">
        <span class="bld-sbadge bld-badge-${step.type}">${step.type}</span>
        <span class="bld-slabel">${step.label || '(tanpa label)'}</span>
      </div>
      <div class="bld-smeta">${metaHTML}</div>
    </div>
    <div class="bld-sacts">
      <button class="bld-icon-btn bld-btn-test" title="Uji step">▶</button>
      <button class="bld-icon-btn bld-btn-dup" title="Duplikat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="bld-icon-btn bld-btn-edit" title="Edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="bld-icon-btn bld-btn-del" title="Hapus">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.bld-btn-edit').addEventListener('click', () => openModal(idx));
  card.querySelector('.bld-btn-del').addEventListener('click',  () => deleteStep(idx));
  card.querySelector('.bld-btn-dup').addEventListener('click',  () => duplicateStep(idx));
  card.querySelector('.bld-btn-test').addEventListener('click', () => testStep(step, card));

  card.addEventListener('dragstart', e => { dragSrcIdx = idx; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  card.addEventListener('dragend',   () => card.classList.remove('dragging'));
  card.addEventListener('dragover',  e => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.bld-step-card').forEach(c => c.classList.remove('drag-over'));
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
  copy.label += ' (copy)';
  steps.splice(idx + 1, 0, copy);
  await saveTemplate(currentWf);
  renderStepList();
  showToast('Step diduplikat', 'success');
}

async function testStep(step, cardEl) {
  const btn = cardEl?.querySelector('.bld-btn-test');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_test_step', step });
    const ok  = res?.ok && res?.result?.success;
    const msg = res?.result?.message || (ok ? 'Berhasil' : 'Gagal');
    showToast(ok ? `✅ ${step.label}: ${msg}` : `❌ ${step.label}: ${msg}`, ok ? 'success' : 'error');
    if (cardEl) {
      cardEl.classList.remove('test-ok', 'test-fail');
      cardEl.classList.add(ok ? 'test-ok' : 'test-fail');
      setTimeout(() => cardEl.classList.remove('test-ok', 'test-fail'), 2500);
    }
  } catch (e) {
    showToast(`❌ Uji gagal: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶'; }
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
  document.querySelectorAll('.bld-type-card').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  applyTypeConfig(type);

  setVal('fLabel',     step?.label || '');
  setVal('fSelector',  step?.selector || '');
  // click_button & wait_button menyimpan teks di field buttonText (atau fallback ke value)
  const isButtonType = ['click_button', 'wait_button'].includes(type);
  setVal('fValue',     isButtonType ? (step?.buttonText ?? step?.value ?? '') : (step?.value ?? ''));
  setVal('fExcelCol',  step?.excelColumn || '');
  setVal('fCondition', step?.condition ? JSON.stringify(step.condition) : '');
  setVal('fMaxRetry',  step?.recovery?.maxRetry ?? 3);
  setVal('fWaitMs',    step?.recovery?.waitMs ?? 1500);

  const advBody = document.getElementById('advBody');
  const advChev = document.querySelector('.adv-chevron');
  advBody?.classList.add('hidden');
  advChev?.classList.remove('open');
  if (step?.condition) { advBody?.classList.remove('hidden'); advChev?.classList.add('open'); }

  applyModeToModal();
  document.getElementById('modalBackdrop')?.classList.remove('hidden');
  document.getElementById('fLabel')?.focus();
}

function closeModal() {
  document.getElementById('modalBackdrop')?.classList.add('hidden');
  editingIdx = null;
}

function applyTypeConfig(type) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.click;
  const isExpert = builderMode === 'expert';

  // ── Info banner untuk tipe yang tidak butuh konfigurasi manual ─────────
  let infoBanner = document.getElementById('bldTypeInfoBanner');
  if (cfg.infoText) {
    if (!infoBanner) {
      infoBanner = document.createElement('div');
      infoBanner.id = 'bldTypeInfoBanner';
      infoBanner.style.cssText = 'margin:6px 0 2px;padding:8px 12px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:8px;font-size:11px;color:#6366f1;line-height:1.5';
      const fgVal = document.getElementById('fgValue');
      fgVal?.parentNode?.insertBefore(infoBanner, fgVal);
    }
    infoBanner.textContent = cfg.infoText;
    infoBanner.style.display = '';
  } else if (infoBanner) {
    infoBanner.style.display = 'none';
  }

  const fgSel = document.getElementById('fgSelector');
  if (fgSel) {
    fgSel.style.display = !isExpert ? 'none' : (cfg.showSelector ? '' : 'none');
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

  let n = 3;
  const valNum   = document.getElementById('valueStepNum');
  const excelNum = document.getElementById('excelStepNum');
  if (!cfg.showSelector) n--;
  if (cfg.showValue  && valNum)   valNum.textContent   = n + 1;
  if (cfg.showExcel  && excelNum) excelNum.textContent = n + 2;
}

function bindModal() {
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);
  document.getElementById('modalBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  document.querySelectorAll('.bld-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.bld-type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyTypeConfig(card.dataset.type);
    });
  });

  document.getElementById('advToggle')?.addEventListener('click', () => {
    const body = document.getElementById('advBody');
    const chev = document.querySelector('.adv-chevron');
    const isOpen = !body.classList.contains('hidden');
    body.classList.toggle('hidden', isOpen);
    chev?.classList.toggle('open', !isOpen);
  });

  document.getElementById('btnSaveStep')?.addEventListener('click', saveStep);
}

async function saveStep() {
  const type  = document.querySelector('.bld-type-card.active')?.dataset.type || 'click';
  const label = document.getElementById('fLabel').value.trim();
  if (!label) { showToast('Nama step wajib diisi', 'error'); return; }

  let condition = null;
  const condRaw = document.getElementById('fCondition').value.trim();
  if (condRaw) {
    try { condition = JSON.parse(condRaw); }
    catch { showToast('Kondisi bukan format JSON yang valid', 'error'); return; }
  }

  const rawValue = document.getElementById('fValue').value.trim();
  const cfg = TYPE_CONFIG[type] || {};

  // click_button & wait_button simpan teks di buttonText, bukan value
  const isButtonType = cfg.isButtonText === true;

  const step = {
    type, label,
    selector:    document.getElementById('fSelector').value.trim() || null,
    value:       isButtonType ? null : parseStepValue(type, rawValue),
    buttonText:  isButtonType ? (rawValue || null) : undefined,
    excelColumn: document.getElementById('fExcelCol').value || null,
    placeholder: document.getElementById('fSelector').dataset.placeholder || undefined,
    condition,
    recovery: {
      maxRetry: parseInt(document.getElementById('fMaxRetry').value) || 3,
      waitMs:   parseInt(document.getElementById('fWaitMs').value)   || 1500,
    }
  };

  // Hapus key undefined agar JSON tetap bersih
  Object.keys(step).forEach(k => { if (step[k] === undefined) delete step[k]; });

  const steps = templates[currentWf].steps;
  if (editingIdx !== null) { steps[editingIdx] = step; } else { steps.push(step); }
  await saveTemplate(currentWf);
  closeModal();
  renderStepList();
  showToast(editingIdx !== null ? 'Step diperbarui ✓' : 'Step ditambahkan ✓', 'success');
}

function parseStepValue(type, raw) {
  if (!raw) return null;
  if (type === 'wait') return parseInt(raw) || 1500;
  return raw;
}

// ── Workflow Modal ────────────────────────────────────────────────────────────

function openWfModal(mode, wf = null) {
  editingWfKey = wf;
  const isRename = mode === 'rename';
  document.getElementById('wfModalTitle').textContent     = isRename ? 'Ganti Nama Workflow' : 'Tambah Workflow Baru';
  document.getElementById('wfModalSaveLabel').textContent = isRename ? 'Simpan' : 'Buat Workflow';
  document.getElementById('wfKeyGroup').style.display     = isRename ? 'none' : '';
  setVal('wfDisplayName', isRename ? (wfDisplay[wf] || wf) : '');
  setVal('wfKey', isRename ? (wf || '') : '');
  document.getElementById('wfModalBackdrop')?.classList.remove('hidden');
  document.getElementById('wfDisplayName')?.focus();
}

function closeWfModal() {
  document.getElementById('wfModalBackdrop')?.classList.add('hidden');
  editingWfKey = null;
}

function bindWfModal() {
  document.getElementById('btnAddWorkflow')?.addEventListener('click', () => openWfModal('add'));
  document.getElementById('wfModalClose')?.addEventListener('click', closeWfModal);
  document.getElementById('wfModalCancel')?.addEventListener('click', closeWfModal);
  document.getElementById('wfModalBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeWfModal(); });
  document.getElementById('wfDisplayName')?.addEventListener('input', e => {
    if (editingWfKey !== null) return;
    document.getElementById('wfKey').value = toWfKey(e.target.value);
  });
  document.getElementById('wfModalSave')?.addEventListener('click', saveWfModal);
}

async function saveWfModal() {
  const displayName = document.getElementById('wfDisplayName').value.trim();
  if (!displayName) { showToast('Nama workflow wajib diisi', 'error'); return; }
  if (editingWfKey !== null) {
    await renameWorkflow(editingWfKey, displayName);
    closeWfModal(); renderSidebar(); renderStepList();
    showToast(`Workflow diganti menjadi "${displayName}" ✓`, 'success');
  } else {
    const key = document.getElementById('wfKey').value.trim();
    if (!key) { showToast('ID workflow wajib diisi', 'error'); return; }
    if (!/^[a-z0-9_]+$/.test(key)) { showToast('ID hanya boleh huruf kecil, angka, underscore', 'error'); return; }
    if (workflows.includes(key)) { showToast(`ID "${key}" sudah digunakan`, 'error'); return; }
    const ok = await addWorkflow(key, displayName);
    if (!ok) return;
    closeWfModal(); currentWf = key; renderSidebar(); renderStepList();
    showToast(`Workflow "${displayName}" dibuat ✓`, 'success');
  }
}

// ── JSON Modal ────────────────────────────────────────────────────────────────

function openJSONModal() {
  document.getElementById('jsonModalWf').textContent  = currentWf;
  document.getElementById('jsonPreview').textContent  = JSON.stringify(templates[currentWf], null, 2);
  document.getElementById('jsonBackdrop')?.classList.remove('hidden');
}

function bindJSONModal() {
  document.getElementById('jsonModalClose')?.addEventListener('click', () => document.getElementById('jsonBackdrop')?.classList.add('hidden'));
  document.getElementById('jsonBackdrop')?.addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('jsonBackdrop')?.classList.add('hidden'); });
  document.getElementById('btnCopyJSON')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('jsonPreview').textContent)
      .then(() => showToast('JSON disalin', 'success'));
  });
  document.getElementById('btnDownloadJSON')?.addEventListener('click', () => {
    downloadBlob(document.getElementById('jsonPreview').textContent, `${currentWf}.json`, 'application/json');
    showToast('JSON diunduh', 'success');
  });
}

// ── Import / Export / Reset ───────────────────────────────────────────────────

function bindImportExport() {
  const importInput = document.getElementById('importInput');
  document.getElementById('btnImport')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Format tidak valid');
      let wf = parsed.meta?.name;
      if (!workflows.includes(wf)) {
        const guessed = workflows.find(w => file.name.includes(w));
        if (guessed) { wf = guessed; }
        else if (wf) { await addWorkflow(wf, parsed.meta?.displayName || wf); }
        else { wf = currentWf; }
      }
      templates[wf] = parsed;
      await saveTemplate(wf);
      currentWf = wf; renderSidebar(); renderStepList();
      showToast(`Template "${wf}" diimpor (${parsed.steps.length} steps)`, 'success');
    } catch (err) {
      showToast('Import gagal: ' + err.message, 'error');
    }
    importInput.value = '';
  });

  document.getElementById('btnExport')?.addEventListener('click', () => {
    downloadBlob(JSON.stringify(templates[currentWf], null, 2), `${currentWf}.json`, 'application/json');
    showToast(`Template "${currentWf}" diekspor`, 'success');
  });

  document.getElementById('btnResetDefault')?.addEventListener('click', async () => {
    const label = wfDisplay[currentWf] || currentWf;
    if (!confirm(`Reset template "${label}" ke default bawaan? Data kustom akan hilang.`)) return;
    await storage.remove(`template_${currentWf}`);
    if (BUILTIN_WORKFLOWS.includes(currentWf)) {
      try {
        const r = await fetch(chrome.runtime.getURL(`templates/${currentWf}.json`));
        templates[currentWf] = await r.json();
      } catch { templates[currentWf] = makeEmptyTemplate(currentWf); }
    } else {
      templates[currentWf] = makeEmptyTemplate(currentWf);
    }
    renderStepList();
    showToast(`Template "${label}" direset`, 'success');
  });
}

// ── Recorder JSON Parser ──────────────────────────────────────────────────────

const FIELD_TO_EXCEL = {
  'NIK':'NIK','Nama':'Nama','TTL':'TTL','Jenis_Kelamin':'Jenis_Kelamin',
  'No_WA':'No_WA','Pekerjaan':'Pekerjaan','Alamat':'Alamat','Provinsi':'Provinsi',
  'Kabupaten':'Kabupaten','Kecamatan':'Kecamatan','Kelurahan':'Kelurahan',
  'Status_Nikah':'Status_Nikah','BB':'BB','TB':'TB','GDS':'GDS',
  'TD_Sistolik':'TD_Sistolik','TD_Diastolik':'TD_Diastolik','Diagnosa':'Diagnosa',
  'Tgl_Periksa':'Tgl_Periksa','Tanggal_Periksa':'Tgl_Periksa','No_Antrian':'Tgl_Periksa',
  'masukkan nik':'NIK','masukkan nama lengkap':'Nama','no. whatsapp':'No_WA',
  'berat badan':'BB','tinggi badan':'TB','gula darah sewaktu':'GDS',
  'sistole':'TD_Sistolik','diastole':'TD_Diastolik',
};

function bestSelector(el) {
  if (el.id && !el.id.includes(' '))     return `#${el.id}`;
  if (el.name && !el.name.includes(' ')) return `[name="${el.name}"]`;
  if (el.placeholder)                    return `[placeholder="${el.placeholder}"]`;
  const parts = (el.selector || '').split(' > ');
  const last  = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  const generic = ['div','span','i','button'];
  if (generic.includes(last.split('.')[0]) && second) return `${second} > ${last}`;
  return last || el.selector || '';
}

function resolveExcelColumn(el) {
  for (const c of [el.name, el.id, el.placeholder?.toLowerCase(), el.ariaLabel]) {
    if (!c) continue;
    if (FIELD_TO_EXCEL[c]) return FIELD_TO_EXCEL[c];
    if (FIELD_TO_EXCEL[c.toLowerCase()]) return FIELD_TO_EXCEL[c.toLowerCase()];
  }
  return null;
}

function isDatePicker(recStep) {
  const sel = recStep.element?.selector || '';
  const cls = (recStep.element?.classes || []).join(' ');
  return sel.includes('mx-datepicker') || cls.includes('mx-') || recStep.element?.id?.includes('Tanggal');
}

function isSelectElement(recStep) {
  return recStep.element?.tag === 'select' || recStep.element?.tag === 'option';
}

function parseRecorderJSON(recorderData) {
  const raw   = recorderData.steps || [];
  const steps = [];
  const seen  = new Set();
  const firstUrl = raw[0]?.pageUrl;
  if (firstUrl) steps.push({ type:'navigate', label:'Buka halaman', selector:null, value:firstUrl, excelColumn:null, condition:null, recovery:{ maxRetry:2, waitMs:2000 } });

  let i = 0;
  while (i < raw.length) {
    const rec = raw[i];
    const el  = rec.element || {};
    const recType = rec.type;
    if (recType === 'submit' || recType === 'dblclick') { i++; continue; }
    if (recType === 'click' && (el.tag === 'input' || el.tag === 'textarea') && el.type !== 'checkbox' && el.type !== 'radio') { i++; continue; }

    const dedupeKey = `${recType}|${el.selector}`;
    if ((recType === 'input' || recType === 'change') && (seen.has(`change|${el.selector}`) || seen.has(`input|${el.selector}`))) { i++; continue; }
    seen.add(dedupeKey);

    if (isDatePicker(rec) && recType === 'click') {
      const excol = resolveExcelColumn(el) || 'TTL';
      let j = i + 1;
      while (j < raw.length && isDatePicker(raw[j])) j++;
      steps.push({ type:'date_picker', label:`Pilih tanggal (${excol})`, selector: bestSelector(el) || '.mx-input-wrapper', value:null, excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:1000 } });
      i = j; continue;
    }

    if (recType === 'input' || recType === 'change') {
      const excol = resolveExcelColumn(el);
      steps.push({ type:'type', label:`Isi ${el.placeholder || el.name || el.id || 'field'}`, selector:bestSelector(el), value:excol ? null : (rec.value || el.value || null), excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:500 } });
      i++; continue;
    }

    if (isSelectElement(rec)) {
      const excol = resolveExcelColumn(el);
      steps.push({ type:'select', label:`Pilih ${el.placeholder || el.name || el.id || 'dropdown'}`, selector:bestSelector(el), value:excol ? null : (rec.value || el.value || null), excelColumn:excol, condition:null, recovery:{ maxRetry:2, waitMs:500 } });
      i++; continue;
    }

    if (recType === 'click') {
      const text = el.text?.trim();
      steps.push({ type:'click', label: text ? `Klik "${text.slice(0,40)}"` : `Klik ${el.tag}`, selector:bestSelector(el), value:text||null, excelColumn:null, condition:null, recovery:{ maxRetry:3, waitMs:1000 } });
      i++; continue;
    }
    i++;
  }
  return steps;
}

// ── Import Recorder ───────────────────────────────────────────────────────────

function bindImportRecorder() {
  const input = document.getElementById('recorderInput');
  document.getElementById('btnImportRecorder')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error('Bukan file recorder yang valid');
      if (!parsed.meta?.totalSteps) throw new Error('Format recorder tidak dikenal');
      const detectedWf = workflows.find(w => (parsed.steps[0]?.pageUrl||'').includes(w) || file.name.includes(w)) || currentWf;
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
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.72)',
    'z-index:9999', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:20px',
    'backdrop-filter:blur(4px)',
  ].join(';');

  const typeColors = {
    navigate:'#6366f1', type:'#0ea5e9', click:'#f59e0b',
    select:'#8b5cf6', date_picker:'#ec4899', wait:'#64748b',
    click_button:'#f59e0b', wait_button:'#64748b',
  };

  const stepRows = steps.map((s, i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:5px 8px;color:#475569;font-size:11px;text-align:center">${i+1}</td>
      <td style="padding:5px 8px">
        <span style="background:${typeColors[s.type]||'#475569'};color:white;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:0.03em">${s.type}</span>
      </td>
      <td style="padding:5px 8px;font-size:11px;color:#e2e8f0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.label}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:10px;color:#94a3b8;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.selector||'—'}</td>
      <td style="padding:5px 8px;font-size:10px;color:#34d399;white-space:nowrap">${s.excelColumn||(s.value?`"${String(s.value).slice(0,16)}"` : '—')}</td>
    </tr>
  `).join('');

  const wfOptions = workflows.map(w =>
    `<option value="${w}" ${w===wf?'selected':''}>${wfDisplay[w]||w}</option>`
  ).join('');

  // Buat nama default untuk workflow baru dari waktu rekam
  const nowStr = new Date().toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).replace(/\./g, ':');
  const defaultNewName = `Rekaman ${nowStr}`;

  backdrop.innerHTML = `
    <div style="background:#1a2236;border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:760px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,0.65);">

      <!-- Header -->
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <div style="font-weight:700;color:#f1f5f9;font-size:14px;display:flex;align-items:center;gap:8px">
            🎬 Rekaman Selesai
            <span style="background:rgba(99,102,241,0.18);color:#818cf8;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600">${steps.length} steps</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">${meta?.totalSteps||0} aksi direkam → <strong style="color:#38bdf8">${steps.length} steps CKG</strong> siap disimpan</div>
        </div>
        <button id="recorderPreviewClose" style="background:rgba(255,255,255,0.06);border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:6px 9px;border-radius:8px;line-height:1;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">✕</button>
      </div>

      <!-- Save Mode Selector -->
      <div style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">
        <div style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.05em;margin-bottom:10px">SIMPAN KE</div>
        <div style="display:flex;flex-direction:column;gap:8px" id="recSaveModes">

          <!-- Opsi 1: Buat Workflow Baru -->
          <label id="recModeNewLabel" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:2px solid #6366f1;background:rgba(99,102,241,0.1);cursor:pointer;transition:all 0.15s">
            <input type="radio" name="recSaveMode" value="new" checked style="accent-color:#6366f1;width:15px;height:15px;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:#a5b4fc">✨ Buat Workflow Baru</div>
              <div style="font-size:10.5px;color:#64748b;margin-top:2px">Simpan sebagai workflow baru — tidak menimpa yang sudah ada</div>
              <!-- Input nama workflow baru -->
              <div id="recNewNameWrap" style="margin-top:8px;display:flex;gap:6px;align-items:center">
                <input id="recNewWfName" type="text" value="${defaultNewName}"
                  style="flex:1;background:#0f172a;border:1px solid rgba(99,102,241,0.4);border-radius:7px;color:#f1f5f9;padding:5px 10px;font-size:12px;outline:none;min-width:0"
                  placeholder="Nama workflow baru…">
                <span style="font-size:10px;color:#475569;white-space:nowrap">${steps.length} steps</span>
              </div>
            </div>
          </label>

          <!-- Opsi 2: Tambahkan ke Workflow Ada -->
          <label id="recModeAppendLabel" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:2px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);cursor:pointer;transition:all 0.15s">
            <input type="radio" name="recSaveMode" value="append" style="accent-color:#0ea5e9;width:15px;height:15px;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:#7dd3fc">📥 Tambahkan ke Workflow</div>
              <div style="font-size:10.5px;color:#64748b;margin-top:2px">Steps ditambahkan di akhir workflow yang dipilih</div>
              <div id="recAppendWfWrap" style="margin-top:8px;display:none">
                <select id="recAppendWfSelect" style="background:#0f172a;border:1px solid rgba(14,165,233,0.35);border-radius:7px;color:#f1f5f9;padding:5px 10px;font-size:12px;width:100%">${wfOptions}</select>
              </div>
            </div>
          </label>

          <!-- Opsi 3: Timpa Workflow Ada -->
          <label id="recModeReplaceLabel" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:2px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);cursor:pointer;transition:all 0.15s">
            <input type="radio" name="recSaveMode" value="replace" style="accent-color:#f87171;width:15px;height:15px;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:#fca5a5">⚠️ Timpa Workflow yang Ada</div>
              <div style="font-size:10.5px;color:#64748b;margin-top:2px">Semua steps lama akan dihapus dan diganti dengan rekaman ini</div>
              <div id="recReplaceWfWrap" style="margin-top:8px;display:none">
                <select id="recReplaceWfSelect" style="background:#0f172a;border:1px solid rgba(248,113,113,0.35);border-radius:7px;color:#f1f5f9;padding:5px 10px;font-size:12px;width:100%">${wfOptions}</select>
              </div>
            </div>
          </label>

        </div>
      </div>

      <!-- Step Table Preview -->
      <div style="overflow-y:auto;flex:1;padding:0 20px 8px">
        <div style="font-size:10px;font-weight:600;color:#475569;letter-spacing:0.05em;padding:10px 0 6px">PREVIEW STEPS</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
            <th style="padding:5px 8px;text-align:center;font-size:10px;color:#475569;width:30px">#</th>
            <th style="padding:5px 8px;text-align:left;font-size:10px;color:#475569">TYPE</th>
            <th style="padding:5px 8px;text-align:left;font-size:10px;color:#475569">LABEL</th>
            <th style="padding:5px 8px;text-align:left;font-size:10px;color:#475569">SELECTOR</th>
            <th style="padding:5px 8px;text-align:left;font-size:10px;color:#475569">EXCEL/VALUE</th>
          </tr></thead>
          <tbody>${stepRows}</tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <span style="font-size:11px;color:#475569">Klik step untuk edit setelah disimpan</span>
        <div style="display:flex;gap:8px">
          <button id="recorderPreviewCancel" style="padding:7px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#94a3b8;cursor:pointer;font-size:12px;font-weight:500">Batal</button>
          <button id="recorderPreviewSave" style="padding:7px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 3px 12px rgba(99,102,241,0.4)">
            ✓ Simpan ${steps.length} Steps
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(backdrop);
  backdrop._steps = steps;

  // ── Interaksi radio buttons ─────────────────────────────────────────────
  const radios       = backdrop.querySelectorAll('input[name="recSaveMode"]');
  const labels       = {
    new:     backdrop.querySelector('#recModeNewLabel'),
    append:  backdrop.querySelector('#recModeAppendLabel'),
    replace: backdrop.querySelector('#recModeReplaceLabel'),
  };
  const subPanels    = {
    new:     backdrop.querySelector('#recNewNameWrap'),
    append:  backdrop.querySelector('#recAppendWfWrap'),
    replace: backdrop.querySelector('#recReplaceWfWrap'),
  };

  const ACTIVE_BORDERS = {
    new:     '#6366f1',
    append:  '#0ea5e9',
    replace: '#f87171',
  };
  const ACTIVE_BG = {
    new:     'rgba(99,102,241,0.10)',
    append:  'rgba(14,165,233,0.08)',
    replace: 'rgba(248,113,113,0.08)',
  };

  function _applyMode(selectedMode) {
    for (const [mode, label] of Object.entries(labels)) {
      const isActive = mode === selectedMode;
      label.style.borderColor = isActive ? ACTIVE_BORDERS[mode] : 'rgba(255,255,255,0.08)';
      label.style.background  = isActive ? ACTIVE_BG[mode]      : 'rgba(255,255,255,0.02)';
      subPanels[mode].style.display = isActive ? '' : 'none';
    }
    // Update tombol save
    const saveBtn = backdrop.querySelector('#recorderPreviewSave');
    if (selectedMode === 'replace') {
      saveBtn.style.background = 'linear-gradient(135deg,#dc2626,#b91c1c)';
      saveBtn.style.boxShadow  = '0 3px 12px rgba(220,38,38,0.4)';
      saveBtn.textContent      = `⚠️ Timpa & Simpan ${steps.length} Steps`;
    } else if (selectedMode === 'append') {
      saveBtn.style.background = 'linear-gradient(135deg,#0284c7,#0ea5e9)';
      saveBtn.style.boxShadow  = '0 3px 12px rgba(14,165,233,0.35)';
      saveBtn.textContent      = `📥 Tambahkan ${steps.length} Steps`;
    } else {
      saveBtn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
      saveBtn.style.boxShadow  = '0 3px 12px rgba(99,102,241,0.4)';
      saveBtn.textContent      = `✨ Buat & Simpan ${steps.length} Steps`;
    }
  }

  // Init state
  _applyMode('new');

  radios.forEach(radio => {
    radio.addEventListener('change', () => _applyMode(radio.value));
  });

  // ── Close ───────────────────────────────────────────────────────────────
  const close = () => backdrop.remove();
  backdrop.querySelector('#recorderPreviewClose')?.addEventListener('click', close);
  backdrop.querySelector('#recorderPreviewCancel')?.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  // ── Save ────────────────────────────────────────────────────────────────
  backdrop.querySelector('#recorderPreviewSave')?.addEventListener('click', async () => {
    const selectedRadio = backdrop.querySelector('input[name="recSaveMode"]:checked');
    const mode          = selectedRadio?.value || 'new';
    const newSteps      = backdrop._steps;

    if (mode === 'new') {
      // Buat workflow baru
      const rawName = backdrop.querySelector('#recNewWfName')?.value?.trim();
      if (!rawName) { showToast('Nama workflow tidak boleh kosong', 'error'); return; }

      // Generate key dari nama
      const key = rawName.toLowerCase()
        .replace(/[^a-z0-9\s_]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 30);
      if (!key) { showToast('Nama tidak valid — gunakan huruf atau angka', 'error'); return; }

      // Pastikan key unik — tambahkan suffix jika perlu
      let finalKey = key;
      let suffix   = 1;
      while (workflows.includes(finalKey)) {
        finalKey = `${key}_${suffix++}`;
      }

      const ok = await addWorkflow(finalKey, rawName);
      if (!ok) return;
      templates[finalKey].steps = newSteps;
      await saveTemplate(finalKey);
      currentWf = finalKey;
      renderSidebar();
      renderStepList();
      close();
      showToast(`✨ Workflow "${rawName}" dibuat dengan ${newSteps.length} steps`, 'success');

    } else if (mode === 'append') {
      const targetWf = backdrop.querySelector('#recAppendWfSelect')?.value;
      if (!targetWf) { showToast('Pilih workflow tujuan', 'error'); return; }
      templates[targetWf].steps.push(...newSteps);
      await saveTemplate(targetWf);
      currentWf = targetWf;
      renderSidebar();
      renderStepList();
      close();
      showToast(`📥 ${newSteps.length} steps ditambahkan ke "${wfDisplay[targetWf]||targetWf}"`, 'success');

    } else if (mode === 'replace') {
      const targetWf = backdrop.querySelector('#recReplaceWfSelect')?.value;
      if (!targetWf) { showToast('Pilih workflow yang akan ditimpa', 'error'); return; }
      const label    = wfDisplay[targetWf] || targetWf;
      const existing = templates[targetWf]?.steps?.length || 0;
      if (existing > 0 && !confirm(`Timpa "${label}"? ${existing} steps yang ada akan dihapus permanen.`)) return;
      templates[targetWf].steps = newSteps;
      await saveTemplate(targetWf);
      currentWf = targetWf;
      renderSidebar();
      renderStepList();
      close();
      showToast(`⚠️ "${label}" ditimpa dengan ${newSteps.length} steps baru`, 'success');
    }
  });
}

// ── Recorder live ─────────────────────────────────────────────────────────────


function bindRecorder() {
  const btnRecord  = document.getElementById('btnRecord');
  const btnStop    = document.getElementById('btnStopRecord');
  const recCount   = document.getElementById('recordCount');
  if (!btnRecord) return;

  // ── Listener: Stop dari floating toolbar DI HALAMAN TARGET ──────────────
  // background.js broadcast 'ckg_record_done' setelah buffer dikumpulkan.
  // Ini memastikan preview + tombol Save muncul di Builder meski Stop diklik
  // dari toolbar di halaman sehatindonesiaku (bukan dari tombol di ekstensi ini).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== 'ckg_record_done') return;
    // Reset tombol recorder di UI
    btnStop.classList.add('hidden');
    btnRecord.classList.remove('hidden');
    if (recCount) recCount.textContent = '0';
    // Pindah ke tab Builder agar user langsung lihat preview + tombol Save
    const builderTab = document.getElementById('tabBtnBuilder') || document.querySelector('[data-tab="builder"]');
    if (builderTab) builderTab.click();
    // Proses buffer → tampilkan preview dengan tombol Save
    _processBuffer(msg.buffer || []);
  });


  btnRecord.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_start_record' });
    if (!res?.ok) { showToast('Rekam gagal: ' + (res?.error || 'Tidak ada tab aktif'), 'error'); return; }
    btnRecord.classList.add('hidden');
    btnStop.classList.remove('hidden');
    if (recCount) recCount.textContent = '0';
    // Tab target dibuka otomatis — toolbar akan muncul di sana
    showToast('🔴 Halaman target dibuka. Gunakan toolbar merah di halaman itu untuk Stop/Undo/Pause.', 'success');
  });

  btnStop.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_stop_record' });
    btnStop.classList.add('hidden');
    btnRecord.classList.remove('hidden');
    if (recCount) recCount.textContent = '0';
    _processBuffer(res?.buffer || []);
  });

  function _processBuffer(buffer) {
    if (!buffer.length) { showToast('Tidak ada aksi yang direkam', 'error'); return; }
    const rawData = {
      steps: buffer.map(ev => ({
        type: ev.type, pageUrl: null,
        element: { tag:ev.tag, id:ev.id, name:ev.name, placeholder:ev.placeholder, selector:ev.selector, text:ev.text, classes:[] },
        value: ev.value,
      })),
      meta: { totalSteps: buffer.length },
    };
    const ckgSteps = parseRecorderJSON(rawData);
    if (!ckgSteps.length) { showToast('Tidak ada step yang berhasil diparse', 'error'); return; }
    openRecorderPreview(currentWf, ckgSteps, rawData.meta);
    showToast(`✅ ${ckgSteps.length} step berhasil direkam`, 'success');
  }
}

// ── Element Picker ────────────────────────────────────────────────────────────

function bindPicker() {
  const btnPick = document.getElementById('btnPickElement');
  if (!btnPick) return;
  let _pickListener = null;

  btnPick.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'ckg_start_pick' });
    if (!res?.ok) { showToast('Picker gagal: ' + (res?.error || 'Tidak ada tab aktif'), 'error'); return; }
    btnPick.classList.add('picking');
    btnPick.textContent = '… Pilih elemen';
    showToast('🎯 Klik elemen di tab aktif. Esc untuk batal.', '');

    if (_pickListener) { chrome.runtime.onMessage.removeListener(_pickListener); _pickListener = null; }

    _pickListener = msg => {
      if (msg.action === 'ckg_element_picked') {
        const inp = document.getElementById('fSelector');
        if (inp) { inp.value = msg.selector; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        showToast(`✅ Selector: ${msg.selector}`, 'success');
        _reset();
      } else if (msg.action === 'ckg_pick_cancelled') {
        showToast('Pemilihan elemen dibatalkan', '');
        _reset();
      }
    };
    chrome.runtime.onMessage.addListener(_pickListener);

    function _reset() {
      btnPick.classList.remove('picking');
      btnPick.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> + Pilih`;
      if (_pickListener) { chrome.runtime.onMessage.removeListener(_pickListener); _pickListener = null; }
    }
  });
}

// ── Marketplace ───────────────────────────────────────────────────────────────

const MARKETPLACE_ITEMS = [
  { key:'pendaftaran', displayName:'Pendaftaran Baru', icon:'👤', description:'Otomasi daftar pasien baru: NIK, nama, TTL, jenis kelamin, alamat, faskes', tags:['pendaftaran','pasien baru'], file:'templates/marketplace/pendaftaran.json', stepCount:26, targetWf:'pendaftaran', author:'KlikPro Official' },
  { key:'konfirmasi', displayName:'Konfirmasi Hadir', icon:'✅', description:'Konfirmasi kehadiran pasien yang sudah terdaftar di antrian', tags:['konfirmasi','hadir'], file:'templates/marketplace/konfirmasi.json', stepCount:8, targetWf:'konfirmasi', author:'KlikPro Official' },
  { key:'kuesioner', displayName:'Isi Kuesioner', icon:'📋', description:'Isi seluruh section kuesioner CKG menggunakan jawaban bawaan quiz_rules', tags:['kuesioner','quiz'], file:'templates/marketplace/kuesioner.json', stepCount:10, targetWf:'kuesioner', author:'KlikPro Official' },
  { key:'pemeriksaan', displayName:'Input Pemeriksaan', icon:'🩺', description:'Input BB, TB, GDS, tekanan darah sistolik & diastolik', tags:['pemeriksaan','bb','tb'], file:'templates/marketplace/pemeriksaan.json', stepCount:20, targetWf:'pemeriksaan', author:'KlikPro Official' },
  { key:'selesai', displayName:'Selesaikan Layanan', icon:'🏁', description:'Klik Selesaikan Layanan dan konfirmasi modal', tags:['selesai','layanan'], file:'templates/marketplace/selesai.json', stepCount:4, targetWf:'selesai', author:'KlikPro Official' },
  { key:'lengkap', displayName:'Bundle Lengkap CKG', icon:'📦', description:'Paket komplit 5 workflow: Pendaftaran → Konfirmasi → Kuesioner → Pemeriksaan → Selesai', tags:['bundle','lengkap'], file:'templates/marketplace/lengkap.json', stepCount:null, targetWf:null, bundle:true, author:'KlikPro Official' },
];

function switchView(view) {
  currentView = view;
  const stepList    = document.getElementById('stepList');
  const flowList    = document.getElementById('flowList');
  const marketPanel = document.getElementById('marketplacePanel');
  const topbarRight = document.querySelector('.bld-topbar-right');
  const viewToggle  = document.getElementById('viewToggle');
  const btnMkt      = document.getElementById('btnMarketplace');
  const isMarket    = view === 'marketplace';

  stepList?.classList.toggle('hidden', isMarket);
  flowList?.classList.toggle('hidden', true);
  marketPanel?.classList.toggle('hidden', !isMarket);
  viewToggle?.classList.toggle('hidden', isMarket);
  topbarRight?.classList.toggle('hidden', isMarket);
  btnMkt?.classList.toggle('active', isMarket);

  if (isMarket) {
    document.getElementById('pageTitle').textContent = 'Marketplace';
    document.getElementById('stepCount').textContent = '';
    renderMarketplace();
  } else {
    stepView = 'list';
    document.getElementById('btnViewList')?.classList.add('active');
    document.getElementById('btnViewFlow')?.classList.remove('active');
    renderSidebar(); renderStepList();
  }
}

async function renderMarketplace() {
  const grid = document.getElementById('marketplaceGrid');
  if (!grid) return;
  const installedSteps = {};
  for (const wf of workflows) installedSteps[wf] = templates[wf]?.steps?.length || 0;

  grid.innerHTML = MARKETPLACE_ITEMS.map(item => {
    const tags     = item.tags.map(t => `<span class="bld-mkt-tag">${t}</span>`).join('');
    const stepText = item.bundle ? '5 workflow' : `${item.stepCount} steps`;
    const installed = !item.bundle && installedSteps[item.targetWf] > 0;
    const instBadge = installed ? `<span class="bld-mkt-inst">✓ Terinstall (${installedSteps[item.targetWf]} steps)</span>` : '';
    return `
      <div class="bld-mkt-card ${item.bundle ? 'bld-mkt-bundle' : ''}" data-key="${item.key}">
        <div class="bld-mkt-icon">${item.icon}</div>
        <div class="bld-mkt-body">
          <div class="bld-mkt-card-header">
            <span class="bld-mkt-card-title">${item.displayName}</span>
            ${item.bundle ? '<span class="bld-mkt-badge-bundle">BUNDLE</span>' : ''}
          </div>
          <p class="bld-mkt-desc">${item.description}</p>
          <div class="bld-mkt-tags">${tags}</div>
          <div class="bld-mkt-meta"><span>by ${item.author}</span><span>${stepText}</span></div>
          ${instBadge}
        </div>
        <div class="bld-mkt-acts">
          ${item.bundle
            ? `<button class="bld-mkt-use bld-mkt-bundle-btn" data-key="${item.key}">⚡ Install Bundle</button>`
            : `<button class="bld-mkt-preview" data-key="${item.key}">👁 Preview</button>
               <button class="bld-mkt-use" data-key="${item.key}">⬇ Gunakan</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.bld-mkt-use').forEach(btn => btn.addEventListener('click', () => importMarketplaceTemplate(btn.dataset.key)));
  grid.querySelectorAll('.bld-mkt-preview').forEach(btn => btn.addEventListener('click', () => previewMarketplaceTemplate(btn.dataset.key)));
}

async function previewMarketplaceTemplate(key) {
  const item = MARKETPLACE_ITEMS.find(i => i.key === key);
  if (!item || item.bundle) return;
  try {
    const r    = await fetch(chrome.runtime.getURL(item.file));
    const data = await r.json();
    openRecorderPreview(item.targetWf, data.steps, { totalSteps: data.steps.length, ...data.meta });
  } catch (e) { showToast('Gagal load preview: ' + e.message, 'error'); }
}

async function importMarketplaceTemplate(key) {
  const item = MARKETPLACE_ITEMS.find(i => i.key === key);
  if (!item) return;
  try {
    const r    = await fetch(chrome.runtime.getURL(item.file));
    const data = await r.json();
    if (item.bundle) {
      const bundleIncludes = data.workflows || {};
      let count = 0;
      for (const wf of Object.keys(bundleIncludes)) {
        try {
          const wfRes  = await fetch(chrome.runtime.getURL(`templates/marketplace/${wf}.json`));
          const wfData = await wfRes.json();
          if (wfData.steps?.length) { if (!templates[wf]) templates[wf] = { meta:{}, steps:[] }; templates[wf].steps = wfData.steps; await saveTemplate(wf); count++; }
        } catch (_) {}
      }
      renderSidebar(); showToast(`📦 Bundle diinstall: ${count} workflow diperbarui`, 'success');
    } else {
      const targetWf = item.targetWf || currentWf;
      if (!templates[targetWf]) templates[targetWf] = { meta:{}, steps:[] };
      if ((templates[targetWf].steps?.length || 0) > 0) {
        openRecorderPreview(targetWf, data.steps, { totalSteps: data.steps.length, ...data.meta });
      } else {
        templates[targetWf].steps = data.steps;
        await saveTemplate(targetWf); currentWf = targetWf;
        switchView('workflow');
        showToast(`✅ Template "${item.displayName}" diinstall`, 'success');
      }
    }
    renderMarketplace();
  } catch (e) { showToast('Gagal import template: ' + e.message, 'error'); }
}

function bindMarketplace() {
  document.getElementById('btnMarketplace')?.addEventListener('click', () => {
    switchView(currentView === 'marketplace' ? 'workflow' : 'marketplace');
  });
}

// ── Flow View ─────────────────────────────────────────────────────────────────

function bindViewToggle() {
  const btnList = document.getElementById('btnViewList');
  const btnFlow = document.getElementById('btnViewFlow');

  btnList?.addEventListener('click', () => {
    if (stepView === 'list') return;
    stepView = 'list';
    btnList.classList.add('active'); btnFlow.classList.remove('active');
    document.getElementById('stepList').classList.remove('hidden');
    document.getElementById('flowList').classList.add('hidden');
  });

  btnFlow?.addEventListener('click', () => {
    if (stepView === 'flow') return;
    stepView = 'flow';
    btnFlow.classList.add('active'); btnList.classList.remove('active');
    document.getElementById('stepList').classList.add('hidden');
    const flowEl = document.getElementById('flowList');
    flowEl.classList.remove('hidden');
    renderFlowView(flowEl);
  });
}

const FLOW_COLORS = {
  navigate:         { bg:'#ede9fe', border:'#7c3aed', dot:'#7c3aed', label:'#5b21b6' },
  click:            { bg:'#fef3c7', border:'#d97706', dot:'#d97706', label:'#92400e' },
  click_button:     { bg:'#fef3c7', border:'#d97706', dot:'#d97706', label:'#92400e' },
  wait_button:      { bg:'#e0f2fe', border:'#0284c7', dot:'#0284c7', label:'#0c4a6e' },
  type:             { bg:'#dcfce7', border:'#16a34a', dot:'#16a34a', label:'#14532d' },
  wait:             { bg:'#f1f5f9', border:'#64748b', dot:'#64748b', label:'#334155' },
  date_picker:      { bg:'#fce7f3', border:'#db2777', dot:'#db2777', label:'#831843' },
  select_dropdown:  { bg:'#f0fdf4', border:'#15803d', dot:'#15803d', label:'#14532d' },
  select_antrian:   { bg:'#fff7ed', border:'#c2410c', dot:'#c2410c', label:'#7c2d12' },
  select_pekerjaan: { bg:'#faf5ff', border:'#7e22ce', dot:'#7e22ce', label:'#581c87' },
  select_alamat:    { bg:'#ecfeff', border:'#0e7490', dot:'#0e7490', label:'#164e63' },
  default:          { bg:'#f8fafc', border:'#94a3b8', dot:'#94a3b8', label:'#475569' },
};

function renderFlowView(container) {
  const steps = templates[currentWf]?.steps || [];
  if (!steps.length) { container.innerHTML = '<div class="bld-flow-empty">Belum ada step di workflow ini.</div>'; return; }
  const nodes = steps.map((step, idx) => {
    const c    = FLOW_COLORS[step.type] || FLOW_COLORS.default;
    const desc = step.selector ? `<span class="bld-flow-sel">${String(step.selector).slice(0,38)}</span>` : step.value ? `<span class="bld-flow-val">${String(step.value).slice(0,38)}</span>` : '';
    return `
      <div class="bld-flow-node-wrap">
        <div class="bld-flow-node" style="background:${c.bg};border-color:${c.border}" title="${step.label}">
          <div class="bld-flow-type" style="color:${c.label}"><span class="bld-flow-dot" style="background:${c.dot}"></span>${step.type}</div>
          <div class="bld-flow-label">${step.label}</div>
          ${desc}
        </div>
        ${idx < steps.length - 1 ? '<div class="bld-flow-conn"><div class="bld-flow-arrow"></div></div>' : ''}
      </div>
    `;
  }).join('');
  container.innerHTML = `<div class="bld-flow-wrap"><div class="bld-flow-title">Alur — ${wfDisplay[currentWf] || currentWf} (${steps.length} steps)</div>${nodes}</div>`;
}

// ── Keyboard shortcuts (scoped to builder tab) ────────────────────────────────

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const builderTab = document.getElementById('tab-builder');
    if (!builderTab?.classList.contains('active')) return;
    if (e.key === 'Escape') {
      document.getElementById('modalBackdrop')?.classList.add('hidden');
      document.getElementById('jsonBackdrop')?.classList.add('hidden');
      document.getElementById('wfModalBackdrop')?.classList.add('hidden');
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setVal(id, val) {
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
  if (!el) return;
  el.textContent = msg;
  el.className   = `bld-toast${level ? ' bld-toast-' + level : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2800);
}
