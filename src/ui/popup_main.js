// src/ui/popup_main.js - CKG Auto KlikPro v2.0
// Tab Utama: 4-step guide, upload Excel, validasi, start/pause/stop, progress, summary, dashboard

let parsedRows = [];
let runState   = 'idle';
let _validationPassed = false;
let _runStartTime = null;  // untuk ETA calculation

// ── ERROR MAP (Phase 3B) ──────────────────────────────────────
const ERROR_MAP = {
  'Selector not found': {
    msg: 'Tombol tidak ditemukan di halaman.',
    tips: ['Halaman mungkin belum selesai dimuat', 'Website sedang lambat', 'Layout website mungkin berubah'],
  },
  'Timeout': {
    msg: 'Halaman terlalu lama merespons.',
    tips: ['Periksa koneksi internet', 'Coba muat ulang halaman CKG'],
  },
  'Navigation failed': {
    msg: 'Gagal berpindah halaman.',
    tips: ['Pastikan halaman CKG terbuka', 'Coba klik manual sekali, lalu jalankan ulang'],
  },
  'Element not visible': {
    msg: 'Kolom yang akan diisi tidak terlihat.',
    tips: ['Scroll halaman ke atas', 'Periksa apakah form sudah terbuka'],
  },
  'NIK already exists': {
    msg: 'Pasien sudah terdaftar di sistem.',
    tips: ['Cek apakah pasien ini sudah pernah didaftarkan sebelumnya'],
  },
};

// ── Init ──────────────────────────────────────────────────────

export function initMainTab() {
  setupAccordions();
  setupFileUpload();
  setupControls();
  checkResumeBanner();
  listenBackground();
  syncStateOnInit();
  restoreExcelFromStorage();
  loadDashboard();
  // Setelah restore, cek apakah Excel sudah ada — jika belum, aktifkan pulse
  // (restoreExcelFromStorage async, jadi sedikit delay)
  setTimeout(refreshUploadPulse, 400);
  // Onboarding cek (Phase 2)
  chrome.storage.local.get('ckg_onboarded', res => {
    if (!res.ckg_onboarded) {
      // Impor dinamis untuk onboarding
      import(chrome.runtime.getURL('src/ui/onboarding.js'))
        .then(m => m.showOnboarding())
        .catch(() => {}); // graceful fail jika file belum ada
    }
  });
}

// ── Upload Pulse Helper ───────────────────────────────────────

function refreshUploadPulse() {
  const accUpload = document.getElementById('accUpload');
  const step1     = document.getElementById('step1');
  const hasData   = parsedRows.length > 0;
  accUpload?.classList.toggle('need-upload', !hasData);
  step1?.classList.toggle('need-upload',    !hasData);
}

// ── Accordion Setup ───────────────────────────────────────────

function setupAccordions() {
  document.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const bodyId    = header.dataset.accBody;
      const chevronId = header.dataset.accChevron;
      const body      = document.getElementById(bodyId);
      const chevron   = document.getElementById(chevronId);
      const acc       = header.closest('.accordion');
      if (!body) return;
      const isOpen = body.style.display !== 'none' && !body.classList.contains('hidden');
      body.style.display = isOpen ? 'none' : 'block';
      if (acc) acc.classList.toggle('open', !isOpen);
      if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
  });
}

// ── Sync state saat iframe reload ─────────────────────────────

function syncStateOnInit() {
  chrome.runtime.sendMessage({ action: 'ckg_get_state' }, res => {
    if (chrome.runtime.lastError || !res) return;
    if (res.running && !res.paused) {
      setRunState('running');
    } else if (res.paused) {
      setRunState('running');
      setRunState('paused');
    }
  });
}

// ── File Upload ───────────────────────────────────────────────

