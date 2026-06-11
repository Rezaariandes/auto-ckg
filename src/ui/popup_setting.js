/**
 * popup_setting.js — CKG Auto KlikPro v2.0 (Phase 4B + 5)
 * Tab Setting: Umum (user-friendly) | Lanjutan (power user)
 * - Bahasa Nakes (alih bahasa semua label teknis)
 * - Workflow Toggles dipindahkan ke sini (dari tab Utama)
 * - Auto Update Mapping check
 */

import { QuizEngine }  from '../logic/quiz_rules.js';
import { FieldMapper } from '../logic/field_mapper.js';
import { storage }     from '../lib/storage.js';
import {
  loadColumnConfig, saveColumnConfig, resetColumnConfig,
  getActiveColumns, DEFAULT_COLUMNS, DEFAULT_SAMPLE_ROWS,
  syncColumnsFromSchemas, getColumnUsageMap,
} from '../lib/column_config.js';

// ── Constants ────────────────────────────────────────────────────────────────

const EXCEL_COLUMNS = [
  'NIK','Nama','TTL','Jenis_Kelamin','No_WA','Pekerjaan',
  'Alamat','Provinsi','Kabupaten','Kecamatan','Kelurahan',
  'Status_Nikah','BB','TB','GDS','TD_Sistolik','TD_Diastolik',
  'Diagnosa','Tanggal_Periksa','No_Antrian'
];

const DEFAULT_SETTINGS = {
  retryMax: 3, retryDelayMs: 1500, stepDelayMs: 500,
  navigateTimeoutMs: 10000, elementTimeoutMs: 8000,
  interPasienDelayMs: 1500,
};

const OPERATORS = [
  { value: 'contains', label: 'mengandung' },
  { value: 'equals',   label: 'sama dengan' },
  { value: 'gte',      label: '>= (angka)' },
  { value: 'lte',      label: '<= (angka)' },
  { value: 'truthy',   label: 'berisi (truthy)' },
];

const WORKFLOWS = ['pendaftaran','konfirmasi','kuesioner','pemeriksaan','selesai'];

// Tabel alih bahasa (Phase 5)
const WORKFLOW_LABELS = {
  pendaftaran: 'Pendaftaran',
  konfirmasi:  'Konfirmasi',
  kuesioner:   'Kuesioner',
  pemeriksaan: 'Pemeriksaan',
  selesai:     'Selesai',
};

// ── Module State ─────────────────────────────────────────────────────────────

let _rules       = [];
let _mapping     = {};
let _settings    = { ...DEFAULT_SETTINGS };
let _wfToggles   = {};
let _activeTab   = 'umum';   // umum | lanjutan
let _colConfig   = null;     // {columns, customColumns, sampleRows}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initSettingTab() {
  await _loadAll();
  _render();
  // Cek update mapping saat tab setting dibuka (Phase 4B)
  _checkMappingUpdate();
}

async function _loadAll() {
  _rules     = await QuizEngine.loadRules();
  _mapping   = await FieldMapper.loadMapping();
  _colConfig = await loadColumnConfig();
  const res    = await new Promise(r => chrome.storage.local.get('ckg_settings', r));
  const saved  = res['ckg_settings'] || {};
  _settings    = { ...DEFAULT_SETTINGS, ...saved };
  _wfToggles   = saved.activeWorkflows || Object.fromEntries(WORKFLOWS.map(w => [w, true]));
}

// ── Render Shell ──────────────────────────────────────────────────────────────

function _render() {
  const container = document.getElementById('settingContent');
  if (!container) return;

  container.innerHTML = `
    <!-- Sub-tab nav: Umum | Lanjutan -->
    <div class="stab-nav">
      <button class="stab-btn ${_activeTab === 'umum'     ? 'active' : ''}" data-stab="umum">🏠 Umum</button>
      <button class="stab-btn ${_activeTab === 'lanjutan' ? 'active' : ''}" data-stab="lanjutan">⚙️ Lanjutan</button>
    </div>

    <!-- Panels -->
    <div id="stabPanel"></div>
  `;

  container.querySelectorAll('.stab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.stab;
      container.querySelectorAll('.stab-btn').forEach(b => b.classList.toggle('active', b.dataset.stab === _activeTab));
      _renderPanel();
    });
  });

  _renderPanel();
}

function _renderPanel() {
  const panel = document.getElementById('stabPanel');
  if (!panel) return;
  if (_activeTab === 'umum')     _renderUmum(panel);
  if (_activeTab === 'lanjutan') _renderLanjutan(panel);
}

// ── Panel: Umum (user-friendly) ───────────────────────────────────────────────

