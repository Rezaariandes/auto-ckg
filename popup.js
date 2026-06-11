// popup.js - CKG Auto KlikPro
// Entry point: tab routing, accordion, footer

import { initMainTab }    from './src/ui/popup_main.js';
import { initLogTab }     from './src/ui/popup_log.js';
import { initSettingTab } from './src/ui/popup_setting.js';
import { initBuilderTab } from './src/ui/popup_builder.js';

// ── Overlay mode: hide .app-header jika dibuka dari floating overlay ──────────
// Deteksi ?overlay=1 di URL — aman dari CSP karena ini module script
const _isOverlay = new URLSearchParams(location.search).get('overlay') === '1';
if (_isOverlay) {
  const s = document.createElement('style');
  // Di overlay: header tetap tampil (untuk tombol Full), tapi Builder tab disembunyikan
  s.textContent = `
    .app-header { display: flex !important; }
    #tabBtnBuilder { display: none !important; }
    .overlay-only { display: inline-flex !important; }
  `;
  document.head.appendChild(s);
}


// ── Accordion ──────────────────────────────────────────────────
// Delegated, CSP-safe. Reads data-acc-body / data-acc-chevron.

function initAccordions() {
  document.querySelectorAll('.acc-header[data-acc-body]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bodyId    = btn.dataset.accBody;
      const chevronId = btn.dataset.accChevron;
      const body      = document.getElementById(bodyId);
      const acc       = btn.closest('.accordion');
      const chv       = chevronId ? document.getElementById(chevronId) : null;
      if (!body) return;

      const isOpen = acc?.classList.contains('open');
      if (isOpen) {
        body.style.display = 'none';
        acc?.classList.remove('open');
        if (chv) chv.style.transform = 'rotate(-90deg)';
      } else {
        body.style.display = 'block';
        acc?.classList.add('open');
        if (chv) chv.style.transform = 'rotate(0deg)';
      }
    });
  });
}

// ── Tab Routing ────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`)?.classList.add('active');
    });
  });
}

// ── Footer ─────────────────────────────────────────────────────

function initFooter() {
  document.getElementById('footerOptions')?.addEventListener('click', e => {
    e.preventDefault();
    const target = e.currentTarget.dataset.tab || 'builder';
    const btn = document.querySelector(`.tab-btn[data-tab="${target}"]`);
    if (btn) btn.click();
  });
}

// ── Overlay: Full popup button ──────────────────────────────────

function initOverlay() {
  const btn = document.getElementById('btnOpenFullPopup');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const url = chrome.runtime.getURL('popup.html');
    chrome.windows.create({
      url,
      type: 'popup',
      width: 1100,
      height: 700,
    });
  });
}

// ── Step 3: Buka Website CKG ────────────────────────────────────

function initStep3() {
  const btn = document.getElementById('btnOpenCKG');
  if (!btn) return;

  const CKG_URL    = 'https://sehatindonesiaku.kemkes.go.id/profile';
  const CKG_MATCH  = 'https://sehatindonesiaku.kemkes.go.id/*';

  // Cek status saat init
  function checkAndMarkStep3() {
    chrome.tabs.query({ url: CKG_MATCH }, tabs => {
      if (chrome.runtime.lastError) return;
      const open = tabs && tabs.length > 0;
      const step3 = document.getElementById('step3');
      const step3Status = document.getElementById('step3Status');
      if (open) {
        step3?.classList.remove('step-pending');
        step3?.classList.add('step-done');
        if (step3Status) step3Status.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      } else {
        step3?.classList.remove('step-done', 'step-active');
        step3?.classList.add('step-pending');
        if (step3Status) step3Status.innerHTML = '';
      }
    });
  }

  checkAndMarkStep3();

  // Tombol Buka Website
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Membuka…`;

    chrome.tabs.query({ url: CKG_MATCH }, tabs => {
      if (tabs && tabs.length > 0) {
        // Sudah ada tab CKG — fokus ke tab itu
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
        checkAndMarkStep3();
        resetBtn();
      } else {
        // Buka tab baru
        chrome.tabs.create({ url: CKG_URL, active: true }, () => {
          if (chrome.runtime.lastError) {
            resetBtn();
            return;
          }
          // Tunggu sebentar lalu cek
          setTimeout(() => {
            checkAndMarkStep3();
            resetBtn();
          }, 2500);
        });
      }
    });

    function resetBtn() {
      btn.disabled = false;
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Buka Website &amp; Login`;
    }
  });

  // Listen event tab closed/updated agar status step 3 sinkron
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.url || changeInfo.status === 'complete') checkAndMarkStep3();
    });
  }
  if (chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener(() => checkAndMarkStep3());
  }
}

// ── Init ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initTabs();
  initFooter();
  initOverlay();
  initStep3();
  initMainTab();
  initLogTab();
  initSettingTab();
  initBuilderTab().catch(console.error);
});