function setupFileUpload() {
  const fileInput     = document.getElementById('fileInput');
  const uploadArea    = document.getElementById('uploadArea');
  const fileInfoRow   = document.getElementById('fileInfoRow');
  const fileName      = document.getElementById('fileName');
  const rowCount      = document.getElementById('rowCount');
  const dataBadge     = document.getElementById('dataBadge');
  const badgeRowCount = document.getElementById('badgeRowCount');

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  // Tombol hapus data Excel
  document.getElementById('btnClearExcel')?.addEventListener('click', () => {
    clearExcelData();
  });

  function processFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showAlert('File harus berformat .xlsx atau .xls', 'warning');
      return;
    }
    if (typeof XLSX === 'undefined') {
      showAlert('Library XLSX belum tersedia. Pastikan src/lib/xlsx.min.js ada.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          showAlert('File Excel kosong atau format tidak sesuai', 'warning');
          return;
        }

        parsedRows = rows;
        _validationPassed = false;

        // Simpan ke storage agar survive refresh
        saveExcelToStorage(file.name, rows);

        // Update UI
        uploadArea.classList.add('hidden');
        fileInfoRow.classList.remove('hidden');
        fileName.textContent      = file.name;
        rowCount.textContent      = `${rows.length} pasien`;
        badgeRowCount.textContent = rows.length;
        dataBadge.classList.add('show');

        // Reset progress UI
        document.getElementById('progressText').textContent = `${rows.length} pasien siap`;
        document.getElementById('progressFrac').textContent = `0/${rows.length}`;
        setPct(0);

        // Preview 3 pasien pertama
        showPatientPreview(rows.slice(0, 3));

        // Mark Step 1 done, aktifkan Step 2
        markStep(1, 'done');
        markStep(2, 'active');

        // Aktifkan tombol validasi
        document.getElementById('btnValidate').disabled = false;

        // Cek tab CKG
        checkCKGTabOpen();

        // Hilangkan pulse upload
        refreshUploadPulse();

        showAlert(`✓ ${rows.length} pasien berhasil dimuat. Klik "Cek Data" untuk melanjutkan.`, 'success');

      } catch (err) {
        showAlert('Gagal membaca Excel: ' + err.message, 'danger');
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// ── Step Guide Helpers ─────────────────────────────────────────

function markStep(num, status) {
  const el = document.getElementById('step' + num);
  if (!el) return;
  el.classList.remove('step-active', 'step-done', 'step-pending', 'step-error');
  el.classList.add('step-' + status);

  const statusEl = document.getElementById('step' + num + 'Status');
  if (!statusEl) return;
  if (status === 'done') {
    statusEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (status === 'active') {
    statusEl.innerHTML = `<div class="step-pulse"></div>`;
  } else if (status === 'error') {
    statusEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    statusEl.innerHTML = '';
  }
}

function checkCKGTabOpen() {
  chrome.tabs.query({ url: 'https://sehatindonesiaku.kemkes.go.id/*' }, tabs => {
    if (chrome.runtime.lastError) return;
    if (tabs && tabs.length > 0) {
      markStep(3, 'done');
    } else {
      markStep(3, 'pending');
    }
  });
}

// ── Patient Preview ────────────────────────────────────────────

function showPatientPreview(rows) {
  const container = document.getElementById('previewList');
  const preview   = document.getElementById('patientPreview');
  if (!container || !preview) return;

  container.innerHTML = rows.map((r, i) => {
    const nik = String(r.NIK || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    return `
      <div class="preview-item">
        <span class="preview-idx">${i + 1}</span>
        <div class="preview-detail">
          <strong class="preview-name">${r.Nama || '—'}</strong>
          <span class="preview-meta">NIK: ${nik || '—'}</span>
          <span class="preview-meta">WA: ${r.No_WA || '—'}</span>
        </div>
        <div class="preview-check ${String(r.NIK || '').match(/^\d{16}$/) ? 'ok' : 'warn'}">
          ${String(r.NIK || '').match(/^\d{16}$/) ? '✓' : '⚠'}
        </div>
      </div>
    `;
  }).join('');

  preview.classList.remove('hidden');
}

// ── Validation ────────────────────────────────────────────────

async function runValidation() {
  if (!parsedRows.length) {
    showAlert('Upload file Excel terlebih dahulu', 'warning');
    return;
  }

  const results = [];
  const KEY_COLS = ['NIK', 'Nama', 'No_WA'];
  const FULL_COLS = [
    'NIK','Nama','TTL','Jenis_Kelamin','No_WA',
    'Pekerjaan','Alamat','Provinsi','Kabupaten',
    'Kecamatan','Kelurahan','Status_Nikah',
    'BB','TB','GDS','TD_Sistolik','TD_Diastolik',
    'Diagnosa','Tanggal_Periksa','No_Antrian'
  ];
  const cols = Object.keys(parsedRows[0] || {});

  // Cek jumlah pasien
  results.push({
    ok: parsedRows.length > 0,
    msg: `${parsedRows.length} data pasien ditemukan`,
  });

  // Cek kolom kunci
  KEY_COLS.forEach(c => {
    const ok = cols.includes(c);
    results.push({
      ok,
      msg: ok
        ? `Kolom "${c}" tersedia`
        : `Kolom "${c}" tidak ditemukan — download template di Setting`,
    });
  });

  // Cek kolom lengkap (warning, bukan error)
  const missingFull = FULL_COLS.filter(c => !cols.includes(c) && !KEY_COLS.includes(c));
  if (missingFull.length > 0) {
    results.push({
      ok: false,
      warn: true,
      msg: `${missingFull.length} kolom opsional tidak lengkap: ${missingFull.slice(0,3).join(', ')}${missingFull.length > 3 ? '…' : ''}`,
    });
  }

  // Cek NIK valid (16 digit)
  const badNIK = parsedRows.filter(r => !String(r.NIK).match(/^\d{16}$/));
  if (badNIK.length === 0) {
    results.push({ ok: true, msg: 'Semua NIK valid (16 digit angka)' });
  } else {
    results.push({
      ok: false,
      msg: `${badNIK.length} pasien memiliki NIK tidak valid — periksa file Excel`,
    });
  }

  // Cek tab CKG terbuka
  const tabs = await new Promise(res => {
    chrome.tabs.query({ url: 'https://sehatindonesiaku.kemkes.go.id/*' }, res);
  });
  results.push({
    ok: tabs && tabs.length > 0,
    warn: !(tabs && tabs.length > 0),
    msg: (tabs && tabs.length > 0)
      ? 'Halaman CKG sudah terbuka ✓'
      : 'Halaman CKG belum terbuka — akan dibuka otomatis saat "Jalankan"',
  });

  showValidationResult(results);
}

function showValidationResult(results) {
  const card    = document.getElementById('validationCard');
  const list    = document.getElementById('valResultList');
  const title   = document.getElementById('valCardTitle');
  const actions = document.getElementById('valCardActions');
  if (!card || !list) return;

  const hardFails = results.filter(r => !r.ok && !r.warn);
  const allOK     = hardFails.length === 0;

  title.textContent = allOK ? '✅ Data siap dijalankan!' : '⚠️ Perlu diperbaiki sebelum jalan';
  title.style.color = allOK ? '#059669' : '#d97706';

  list.innerHTML = results.map(r => `
    <div class="val-row ${r.ok ? 'val-ok' : r.warn ? 'val-warn' : 'val-fail'}">
      <span class="val-icon">${r.ok ? '✓' : r.warn ? '⚠' : '✗'}</span>
      <span class="val-msg">${r.msg}</span>
    </div>
  `).join('');

  card.classList.remove('hidden');

  if (allOK) {
    // Semua OK → tampilkan tombol Jalankan
    _validationPassed = true;
    markStep(2, 'done');
    markStep(4, 'active');
    const btnStart = document.getElementById('btnStart');
    btnStart.classList.remove('hidden');
    btnStart.disabled = false;
    // Sembunyikan validate, tampilkan start
    document.getElementById('btnValidate').classList.add('hidden');
    actions.classList.remove('hidden');
  }
}

// ── Controls ──────────────────────────────────────────────────

function setupControls() {
  document.getElementById('btnValidate').addEventListener('click', runValidation);
  document.getElementById('btnStart').addEventListener('click', startRun);
  document.getElementById('btnPause').addEventListener('click', togglePause);
  document.getElementById('btnStop').addEventListener('click', stopRun);
  document.getElementById('btnResume').addEventListener('click', resumeRun);
}

function startRun(resume = false) {
  if (!parsedRows.length && !resume) {
    showAlert('Upload file Excel terlebih dahulu', 'warning');
    return;
  }
  _runStartTime = Date.now();
  chrome.runtime.sendMessage({
    action: 'ckg_start',
    workflow: 'all',
    data: parsedRows,
    resume: !!resume,
  }, res => {
    if (chrome.runtime.lastError) {
      showHumanError(chrome.runtime.lastError.message, true);
      return;
    }
    if (!res?.ok) {
      showHumanError(res?.error || 'Gagal memulai run', true);
      return;
    }
    setRunState('running');
    markStep(4, 'active');
    document.getElementById('resumeBanner').classList.add('hidden');
    document.getElementById('cardSummary').classList.add('hidden');
    document.getElementById('runningBanner').classList.add('show');
    document.getElementById('runningBannerText').textContent = 'Sedang berjalan…';
  });
}

function togglePause() {
  chrome.runtime.sendMessage({ action: 'ckg_pause' }, res => {
    if (res?.paused) setRunState('paused');
    else              setRunState('running');
  });
}

function stopRun() {
  chrome.runtime.sendMessage({ action: 'ckg_stop' });
  setRunState('idle');
  resetProgress();
  _runStartTime = null;
  document.getElementById('runningBanner').classList.remove('show');
}

function resumeRun() {
  startRun(true);
}

// ── Run State ─────────────────────────────────────────────────

function setRunState(state) {
  runState = state;

  const btnValidate = document.getElementById('btnValidate');
  const btnStart    = document.getElementById('btnStart');
  const btnPause    = document.getElementById('btnPause');
  const btnStop     = document.getElementById('btnStop');
  const dot         = document.getElementById('statusDot');
  const statusTxt   = document.getElementById('statusText');
  const banner      = document.getElementById('runningBanner');

  dot.className = 'status-dot ' + state;

  switch (state) {
    case 'idle':
      statusTxt.textContent = 'Siap';
      // Restore state tombol sesuai validasi
      if (_validationPassed) {
        btnStart.classList.remove('hidden');
        btnStart.disabled = !parsedRows.length;
        btnValidate.classList.add('hidden');
      } else {
        btnValidate.classList.remove('hidden');
        btnValidate.disabled = !parsedRows.length;
        btnStart.classList.add('hidden');
      }
      btnPause.classList.add('hidden');
      btnStop.classList.add('hidden');
      banner.classList.remove('show');
      break;
    case 'running':
      statusTxt.textContent = 'Berjalan…';
      btnValidate.classList.add('hidden');
      btnStart.classList.add('hidden');
      btnPause.classList.remove('hidden');
      btnStop.classList.remove('hidden');
      btnPause.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
      banner.classList.add('show');
      break;
    case 'paused':
      statusTxt.textContent = 'Dijeda';
      btnPause.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Lanjut`;
      document.getElementById('runningBannerText').textContent = 'Dijeda…';
      break;
    case 'done':
      statusTxt.textContent = 'Selesai';
      markStep(4, 'done');
      if (_validationPassed) {
        btnStart.classList.remove('hidden');
        btnStart.disabled = !parsedRows.length;
        btnStart.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Ulangi`;
        btnValidate.classList.add('hidden');
      }
      btnPause.classList.add('hidden');
      btnStop.classList.add('hidden');
      banner.classList.remove('show');
      break;
  }
}

// ── Progress (Phase 3A — Progress Manusiawi + ETA) ────────────

export function updateProgress({ current, total, pasien, status }) {
  const pct  = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar  = document.getElementById('progressBar');
  const text = document.getElementById('progressText');
  const frac = document.getElementById('progressFrac');
  const cur  = document.getElementById('currentPasien');
  const eta  = document.getElementById('progressETA');

  bar.style.width  = pct + '%';
  frac.textContent = `${current}/${total}`;
  setPct(pct);

  if (status === 'running') {
    text.textContent = `Sedang memproses pasien ${current} dari ${total}`;
    cur.textContent  = pasien ? `Nama: ${pasien}` : '';
  } else if (status === 'ok') {
    text.textContent = `✓ ${pasien || 'Pasien'} berhasil didaftarkan`;
    cur.textContent  = '';
  } else if (status === 'fail') {
    text.textContent = `✗ ${pasien || 'Pasien'} gagal — lanjut ke berikutnya`;
    cur.textContent  = '';
  }

  // ETA Calculation
  if (eta && _runStartTime && current > 0) {
    const elapsed   = (Date.now() - _runStartTime) / 1000; // seconds
    const perPasien = elapsed / current;
    const remaining = Math.round(perPasien * (total - current));
    let etaText;
    if (remaining > 3600) {
      etaText = `${Math.floor(remaining / 3600)} jam ${Math.ceil((remaining % 3600) / 60)} menit lagi`;
    } else if (remaining > 60) {
      etaText = `${Math.ceil(remaining / 60)} menit lagi`;
    } else {
      etaText = `${remaining} detik lagi`;
    }
    eta.textContent = `⏱ Perkiraan selesai: ${etaText}`;
    eta.classList.remove('hidden');
  } else if (eta) {
    eta.classList.add('hidden');
  }
}

function setPct(pct) {
  const el = document.getElementById('progressPct');
  if (el) el.textContent = pct + '%';
}

export function showSummary({ ok = 0, fail = 0, aborted = false, error = null } = {}) {
  const card = document.getElementById('cardSummary');
  card.classList.remove('hidden');
  document.getElementById('summaryOk').textContent    = ok;
  document.getElementById('summaryFail').textContent  = fail;
  document.getElementById('summaryTotal').textContent = ok + fail;

  // Sembunyikan ETA saat selesai
  const eta = document.getElementById('progressETA');
  if (eta) eta.classList.add('hidden');

  const badge = document.getElementById('summaryBadge');
  if (badge) {
    if (aborted) {
      badge.textContent   = error ? '⚠ Aborted: ' + error.slice(0, 60) : '⚠ Run dihentikan karena error fatal';
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Tombol Export
  const btnExportRun = document.getElementById('btnExportRunSummary');
  if (btnExportRun) {
    btnExportRun.classList.remove('hidden');
    btnExportRun.onclick = exportRunSummaryCSV;
  }

  // Tombol Salin Ringkasan WA (Phase 3)
  const btnCopyWA = document.getElementById('btnCopyWA');
  if (btnCopyWA) {
    btnCopyWA.classList.remove('hidden');
    btnCopyWA.onclick = () => copyWASummary(ok, fail);
  }

  // Simpan ke dashboard stats
  saveDashboardStats(ok, fail);

  setRunState('done');
  showAlert(
    `Run selesai — ${ok} berhasil, ${fail} gagal dari ${ok + fail} pasien.`,
    ok && !fail ? 'success' : fail ? 'warning' : 'info'
  );
}

function copyWASummary(ok, fail) {
  const now      = new Date().toLocaleString('id-ID');
  const duration = _runStartTime
    ? Math.round((Date.now() - _runStartTime) / 60000) + ' menit'
    : '—';
  const text = `✅ Auto CKG selesai (${now})\n• Berhasil: ${ok} pasien\n• Gagal: ${fail} pasien\n• Durasi: ${duration}\n\n_Via Auto CKG KlikPro_`;
  navigator.clipboard.writeText(text)
    .then(() => showAlert('Ringkasan disalin ke clipboard!', 'success'))
    .catch(() => showAlert('Gagal menyalin — coba manual', 'warning'));
}

function resetProgress() {
  document.getElementById('progressBar').style.width  = '0%';
  document.getElementById('progressText').textContent = parsedRows.length ? `${parsedRows.length} pasien siap` : 'Belum dimulai';
  document.getElementById('progressFrac').textContent = parsedRows.length ? `0/${parsedRows.length}` : '—';
  setPct(0);
  document.getElementById('currentPasien').textContent = '';
  const eta = document.getElementById('progressETA');
  if (eta) eta.classList.add('hidden');
}

// ── Human Error Display (Phase 3B) ────────────────────────────

function humanizeError(rawError) {
  if (!rawError) return { msg: 'Terjadi kesalahan tidak diketahui.', tips: ['Coba ulangi proses', 'Hubungi support KlikPro jika masalah berlanjut'] };
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (rawError.includes(key)) return val;
  }
  return {
    msg: 'Terjadi kesalahan: ' + rawError.slice(0, 80),
    tips: ['Coba ulangi proses', 'Hubungi support KlikPro jika masalah berlanjut'],
  };
}

function showHumanError(rawError, isFatal = false) {
  const area = document.getElementById('alertArea');
  if (!area) return;

  const { msg, tips } = humanizeError(rawError);

  const el = document.createElement('div');
  el.className = 'error-card';
  el.innerHTML = `
    <div class="error-title">⚠️ ${msg}</div>
    ${tips && tips.length ? `
      <div class="error-tips">
        <div class="error-tips-title">Kemungkinan penyebab:</div>
        ${tips.map(t => `<div class="error-tip">• ${t}</div>`).join('')}
      </div>
    ` : ''}
    <div class="error-actions">
      ${isFatal ? '' : '<button class="btn-err-action" id="errBtnRetry">🔄 Ulangi</button>'}
      <button class="btn-err-action btn-err-support" id="errBtnSupport">💬 Hubungi Support</button>
      <button class="btn-err-dismiss" id="errBtnDismiss">✕</button>
    </div>
  `;
  area.appendChild(el);

  el.querySelector('#errBtnDismiss')?.addEventListener('click', () => el.remove());
  el.querySelector('#errBtnRetry')?.addEventListener('click', () => { el.remove(); startRun(); });
  el.querySelector('#errBtnSupport')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://klikpro.id/support' });
  });

  // Auto remove after 10s unless fatal
  if (!isFatal) setTimeout(() => el.remove(), 10000);
}

// ── Dashboard (Phase 4A) ───────────────────────────────────────

function loadDashboard() {
  chrome.storage.local.get('ckg_daily_stats', res => {
    const stats    = res['ckg_daily_stats'] || {};
    const today    = new Date().toLocaleDateString('id-ID');
    const todayStats = stats[today] || { ok: 0, fail: 0, lastRun: null };

    document.getElementById('dashOk').textContent   = todayStats.ok   || '—';
    document.getElementById('dashFail').textContent  = todayStats.fail || '—';

    const savedMin = (todayStats.ok || 0) * 5;
    const savedTxt = savedMin >= 60
      ? `${Math.floor(savedMin / 60)}j ${savedMin % 60}m`
      : savedMin > 0 ? `${savedMin}m` : '—';
    document.getElementById('dashTime').textContent = savedTxt;

    if (todayStats.lastRun) {
      document.getElementById('dashLast').textContent =
        'Terakhir: ' + new Date(todayStats.lastRun).toLocaleTimeString('id-ID');
    }
  });
}

function saveDashboardStats(ok, fail) {
  const today = new Date().toLocaleDateString('id-ID');
  chrome.storage.local.get('ckg_daily_stats', res => {
    const stats = res['ckg_daily_stats'] || {};
    const prev  = stats[today] || { ok: 0, fail: 0 };
    stats[today] = {
      ok:      (prev.ok  || 0) + ok,
      fail:    (prev.fail || 0) + fail,
      lastRun: Date.now(),
    };
    // Simpan hanya 30 hari terakhir
    const keys    = Object.keys(stats).sort().slice(-30);
    const trimmed = Object.fromEntries(keys.map(k => [k, stats[k]]));
    chrome.storage.local.set({ ckg_daily_stats: trimmed }, () => loadDashboard());
  });
}

// ── Excel Persistence ─────────────────────────────────────────

function saveExcelToStorage(name, rows) {
  try {
    // Simpan max 500 baris untuk mencegah storage overflow
    const toSave = rows.slice(0, 500);
    chrome.storage.local.set({
      ckg_excel_rows: toSave,
      ckg_excel_name: name,
    });
  } catch (_) {}
}

function restoreExcelFromStorage() {
  chrome.storage.local.get(['ckg_excel_rows', 'ckg_excel_name'], res => {
    const rows = res['ckg_excel_rows'];
    const name = res['ckg_excel_name'];
    if (!rows?.length) {
      refreshUploadPulse(); // tidak ada data → aktifkan pulse
      return;
    }

    parsedRows = rows;

    const uploadArea    = document.getElementById('uploadArea');
    const fileInfoRow   = document.getElementById('fileInfoRow');
    const fileName      = document.getElementById('fileName');
    const rowCount      = document.getElementById('rowCount');
    const dataBadge     = document.getElementById('dataBadge');
    const badgeRowCount = document.getElementById('badgeRowCount');

    uploadArea.classList.add('hidden');
    fileInfoRow.classList.remove('hidden');
    fileName.textContent      = name || 'data_pasien.xlsx';
    rowCount.textContent      = `${rows.length} pasien`;
    badgeRowCount.textContent = rows.length;
    dataBadge.classList.add('show');

    document.getElementById('progressText').textContent = `${rows.length} pasien siap`;
    document.getElementById('progressFrac').textContent = `0/${rows.length}`;
    setPct(0);

    // Tampilkan preview + aktifkan validate
    showPatientPreview(rows.slice(0, 3));
    markStep(1, 'done');
    markStep(2, 'active');
    document.getElementById('btnValidate').disabled = false;
    checkCKGTabOpen();
    refreshUploadPulse(); // ada data → matikan pulse
  });
}

// ── Clear Excel Data ──────────────────────────────────────────

function clearExcelData() {
  // Reset state
  parsedRows        = [];
  _validationPassed = false;

  // Hapus dari storage
  chrome.storage.local.remove(['ckg_excel_rows', 'ckg_excel_name']);

  // Reset UI upload area
  const uploadArea  = document.getElementById('uploadArea');
  const fileInfoRow = document.getElementById('fileInfoRow');
  const dataBadge   = document.getElementById('dataBadge');
  const fileInput   = document.getElementById('fileInput');

  if (fileInfoRow) fileInfoRow.classList.add('hidden');
  if (uploadArea)  uploadArea.classList.remove('hidden');
  if (dataBadge)   dataBadge.classList.remove('show');
  if (fileInput)   fileInput.value = '';

  // Sembunyikan preview & validasi
  document.getElementById('patientPreview')?.classList.add('hidden');
  document.getElementById('validationCard')?.classList.add('hidden');

  // Reset steps
  markStep(1, 'pending');
  markStep(2, 'pending');
  markStep(3, 'pending');
  markStep(4, 'pending');

  // Reset progress
  document.getElementById('progressText').textContent = 'Belum dimulai';
  document.getElementById('progressFrac').textContent = '—';
  document.getElementById('badgeRowCount').textContent = 0;
  document.getElementById('rowCount').textContent = '0 pasien';
  setPct(0);
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('currentPasien').textContent = '';
  document.getElementById('progressETA')?.classList.add('hidden');
  document.getElementById('cardSummary')?.classList.add('hidden');

  // Reset tombol
  const btnValidate = document.getElementById('btnValidate');
  const btnStart    = document.getElementById('btnStart');
  if (btnValidate) { btnValidate.classList.remove('hidden'); btnValidate.disabled = true; }
  if (btnStart)    { btnStart.classList.add('hidden'); btnStart.disabled = true; }

  showAlert('Data Excel dihapus. Upload file baru untuk melanjutkan.', 'info');

  // Aktifkan kembali pulse upload
  refreshUploadPulse();
}

// ── Resume Banner ─────────────────────────────────────────────

async function checkResumeBanner() {
  try {
    const res = await chrome.storage.session.get('ckg_session_run_state');
    if (res['ckg_session_run_state']) {
      document.getElementById('resumeBanner').classList.remove('hidden');
    }
  } catch (_) {}
}

// ── Background Listener ───────────────────────────────────────

function listenBackground() {
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'ckg_progress') {
      updateProgress(msg);
    } else if (msg.action === 'ckg_done') {
      showSummary(msg.summary);
    } else if (msg.action === 'ckg_error') {
      showHumanError(msg.error);
    }
  });
}