function _renderUmum(el) {
  el.innerHTML = `
    <!-- Template Excel Download -->
    <div class="setting-section">
      <div class="setting-section-title">📥 Template Data Pasien</div>
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px;line-height:1.6">
        Download file Excel template berisi semua kolom wajib beserta 2 baris contoh data.
        Gunakan file ini sebagai dasar input data pasien.
      </p>
      <button class="btn btn-primary" id="btnDownloadTemplate" style="width:100%;gap:6px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download template_data_pasien_CKG.xlsx
      </button>
    </div>

    <!-- Update Mapping (Phase 4B) -->
    <div class="setting-section" id="mappingUpdateSection">
      <div class="setting-section-title">🔄 Pembaruan Otomatis</div>
      <div class="setting-row">
        <span class="setting-row-label">Versi Pemetaan Kolom</span>
        <span class="badge badge-indigo" id="mappingVerBadge">—</span>
      </div>
      <div class="setting-row" id="updateRow" style="display:none">
        <span class="setting-row-label" style="color:var(--warn)">⚠ Update tersedia!</span>
        <button class="btn-sm btn-primary" id="btnApplyUpdate">Perbarui Sekarang</button>
      </div>
      <button class="btn-icon" id="btnCheckUpdate" style="margin-top:8px;width:100%;justify-content:center">
        🔍 Periksa Update
      </button>
    </div>

    <!-- Tahapan Proses (dipindah dari Tab Utama) -->
    <div class="setting-section">
      <div class="setting-section-title">⚙️ Tahapan Proses</div>
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:10px;line-height:1.5">
        Pilih tahapan yang akan dijalankan secara otomatis.
      </p>
      <div class="wf-grid">
        ${WORKFLOWS.map(wf => `
          <label class="wf-item ${wf === 'selesai' ? 'wf-span2' : ''}">
            <span class="wf-label">${WORKFLOW_LABELS[wf]}</span>
            <input type="checkbox" class="wf-chk wf-toggle" data-wf="${wf}"
              ${_wfToggles[wf] !== false ? 'checked' : ''}>
            <span class="wf-slider"></span>
          </label>
        `).join('')}
      </div>
    </div>

    <!-- Storage & Hapus Data -->
    <div class="setting-section">
      <div class="setting-section-title">🗑 Penyimpanan</div>
      <div class="setting-row">
        <span class="setting-row-label">Ruang Terpakai</span>
        <span class="badge badge-indigo" id="storageUsed">…</span>
      </div>
      <button class="btn-icon" id="btnClearStorage"
        style="margin-top:8px;width:100%;justify-content:center;color:var(--danger)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        Hapus semua data CKG
      </button>
    </div>

    <!-- Options page link -->
    <div class="setting-section">
      <div class="setting-section-title">🛠 Alat Pembuat Template</div>
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:6px;line-height:1.6">
        Edit langkah-langkah otomasi secara visual di halaman penuh.
      </p>
      <button class="btn btn-primary" id="btnOpenOptions" style="width:100%">
        Buka Template Builder ↗
      </button>
    </div>

    <!-- Developer Mode Toggle (v2) -->
    <div class="setting-section">
      <div class="setting-section-title">🛠 Developer Mode (v2)</div>
      <div class="setting-row">
        <span class="setting-row-label">
          <strong>Aktifkan Dev Mode</strong><br>
          <span style="font-size:10px;color:var(--text3)">
            Tampilkan tab Dev Mode untuk schema discovery, audit log, dan debugging.
          </span>
        </span>
        <label class="wf-item" style="margin:0">
          <input type="checkbox" class="wf-chk" id="devModeToggle"
            ${(_settings.devMode ? 'checked' : '')}>
          <span class="wf-slider"></span>
        </label>
      </div>
    </div>

    <div class="setting-save-status hidden" id="saveStatus"></div>
  `;

  // Workflow toggle listeners
  el.querySelectorAll('.wf-chk').forEach(chk => {
    chk.addEventListener('change', async () => {
      _wfToggles[chk.dataset.wf] = chk.checked;
      const res = await new Promise(r => chrome.storage.local.get('ckg_settings', r));
      const cur = res['ckg_settings'] || {};
      cur.activeWorkflows = { ...(cur.activeWorkflows || {}), ..._wfToggles };
      await chrome.storage.local.set({ ckg_settings: cur });
    });
  });

  el.querySelector('#btnDownloadTemplate').addEventListener('click', _downloadTemplateExcel);
  el.querySelector('#btnOpenOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  el.querySelector('#btnClearStorage').addEventListener('click', _clearStorage);
  el.querySelector('#btnCheckUpdate').addEventListener('click', () => _checkMappingUpdate(true));

  // Developer Mode toggle (v2)
  el.querySelector('#devModeToggle')?.addEventListener('change', async e => {
    const enabled = e.target.checked;
    const res = await new Promise(r => chrome.storage.local.get('ckg_settings', r));
    const cur = res['ckg_settings'] || {};
    cur.devMode = enabled;
    _settings.devMode = enabled;
    await chrome.storage.local.set({ ckg_settings: cur });

    // Show/hide the Dev Mode tab immediately
    const tabBtn = document.getElementById('tabBtnDevMode');
    if (tabBtn) tabBtn.classList.toggle('hidden', !enabled);

    // Initialize Dev Mode wiring if enabled
    if (enabled) {
      try {
        const m = await import(chrome.runtime.getURL('src/ui/popup_main.js'));
        m.initDevMode();
      } catch (_) {}
    }

    _flashStatus(enabled ? '🛠 Developer Mode aktif' : 'Developer Mode dinonaktifkan', 'info');
  });

  // Storage usage
  chrome.storage.local.getBytesInUse(null, bytes => {
    const el2 = document.getElementById('storageUsed');
    if (el2) el2.textContent = `${(bytes / 1024).toFixed(1)} KB`;
  });

  // Tampilkan versi mapping
  chrome.storage.local.get(['ckg_mapping_version', 'ckg_mapping_updated'], res => {
    const verBadge = document.getElementById('mappingVerBadge');
    if (verBadge) {
      const ver     = res['ckg_mapping_version'] || 'Bawaan';
      const updated = res['ckg_mapping_updated']
        ? ` · ${new Date(res['ckg_mapping_updated']).toLocaleDateString('id-ID')}`
        : '';
      verBadge.textContent = ver + updated;
    }
  });
}

// ── Panel: Lanjutan (power user) ──────────────────────────────────────────────

function _renderLanjutan(el) {
  el.innerHTML = `
    <div class="stab-nav" id="advNav">
      <button class="stab-btn active" data-advtab="timing">⏱ Waktu</button>
      <button class="stab-btn" data-advtab="quiz">📋 Kuesioner</button>
      <button class="stab-btn" data-advtab="kolom">📊 Kolom Excel</button>
    </div>
    <div id="advPanel"></div>
    <div class="setting-save-status hidden" id="saveStatus"></div>
  `;

  let advTab = 'timing';
  function renderAdv() {
    const panel = document.getElementById('advPanel');
    if (!panel) return;
    if (advTab === 'timing') _renderTiming(panel);
    if (advTab === 'quiz')   _renderQuizRules(panel);
    if (advTab === 'kolom')  _renderKolomExcel(panel);
  }

  el.querySelectorAll('[data-advtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      advTab = btn.dataset.advtab;
      el.querySelectorAll('[data-advtab]').forEach(b => b.classList.toggle('active', b.dataset.advtab === advTab));
      renderAdv();
    });
  });

  renderAdv();
}

