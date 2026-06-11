/**
 * src/ui/onboarding.js — CKG Auto KlikPro v2.0 (Phase 2)
 * Wizard onboarding 4 layar untuk pengguna baru.
 * Dipanggil oleh popup_main.js saat ckg_onboarded belum ada.
 */

const SLIDES = [
  {
    emoji: '🏥',
    title: 'Selamat Datang di Auto CKG',
    sub:   'Powered by KlikPro',
    body: {
      stepNum: null,
      stepTitle: 'Daftarkan ratusan pasien CKG\nhanya dalam beberapa menit',
      list: [
        'Otomatis isi form Sehat Indonesiaku',
        'Tidak perlu ketik satu per satu',
        'Cukup siapkan file Excel pasien',
      ],
    },
    nextLabel: 'Mulai Tutorial →',
    showSkip: true,
  },
  {
    emoji: '📥',
    title: 'Langkah 1',
    sub:   'Persiapan File Excel',
    body: {
      stepNum: 'Langkah 1 dari 3',
      stepTitle: 'Download & Isi Template Excel',
      list: [
        'Klik "Download Template" di tab Setting',
        'Isi data pasien di kolom yang tersedia',
        'Pastikan kolom NIK berisi 16 digit angka',
        'Simpan file dengan nama yang mudah diingat',
      ],
    },
    nextLabel: 'Lanjut →',
    showSkip: true,
    actionBtn: { label: '⬇ Download Template Sekarang', key: 'download' },
  },
  {
    emoji: '✏️',
    title: 'Langkah 2',
    sub:   'Upload Data',
    body: {
      stepNum: 'Langkah 2 dari 3',
      stepTitle: 'Upload File & Cek Data',
      list: [
        'Klik area upload atau drag & drop file Excel',
        'Klik "Cek Data" untuk memvalidasi',
        'Pastikan semua tanda ✓ hijau sebelum lanjut',
        'Perbaiki file jika ada kolom yang salah',
      ],
    },
    nextLabel: 'Lanjut →',
    showSkip: true,
  },
  {
    emoji: '🚀',
    title: 'Langkah 3',
    sub:   'Jalankan Otomatis',
    body: {
      stepNum: 'Langkah 3 dari 3',
      stepTitle: 'Buka CKG & Jalankan',
      list: [
        'Buka halaman sehatindonesiaku.kemkes.go.id',
        'Kembali ke popup ini',
        'Klik tombol "Jalankan Semua"',
        'Duduk santai — sistem bekerja otomatis ☕',
      ],
    },
    nextLabel: 'Mulai Sekarang ✓',
    showSkip: false,
  },
];

let _currentSlide = 0;
let _overlay = null;

export function showOnboarding() {
  // Guard: jangan tampil jika sudah ada
  if (document.getElementById('onboardingOverlay')?.classList.contains('active')) return;

  const overlay = document.getElementById('onboardingOverlay');
  if (!overlay) return;
  _overlay = overlay;
  _currentSlide = 0;
  overlay.classList.remove('hidden');
  overlay.classList.add('active');
  renderSlide();
}

function renderSlide() {
  if (!_overlay) return;
  const card = _overlay.querySelector('#onboardingCard');
  if (!card) return;

  const slide = SLIDES[_currentSlide];
  const isLast = _currentSlide === SLIDES.length - 1;

  card.innerHTML = `
    <div class="ob-header">
      <span class="ob-emoji">${slide.emoji}</span>
      <div class="ob-title">${slide.title}</div>
      <div class="ob-sub">${slide.sub}</div>
    </div>
    <div class="ob-body">
      ${slide.body.stepNum ? `<div class="ob-step-num">${slide.body.stepNum}</div>` : ''}
      <div class="ob-step-title">${slide.body.stepTitle.replace(/\n/g, '<br>')}</div>
      <ul class="ob-list">
        ${slide.body.list.map(item => `<li>${item}</li>`).join('')}
      </ul>
      ${slide.actionBtn ? `
        <button class="btn btn-primary" id="obActionBtn" style="width:100%;margin-bottom:6px">
          ${slide.actionBtn.label}
        </button>
      ` : ''}
    </div>
    <div class="ob-footer">
      <div class="ob-dots">
        ${SLIDES.map((_, i) => `<div class="ob-dot ${i === _currentSlide ? 'active' : ''}"></div>`).join('')}
      </div>
      <div class="ob-btns">
        ${slide.showSkip ? `<button class="ob-btn-skip" id="obBtnSkip">Lewati</button>` : ''}
        ${_currentSlide > 0 ? `<button class="ob-btn-skip" id="obBtnBack" style="color:var(--text2)">← Kembali</button>` : ''}
        <button class="ob-btn-next" id="obBtnNext">${slide.nextLabel}</button>
      </div>
    </div>
  `;

  // Event listeners
  card.querySelector('#obBtnNext')?.addEventListener('click', () => {
    if (isLast) {
      finishOnboarding();
    } else {
      _currentSlide++;
      renderSlide();
    }
  });

  card.querySelector('#obBtnSkip')?.addEventListener('click', finishOnboarding);

  card.querySelector('#obBtnBack')?.addEventListener('click', () => {
    if (_currentSlide > 0) {
      _currentSlide--;
      renderSlide();
    }
  });

  card.querySelector('#obActionBtn')?.addEventListener('click', (e) => {
    const action = SLIDES[_currentSlide].actionBtn?.key;
    if (action === 'download') {
      // Trigger download template — switch ke tab Setting
      finishOnboarding();
      setTimeout(() => {
        // Pindah ke tab setting & trigger download
        const settingTab = document.querySelector('[data-tab="setting"]');
        if (settingTab) settingTab.click();
        // Cari tombol download di setting tab
        setTimeout(() => {
          const dlBtn = document.getElementById('btnDownloadTemplate');
          if (dlBtn) dlBtn.click();
        }, 300);
      }, 200);
    }
    e.stopPropagation();
  });

  // Klik overlay di luar card tidak menutup (UX: harus pilih tombol)
}

function finishOnboarding() {
  if (_overlay) {
    _overlay.classList.add('hidden');
    _overlay.classList.remove('active');
  }
  chrome.storage.local.set({ ckg_onboarded: true });
}