// ── Alert ─────────────────────────────────────────────────────

function showAlert(msg, level = 'info') {
  const area = document.getElementById('alertArea');
  if (!area) return;

  const cls = { success: 'alert-success', warning: 'alert-warning', danger: 'alert-danger', info: 'alert-info' }[level] || 'alert-info';
  const icons = {
    success: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`,
    danger:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>`,
  };

  const el = document.createElement('div');
  el.className = `alert ${cls}`;
  el.innerHTML = `${icons[level] || icons.info}<span>${msg}</span>`;
  area.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ── Validation Error Modal (backward compat) ──────────────────

function showValidationError(missingCols) {
  // Arahkan ke showValidationResult dengan format baru
  const results = missingCols.map(c => ({
    ok: false,
    msg: `Kolom "${c}" tidak ditemukan di file Excel`,
  }));
  results.unshift({ ok: false, msg: `${missingCols.length} kolom wajib tidak ditemukan` });
  showValidationResult(results);
}

// ── Export Run Summary ────────────────────────────────────────

export async function exportRunSummaryCSV() {
  try {
    const res  = await chrome.runtime.sendMessage({ action: 'ckg_get_run_log' });
    const logs = res?.logs || [];
    if (!logs.length) { showAlert('Belum ada data run log', 'warning'); return; }

    const rows = [
      ['Waktu', 'Tipe', 'Pesan'],
      ...logs.map(l => [
        new Date(l.time).toLocaleString('id-ID'),
        l.type    || 'info',
        l.message || ''
      ])
    ];
    const csv  = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ckg_run_summary_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showAlert('Run summary berhasil diexport', 'success');
  } catch (err) {
    showAlert('Gagal export: ' + err.message, 'danger');
  }
}

// ── DEVELOPER MODE — v2.0 ─────────────────────────────────────────────────────

/**
 * Initialize Developer Mode tab visibility and wire all action buttons.
 * Called from popup.js during tab init if devMode setting is enabled.
 */
export function initDevMode() {
  // Show Developer Mode tab button
  const tabBtn = document.getElementById('tabBtnDevMode');
  if (tabBtn) tabBtn.classList.remove('hidden');

  // Restore Safe Mode toggle from storage
  chrome.storage.local.get('ckg_settings', res => {
    const settings  = res.ckg_settings || {};
    const safeMode  = settings.safeMode !== false; // default true
    const toggle    = document.getElementById('safeModeToggle');
    if (toggle) {
      toggle.checked = safeMode;
      toggle.addEventListener('change', () => {
        chrome.storage.local.get('ckg_settings', r => {
          const s = r.ckg_settings || {};
          s.safeMode = toggle.checked;
          chrome.storage.local.set({ ckg_settings: s });
          showAlert(`Safe Mode: ${toggle.checked ? 'ON' : 'OFF'}`, 'info');
        });
      });
    }
  });

  // ── Wire buttons ──────────────────────────────────────────────────────────

  // Extract Current Schema
  document.getElementById('btnExtractSchema')?.addEventListener('click', async () => {
    setDevOutput('⏳ Mengextract schema dari halaman aktif…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_extract_schema' });
      if (res?.ok && res.schema) {
        setDevOutput(JSON.stringify(res.schema, null, 2));
        // Auto-save to storage
        await chrome.runtime.sendMessage({ action: 'ckg_save_schema', schema: res.schema });
        showAlert(`✓ Schema "${res.schema.screen}" berhasil diekstrak dan disimpan`, 'success');
      } else {
        setDevOutput(`❌ Gagal extract schema:\n${res?.error || 'Tidak ada tab SATUSEHAT aktif'}`);
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Export Schema (download last extracted)
  document.getElementById('btnExportSchema')?.addEventListener('click', async () => {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_get_schemas' });
      const schemas = res?.schemas || [];
      if (!schemas.length) {
        setDevOutput('❌ Tidak ada schema tersimpan. Gunakan "Extract Current Schema" terlebih dahulu.');
        return;
      }
      // Download all schemas as one JSON bundle
      const blob = new Blob([JSON.stringify(schemas, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `ckg_schemas_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDevOutput(`✅ Exported ${schemas.length} schema(s)`);
      showAlert('Schema berhasil di-download', 'success');
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Compare Schema
  document.getElementById('btnCompareSchema')?.addEventListener('click', async () => {
    setDevOutput('⏳ Membandingkan schema…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_compare_schema' });
      if (res?.ok) {
        setDevOutput(res.report || JSON.stringify(res.diff, null, 2));
        const sev = res.diff?.severity || 'none';
        const level = sev === 'none' ? 'success' : sev === 'critical' ? 'danger' : 'warning';
        showAlert(`Schema compare selesai — severity: ${sev}`, level);
      } else {
        setDevOutput(`❌ Gagal compare: ${res?.error || 'Error tidak diketahui'}`);
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Generate Fingerprint
  document.getElementById('btnGenerateFingerprint')?.addEventListener('click', async () => {
    setDevOutput('⏳ Generating fingerprint…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_extract_schema' });
      if (res?.ok && res.schema) {
        const fp = res.schema.fingerprint;
        const q  = res.schema.questions?.length || 0;
        setDevOutput(`🔑 Screen: ${res.schema.screen}\n🔑 Fingerprint: ${fp}\n📋 Questions: ${q}\n🕒 Generated: ${res.schema.generatedAt}`);
        showAlert(`Fingerprint: ${fp}`, 'info');
      } else {
        setDevOutput(`❌ Gagal: ${res?.error || 'Tidak ada tab SATUSEHAT aktif'}`);
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // View Unknown Questions
  document.getElementById('btnViewUnknown')?.addEventListener('click', async () => {
    setDevOutput('⏳ Memuat unknown questions…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_get_unknown' });
      const items = res?.items || [];
      if (!items.length) {
        setDevOutput('✅ Tidak ada pertanyaan tidak dikenal.\nSemua pertanyaan sudah ada di Schema Repository.');
      } else {
        const lines = [`❓ ${items.length} pertanyaan tidak dikenal:\n`];
        items.forEach((item, i) => {
          lines.push(`${i + 1}. [${item.screen || '?'}] ${item.question}`);
          lines.push(`   Tipe: ${item.type || '?'} | ${item.timestamp?.slice(0, 19) || '?'}`);
        });
        setDevOutput(lines.join('\n'));
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // View Audit Logs
  document.getElementById('btnViewAuditLog')?.addEventListener('click', async () => {
    setDevOutput('⏳ Memuat audit log…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_get_audit_log' });
      const logs = res?.logs || [];
      if (!logs.length) {
        setDevOutput('📋 Audit log kosong — belum ada auto-fill yang terekam.');
      } else {
        const recent = logs.slice(-20).reverse();
        const lines  = [`📋 ${logs.length} total entri (menampilkan 20 terbaru):\n`];
        recent.forEach((e, i) => {
          lines.push(`${i + 1}. [${e.timestamp?.slice(0, 19)}] ${e.screen || '?'}`);
          lines.push(`   Q: ${e.question}`);
          lines.push(`   A: ${e.answer}${e.ppv ? ` (PPV: ${e.ppv})` : ''}`);
          if (e.pasien) lines.push(`   Pasien: ${e.pasien}`);
        });
        setDevOutput(lines.join('\n'));
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Clear Audit Log
  document.getElementById('btnClearAuditLog')?.addEventListener('click', async () => {
    if (!confirm('Hapus semua audit log? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await chrome.runtime.sendMessage({ action: 'ckg_clear_audit_log' });
      setDevOutput('✅ Audit log berhasil dihapus.');
      showAlert('Audit log dihapus', 'info');
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Export Audit CSV
  document.getElementById('btnExportAuditCSV')?.addEventListener('click', async () => {
    setDevOutput('⏳ Mempersiapkan export CSV…');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'ckg_export_audit_csv' });
      if (res?.ok && res.csv) {
        const blob = new Blob(['\ufeff' + res.csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `ckg_audit_log_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setDevOutput(`✅ Audit log CSV berhasil di-download (${res.count} entri)`);
        showAlert('Audit CSV berhasil diexport', 'success');
      } else {
        setDevOutput('❌ Gagal export — log mungkin kosong');
      }
    } catch (e) {
      setDevOutput(`❌ Error: ${e.message}`);
    }
  });

  // Copy output
  document.getElementById('btnCopyDevOutput')?.addEventListener('click', () => {
    const output = document.getElementById('devOutput');
    if (!output) return;
    navigator.clipboard.writeText(output.textContent)
      .then(() => showAlert('Output disalin ke clipboard', 'success'))
      .catch(() => showAlert('Gagal menyalin', 'warning'));
  });

  // Clear output
  document.getElementById('btnClearDevOutput')?.addEventListener('click', () => {
    setDevOutput('— Pilih aksi di atas untuk melihat output —');
  });

  // Listen for schema-related background messages
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'ckg_schema_extracted') {
      showAlert(`Schema "${msg.screen}" berhasil diperbarui`, 'success');
    } else if (msg.action === 'ckg_unknown_found') {
      const count = msg.count || 0;
      if (count > 0) {
        showAlert(`⚠ ${count} pertanyaan tidak dikenal ditemukan di ${msg.screen}`, 'warning');
      }
    }
  });
}

function setDevOutput(text) {
  const el = document.getElementById('devOutput');
  if (el) el.textContent = text;
}