// ── Panel: Timing (bahasa nakes) ──────────────────────────────────────────────

function _renderTiming(el) {
  el.innerHTML = `
    <div class="setting-section">
      <div class="setting-section-title">Jeda &amp; Coba Ulang</div>
      ${_timingRow('retryMax',           'Coba Ulang Maksimal',          1,  10,    1)}
      ${_timingRow('retryDelayMs',       'Jeda Antar Percobaan (ms)',   500, 10000, 100)}
      ${_timingRow('stepDelayMs',        'Jeda Antar Langkah (ms)',     100,  5000, 100)}
      ${_timingRow('interPasienDelayMs', 'Jeda Antar Pasien (ms)',      500, 10000, 100)}
      ${_timingRow('navigateTimeoutMs',  'Batas Waktu Pindah Halaman (ms)', 3000, 30000, 1000)}
      ${_timingRow('elementTimeoutMs',   'Batas Waktu Tunggu Tombol (ms)',  2000, 20000, 1000)}
    </div>
    <button class="btn btn-primary" id="btnSaveSettings" style="width:100%">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Simpan Pengaturan
    </button>
  `;

  el.querySelector('#btnSaveSettings').addEventListener('click', _saveSettings);
}

function _timingRow(key, label, min, max, step) {
  return `
    <div class="setting-row">
      <span class="setting-row-label">${label}</span>
      <input class="setting-input" type="number" id="set_${key}"
        min="${min}" max="${max}" step="${step}" value="${_settings[key] ?? DEFAULT_SETTINGS[key]}">
    </div>`;
}

async function _saveSettings() {
  const keys = ['retryMax','retryDelayMs','stepDelayMs','interPasienDelayMs','navigateTimeoutMs','elementTimeoutMs'];
  const updated = { ..._settings };
  for (const k of keys) {
    const el = document.getElementById('set_' + k);
    if (el) updated[k] = parseInt(el.value, 10) || DEFAULT_SETTINGS[k];
  }

  const existing = await new Promise(r => chrome.storage.local.get('ckg_settings', r));
  updated.activeWorkflows = existing['ckg_settings']?.activeWorkflows || {};
  _settings = updated;
  await chrome.storage.local.set({ ckg_settings: _settings });
  _flashStatus('✓ Pengaturan disimpan', 'success');

  try { chrome.runtime.sendMessage({ action: 'ckg_settings_updated', settings: _settings }); } catch {}
}

async function _clearStorage() {
  if (!confirm('Hapus semua data CKG (template, rules, log, pengaturan)? Tindakan ini tidak bisa dibatalkan.')) return;
  const all  = await new Promise(r => chrome.storage.local.get(null, r));
  const keys = Object.keys(all).filter(k => k.startsWith('ckg_'));
  await new Promise(r => chrome.storage.local.remove(keys, r));
  _settings  = { ...DEFAULT_SETTINGS };
  _rules     = await QuizEngine.loadRules();
  _mapping   = {};
  _wfToggles = Object.fromEntries(WORKFLOWS.map(w => [w, true]));
  _flashStatus('✓ Data CKG dihapus', 'warn');
  _renderPanel();
}

// ── Auto Update Mapping (Phase 4B) ────────────────────────────────────────────

const MAPPING_VERSION_URL = 'https://raw.githubusercontent.com/klikpro/auto-ckg/main/mapping_version.json';

let _pendingUpdate = null;

async function _checkMappingUpdate(showFeedback = false) {
  const btnCheck = document.getElementById('btnCheckUpdate');
  if (btnCheck) {
    btnCheck.textContent = '⏳ Memeriksa…';
    btnCheck.disabled = true;
  }

  try {
    const res    = await fetch(MAPPING_VERSION_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = await res.json();

    const localRes  = await new Promise(r => chrome.storage.local.get('ckg_mapping_version', r));
    const localVer  = localRes['ckg_mapping_version'] || null;

    const verBadge = document.getElementById('mappingVerBadge');
    if (verBadge) {
      verBadge.textContent = `v${remote.version}`;
    }

    if (remote.version !== localVer) {
      _pendingUpdate = remote;
      const updateRow = document.getElementById('updateRow');
      if (updateRow) {
        updateRow.style.display = 'flex';
        const applyBtn = document.getElementById('btnApplyUpdate');
        applyBtn?.addEventListener('click', () => _applyMappingUpdate(remote));
      }
      if (showFeedback) _flashStatus(`🔔 Update tersedia: v${remote.version}`, 'warn');
    } else {
      if (showFeedback) _flashStatus(`✓ Sudah versi terbaru (v${remote.version})`, 'success');
      const updateRow = document.getElementById('updateRow');
      if (updateRow) updateRow.style.display = 'none';
    }
  } catch (err) {
    // Silent fail — tidak ada internet atau repo belum ada
    if (showFeedback) {
      const verBadge = document.getElementById('mappingVerBadge');
      if (verBadge) verBadge.textContent = 'Bawaan';
      _flashStatus('Tidak dapat memeriksa update (offline?)', 'warn');
    }
  } finally {
    if (btnCheck) {
      btnCheck.textContent = '🔍 Periksa Update';
      btnCheck.disabled = false;
    }
  }
}

async function _applyMappingUpdate(remote) {
  try {
    const res  = await fetch(remote.url);
    const data = await res.json();
    await FieldMapper.saveMapping(data);
    await chrome.storage.local.set({
      ckg_mapping_version: remote.version,
      ckg_mapping_updated: Date.now(),
    });
    const updateRow = document.getElementById('updateRow');
    if (updateRow) updateRow.style.display = 'none';
    const verBadge = document.getElementById('mappingVerBadge');
    if (verBadge) verBadge.textContent = `v${remote.version} · Diperbarui`;
    _flashStatus(`✓ Pemetaan kolom diperbarui ke v${remote.version}`, 'success');
  } catch (err) {
    _flashStatus('Gagal memperbarui: ' + err.message, 'warn');
  }
}

// ── Download Template Excel ───────────────────────────────────────────────────

function _downloadTemplateExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Library XLSX belum tersedia. Pastikan src/lib/xlsx.min.js sudah di-load.');
    return;
  }

  const cfg     = _colConfig || { columns: DEFAULT_COLUMNS, customColumns: [], sampleRows: [...DEFAULT_SAMPLE_ROWS] };
  const actCols = getActiveColumns(cfg); // [{key, label, required, active}]
  const headers = actCols.map(c => c.label); // nama header pakai alias
  const keyMap  = Object.fromEntries(actCols.map(c => [c.label, c.key])); // label→key

  const sampleRows = (cfg.sampleRows || []).map(row =>
    headers.map(h => {
      const key = keyMap[h] || h;
      return row[key] ?? '';
    })
  );

  const wsData = [headers, ...sampleRows];
  const ws     = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols']  = actCols.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Pasien');

  // Sheet Petunjuk
  const guideData = [
    ['Kolom', 'Kunci Standar', 'Format / Nilai yang Diterima'],
    ...actCols.map(c => [c.label, c.key, _colGuide(c.key)]),
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk');

  XLSX.writeFile(wb, 'template_data_pasien_CKG.xlsx');
  _flashStatus('✓ Template berhasil didownload', 'success');
}

function _colGuide(key) {
  const map = {
    NIK:             '16 digit angka, tanpa spasi/strip',
    TTL:             'DD/MM/YYYY  contoh: 15/04/1988',
    Jenis_Kelamin:   'Laki-laki  atau  Perempuan',
    Status_Nikah:    'Menikah / Belum Menikah / Cerai Hidup / Cerai Mati',
    BB:              'Angka kg, tanpa satuan  contoh: 72',
    TB:              'Angka cm, tanpa satuan  contoh: 168',
    GDS:             'Angka mg/dL, tanpa satuan  contoh: 95',
    TD_Sistolik:     'Angka mmHg, tanpa satuan  contoh: 120',
    TD_Diastolik:    'Angka mmHg, tanpa satuan  contoh: 80',
    Diagnosa:        'Normal / DM / Hipertensi / DM,Hipertensi / dll',
    Tanggal_Periksa: 'DD/MM/YYYY  contoh: 08/06/2026',
    No_Antrian:      'Angka slot antrian  contoh: 1',
  };
  return map[key] || 'Isi sesuai kebutuhan';
}


// ── Panel: Quiz Rules ─────────────────────────────────────────────────────────

function _renderQuizRules(el) {
  el.innerHTML = `
    <div class="qr-toolbar">
      <span class="setting-section-title" style="margin:0">${_rules.length} Aturan Kuesioner</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" id="btnResetRules">Reset Default</button>
        <button class="btn btn-primary btn-sm" id="btnAddRule">+ Tambah Aturan</button>
      </div>
    </div>
    <div id="ruleList"></div>
    <div class="setting-save-status hidden" id="saveStatus"></div>
  `;

  el.querySelector('#btnAddRule').addEventListener('click', () => _openRuleModal(null));
  el.querySelector('#btnResetRules').addEventListener('click', _resetRules);
  _renderRuleList();
}

function _renderRuleList() {
  const list = document.getElementById('ruleList');
  if (!list) return;
  list.innerHTML = '';

  if (_rules.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:16px;font-size:12px">Belum ada aturan kuesioner.</p>';
    return;
  }

  _rules.forEach((rule, idx) => {
    const card = document.createElement('div');
    card.className = 'rule-card';

    const condLabel = rule.condition
      ? `<span class="rule-cond">${rule.condition.field} <em>${rule.condition.operator}</em> "${rule.condition.value}"</span>`
      : `<span class="rule-cond rule-fallback">— selalu aktif (fallback) —</span>`;

    const qCount  = (rule.questions || []).length;
    const defAnswer = rule.defaultAnswer ? ` · default: <strong>${rule.defaultAnswer}</strong>` : '';

    card.innerHTML = `
      <div class="rule-header">
        <span class="rule-label">${rule.label || rule.ruleId}</span>
        <div class="rule-actions">
          <button class="icon-btn btn-edit-rule" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn delete btn-del-rule" title="Hapus">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
      <div class="rule-meta">
        ${condLabel}
        <span class="rule-info">${qCount} pertanyaan${defAnswer}</span>
      </div>
    `;

    card.querySelector('.btn-edit-rule').addEventListener('click', () => _openRuleModal(idx));
    card.querySelector('.btn-del-rule').addEventListener('click',  () => _deleteRule(idx));
    list.appendChild(card);
  });
}

async function _deleteRule(idx) {
  if (!confirm(`Hapus aturan "${_rules[idx]?.label || _rules[idx]?.ruleId}"?`)) return;
  _rules.splice(idx, 1);
  await QuizEngine.saveRules(_rules);
  _renderRuleList();
  _updateRuleCount();
}

async function _resetRules() {
  if (!confirm('Reset semua aturan kuesioner ke default bawaan?')) return;
  await QuizEngine.resetToDefault();
  _rules = await QuizEngine.loadRules();
  _renderQuizRules(document.getElementById('advPanel'));
}

// ── Rule Modal ────────────────────────────────────────────────────────────────

let _editRuleIdx = null;

function _openRuleModal(idx) {
  _editRuleIdx = idx;
  const rule   = idx !== null ? _rules[idx] : null;
  const isEdit = rule !== null;

  const panel = document.getElementById('advPanel');
  document.getElementById('ruleModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'ruleModal';
  modal.className = 'inline-modal';

  const cond = rule?.condition || {};
  const questionsJSON = JSON.stringify(rule?.questions || [], null, 2);

  modal.innerHTML = `
    <div class="inline-modal-header">
      <span>${isEdit ? 'Edit Aturan' : 'Tambah Aturan'}</span>
      <button class="modal-close" id="ruleModalClose">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="inline-modal-body">
      <div class="field-group-sm">
        <label class="field-label-sm">ID Aturan</label>
        <input class="field-input-sm mono" id="rm_ruleId" value="${rule?.ruleId || _genRuleId()}" placeholder="AUTO_001">
      </div>
      <div class="field-group-sm">
        <label class="field-label-sm">Label / Keterangan</label>
        <input class="field-input-sm" id="rm_label" value="${rule?.label || ''}" placeholder="Penderita Hipertensi...">
      </div>
      <div class="field-group-sm">
        <label class="field-label-sm">Prioritas</label>
        <input class="field-input-sm" id="rm_priority" type="number" value="${rule?.priority ?? 10}" min="1" max="100">
      </div>

      <div class="inline-modal-sep">Kondisi (kosongkan = selalu aktif)</div>

      <div class="field-row-sm">
        <div class="field-group-sm flex-1">
          <label class="field-label-sm">Kolom Data</label>
          <select class="field-input-sm" id="rm_field">
            <option value="">— selalu aktif —</option>
            ${EXCEL_COLUMNS.map(c => `<option value="${c}" ${cond.field === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field-group-sm" style="width:130px">
          <label class="field-label-sm">Operator</label>
          <select class="field-input-sm" id="rm_operator">
            ${OPERATORS.map(o => `<option value="${o.value}" ${cond.operator === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="field-group-sm flex-1">
          <label class="field-label-sm">Nilai</label>
          <input class="field-input-sm" id="rm_condValue" value="${cond.value || ''}" placeholder="DM">
        </div>
      </div>

      <div class="inline-modal-sep">Pertanyaan &amp; Jawaban (format JSON)</div>
      <div class="field-group-sm">
        <label class="field-label-sm">
          Daftar Pertanyaan
          <span class="field-hint-sm">[ { "titleContains": "...", "answer": "Ya" }, ... ]</span>
        </label>
        <textarea class="field-textarea mono" id="rm_questions" rows="6" spellcheck="false">${questionsJSON}</textarea>
      </div>

      <div class="field-group-sm">
        <label class="field-label-sm">Jawaban Default (opsional)</label>
        <input class="field-input-sm" id="rm_defaultAnswer" value="${rule?.defaultAnswer || ''}" placeholder="Tidak">
        <span class="field-hint-sm" style="font-size:10px">Dipakai jika kondisi cocok tapi tidak ada pertanyaan yang match.</span>
      </div>

      <div id="rm_error" class="rm-error hidden"></div>
    </div>
    <div class="inline-modal-footer">
      <button class="btn btn-ghost btn-sm" id="ruleModalCancel">Batal</button>
      <button class="btn btn-primary btn-sm" id="ruleModalSave">Simpan Aturan</button>
    </div>
  `;

  panel.appendChild(modal);
  document.getElementById('ruleModalClose').addEventListener('click',  _closeRuleModal);
  document.getElementById('ruleModalCancel').addEventListener('click', _closeRuleModal);
  document.getElementById('ruleModalSave').addEventListener('click',   _saveRule);
  document.getElementById('rm_label').focus();
}

function _closeRuleModal() {
  document.getElementById('ruleModal')?.remove();
}

async function _saveRule() {
  const ruleId   = document.getElementById('rm_ruleId').value.trim();
  const label    = document.getElementById('rm_label').value.trim();
  const priority = parseInt(document.getElementById('rm_priority').value, 10) || 10;
  const fieldEl  = document.getElementById('rm_field').value;
  const operator = document.getElementById('rm_operator').value;
  const condVal  = document.getElementById('rm_condValue').value.trim();
  const defAns   = document.getElementById('rm_defaultAnswer')?.value.trim() || '';

  if (!ruleId) { _showRmError('ID Aturan wajib diisi'); return; }

  let questions = [];
  const raw = document.getElementById('rm_questions').value.trim();
  if (raw) {
    try { questions = JSON.parse(raw); }
    catch { _showRmError('Format JSON pertanyaan tidak valid: ' + raw.slice(0, 40)); return; }
    if (!Array.isArray(questions)) { _showRmError('Pertanyaan harus berupa JSON array [...]'); return; }
  }

  const condition = fieldEl ? { field: fieldEl, operator, value: condVal || '' } : null;
  const rule = {
    ruleId, label, priority, condition, questions,
    ...(defAns ? { defaultAnswer: defAns } : {}),
  };

  if (_editRuleIdx !== null) {
    _rules[_editRuleIdx] = rule;
  } else {
    _rules.push(rule);
  }

  await QuizEngine.saveRules(_rules);
  _closeRuleModal();
  _renderRuleList();
  _updateRuleCount();
  _flashStatus('✓ Aturan disimpan', 'success');
}

function _showRmError(msg) {
  const el = document.getElementById('rm_error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _updateRuleCount() {
  const toolbar = document.querySelector('.qr-toolbar .setting-section-title');
  if (toolbar) toolbar.textContent = `${_rules.length} Aturan Kuesioner`;
}

function _genRuleId() {
  return 'RULE_' + Date.now().toString(36).toUpperCase();
}

// ── Panel: Kolom Excel ────────────────────────────────────────────────────────

async function _renderKolomExcel(el) {
  if (!_colConfig) { el.innerHTML = '<p style="padding:12px;color:var(--text-dim)">Memuat…</p>'; return; }

  // Auto-sync dari schema kuesioner setiap kali panel dibuka
  const { config, added } = await syncColumnsFromSchemas(_colConfig);

  _colConfig = config;
  if (added.length) await saveColumnConfig(_colConfig);

  // Usage map: kolom → [nama kuesioner, ...]
  const usageMap = await getColumnUsageMap();

  const stdCols  = _colConfig.columns       || [];
  const quizCols = _colConfig.customColumns  || [];

  function renderColRow(col, idx, isCustom) {
    const activeChecked = col.active !== false ? 'checked' : '';
    const usage = usageMap.get(col.key) || [];
    const usageHtml = usage.length
      ? `<span style="font-size:9px;color:#0891b2;background:rgba(6,182,212,0.10);padding:1px 5px;border-radius:3px;white-space:nowrap">📊 ${usage.length} kuesioner</span>`
      : '';
    const fromSchemaHtml = col.fromSchema
      ? `<span style="font-size:8px;background:#f0fdff;color:#0e7490;padding:0 4px;border-radius:2px;border:1px solid rgba(6,182,212,0.3)">🔍 KUESIONER</span>`
      : '';
    const requiredHtml = col.required
      ? `<span style="font-size:8px;background:#fee2e2;color:#dc2626;padding:0 3px;border-radius:2px">WAJIB</span>`
      : '';

    return `
      <div class="setting-row" style="gap:6px;align-items:center;flex-wrap:wrap" data-colidx="${idx}" data-custom="${isCustom}">
        <input type="checkbox" class="col-active-chk" ${activeChecked}
          ${col.required ? 'disabled' : ''}
          style="width:14px;height:14px;flex-shrink:0;cursor:${col.required ? 'not-allowed' : 'pointer'}">
        <span style="font-size:11px;font-family:monospace;width:140px;flex-shrink:0;color:#0f172a">
          ${col.key} ${requiredHtml} ${fromSchemaHtml}
        </span>
        <input class="setting-input col-alias-inp" style="width:130px;flex-shrink:0"
          value="${col.label || col.key}" placeholder="${col.key}"
          title="Nama header kolom di file Excel">
        ${usageHtml}
        ${isCustom && !col.required ? `<button class="btn-icon delete col-del-btn" title="Hapus" style="color:var(--danger);flex-shrink:0;margin-left:auto">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>` : '<span style="margin-left:auto"></span>'}
      </div>`;
  }

  el.innerHTML = `
    <div class="setting-section">
      <div class="setting-section-title" style="justify-content:space-between">
        📊 Kolom Excel
        <button class="btn-sm btn-ghost" id="btnSyncSchemas" style="font-size:10px">🔄 Sync Kuesioner</button>
      </div>
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:10px;line-height:1.5">
        Kolom dihasilkan otomatis dari kuesioner yang sudah di-scan di Builder.
        Aktifkan kolom yang ingin masuk ke template Excel. Nama header bisa diubah.
      </p>

      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;padding:6px 0 4px">Kolom Standar CKG</div>
      <div id="colStd">${stdCols.map((c, i) => renderColRow(c, i, false)).join('')}</div>

      ${quizCols.length ? `
        <div style="font-size:10px;font-weight:700;color:#0891b2;letter-spacing:.5px;text-transform:uppercase;padding:10px 0 4px;border-top:1px solid #e2e8f0;margin-top:6px">
          🔍 Dari Kuesioner (${quizCols.length} kolom)
        </div>
        <div id="colQuiz">${quizCols.map((c, i) => renderColRow(c, stdCols.length + i, true)).join('')}</div>
      ` : `
        <div style="margin-top:10px;padding:10px 12px;background:#f8faff;border:1px dashed #c7d8f0;border-radius:8px;text-align:center">
          <div style="font-size:12px;color:#64748b">🔍 Belum ada kolom dari kuesioner</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px">Scan kuesioner di Builder → Kuesioner, lalu klik <strong>Sync Kuesioner</strong></div>
        </div>
      `}
    </div>

    <div class="setting-section">
      <div class="setting-section-title">📝 Data Contoh di Template</div>
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px;line-height:1.5">
        Baris contoh yang muncul di file Excel yang didownload.
      </p>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" id="btnEditSample" style="flex:1">✏️ Edit Data Contoh</button>
        <button class="btn btn-ghost btn-sm" id="btnResetSample" style="flex:1">↩️ Reset Default</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-ghost btn-sm" id="btnResetKolom" style="flex:1">Reset Semua</button>
      <button class="btn btn-primary" id="btnSaveKolom" style="flex:2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Simpan Konfigurasi
      </button>
    </div>
  `;

  // Events
  el.querySelector('#btnSaveKolom').addEventListener('click', () => _saveKolomExcel(el));
  el.querySelector('#btnResetKolom').addEventListener('click', _resetKolomExcel);
  el.querySelector('#btnEditSample').addEventListener('click', () => _openSampleModal(el));
  el.querySelector('#btnResetSample').addEventListener('click', async () => {
    if (!confirm('Reset data contoh ke default?')) return;
    _colConfig.sampleRows = [...DEFAULT_SAMPLE_ROWS];
    await saveColumnConfig(_colConfig);
    _flashStatus('✓ Data contoh direset', 'success');
  });

  // Manual sync
  el.querySelector('#btnSyncSchemas').addEventListener('click', async () => {
    const btn = el.querySelector('#btnSyncSchemas');
    btn.textContent = '⏳ Sync…';
    btn.disabled = true;
    const { config: cfg2, added: add2 } = await syncColumnsFromSchemas(_colConfig);
    _colConfig = cfg2;
    await saveColumnConfig(_colConfig);
    await _renderKolomExcel(el);
    _flashStatus(add2.length ? `✓ ${add2.length} kolom baru ditambahkan dari kuesioner` : '✓ Sudah sinkron, tidak ada kolom baru', 'success');
  });

  // Hapus custom col
  el.querySelectorAll('.col-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row   = btn.closest('[data-colidx]');
      const idx   = parseInt(row.dataset.colidx);
      const colIdx = idx - (_colConfig.columns || []).length;
      if (!confirm('Hapus kolom ini dari konfigurasi?')) return;
      _colConfig.customColumns.splice(colIdx, 1);
      await saveColumnConfig(_colConfig);
      await _renderKolomExcel(el);
    });
  });
}

async function _saveKolomExcel(el) {

  const rows = el.querySelectorAll('[data-colidx]');
  rows.forEach(row => {
    const idx      = parseInt(row.dataset.colidx);
    const isCustom = row.dataset.custom === 'true';
    const active   = row.querySelector('.col-active-chk')?.checked ?? true;
    const alias    = row.querySelector('.col-alias-inp')?.value.trim() || '';
    const target   = isCustom
      ? _colConfig.customColumns[idx - (_colConfig.columns || []).length]
      : _colConfig.columns[idx];
    if (!target) return;
    if (!target.required) target.active = active;
    target.label = alias || target.key;
  });
  await saveColumnConfig(_colConfig);
  _flashStatus('✓ Konfigurasi kolom disimpan', 'success');
}

async function _resetKolomExcel() {
  if (!confirm('Reset semua konfigurasi kolom Excel ke default?')) return;
  _colConfig = await resetColumnConfig();
  const panel = document.getElementById('advPanel');
  if (panel) _renderKolomExcel(panel);
  _flashStatus('✓ Konfigurasi kolom direset', 'success');
}

function _addCustomCol(el) {
  const key = prompt('Nama kunci kolom baru (tanpa spasi, contoh: Gol_Darah):');
  if (!key || !key.trim()) return;
  const keyClean = key.trim().replace(/\s+/g, '_');
  const exists = [...(_colConfig.columns || []), ...(_colConfig.customColumns || [])]
    .some(c => c.key === keyClean);
  if (exists) { alert('Kolom "' + keyClean + '" sudah ada!'); return; }
  _colConfig.customColumns.push({ key: keyClean, label: keyClean, active: true, required: false });
  _renderKolomExcel(el);
}

// ── Modal Edit Data Contoh ────────────────────────────────────────────────────

function _openSampleModal(container) {
  document.getElementById('sampleModal')?.remove();
  const activeCols = getActiveColumns(_colConfig);
  const rows = _colConfig.sampleRows || [];

  const modal = document.createElement('div');
  modal.id = 'sampleModal';
  modal.className = 'inline-modal';
  modal.innerHTML = `
    <div class="inline-modal-header">
      <span>✏️ Edit Data Contoh</span>
      <button class="modal-close" id="sampleModalClose">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="inline-modal-body" style="overflow-x:auto">
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px">
        Edit nilai untuk setiap baris contoh data pasien yang akan muncul di template Excel.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:11px" id="sampleTable">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:5px 8px;text-align:left;border:1px solid #e2e8f0;color:#64748b">#</th>
            ${activeCols.map(c => `<th style="padding:5px 8px;text-align:left;border:1px solid #e2e8f0;white-space:nowrap">${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, ri) => `
            <tr data-ri="${ri}">
              <td style="padding:3px 8px;border:1px solid #e2e8f0;color:#94a3b8;font-size:10px">${ri + 1}</td>
              ${activeCols.map(c => `
                <td style="padding:2px 4px;border:1px solid #e2e8f0">
                  <input class="setting-input sample-inp" style="min-width:80px;padding:3px 6px;font-size:11px"
                    data-row="${ri}" data-col="${c.key}"
                    value="${(row[c.key] || '')}">
                </td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="btnAddSampleRow">+ Tambah Baris</button>
        <button class="btn btn-ghost btn-sm" id="btnDelSampleRow" style="color:var(--danger)">− Hapus Baris Terakhir</button>
      </div>
    </div>
    <div class="inline-modal-footer">
      <button class="btn btn-ghost btn-sm" id="sampleModalCancel">Batal</button>
      <button class="btn btn-primary btn-sm" id="sampleModalSave">✓ Simpan</button>
    </div>
  `;

  container.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#sampleModalClose').addEventListener('click', close);
  modal.querySelector('#sampleModalCancel').addEventListener('click', close);

  modal.querySelector('#btnAddSampleRow').addEventListener('click', () => {
    _colConfig.sampleRows.push({});
    _openSampleModal(container); // re-render
  });
  modal.querySelector('#btnDelSampleRow').addEventListener('click', () => {
    if (_colConfig.sampleRows.length > 1) _colConfig.sampleRows.pop();
    _openSampleModal(container);
  });

  modal.querySelector('#sampleModalSave').addEventListener('click', async () => {
    modal.querySelectorAll('.sample-inp').forEach(inp => {
      const ri  = parseInt(inp.dataset.row);
      const col = inp.dataset.col;
      if (!_colConfig.sampleRows[ri]) _colConfig.sampleRows[ri] = {};
      _colConfig.sampleRows[ri][col] = inp.value;
    });
    await saveColumnConfig(_colConfig);
    _flashStatus('✓ Data contoh disimpan', 'success');
    close();
  });
}

async function _saveMapping() {
  const updated = {};
  for (const col of EXCEL_COLUMNS) {
    const el  = document.getElementById('map_' + col);
    const val = el?.value.trim();
    if (val && val !== col) updated[col] = val;
  }
  _mapping = updated;
  await FieldMapper.saveMapping(_mapping);
  _flashStatus('✓ Pemetaan kolom disimpan', 'success');
}

async function _resetMapping() {
  if (!confirm('Reset semua pemetaan ke default (nama kolom standar)?')) return;
  _mapping = {};
  await FieldMapper.saveMapping(_mapping);
  _renderMapping(document.getElementById('advPanel'));
  _flashStatus('✓ Pemetaan direset', 'success');
}

// ── Toast / status ────────────────────────────────────────────────────────────

function _flashStatus(msg, level = 'info') {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  const isWarn = level === 'warn';
  el.textContent = msg;
  el.style.cssText = `
    font-size:11.5px;padding:5px 10px;border-radius:6px;text-align:center;margin-top:4px;
    background:${isWarn ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)'};
    color:${isWarn ? '#f59e0b' : '#22c55e'};
    border:1px solid ${isWarn ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'};
  `;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}
