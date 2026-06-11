// content.js - CKG Auto KlikPro v1.0
// Guard loader untuk MV3 content script
// Menerima job dari background via window.__ckgJob, menulis hasil ke window.__ckgResult

(function () {
  'use strict';

  // Hindari double-inject
  if (window.__ckgContentLoaded) return;
  window.__ckgContentLoaded = true;

  // ── Job polling ──────────────────────────────────────────────────────────
  // Background inject __ckgJob via chrome.scripting.executeScript
  // Content baca, eksekusi, tulis __ckgResult

  // Flag untuk satu eksekusi step at a time
  let _busy = false;

  const _observer = new MutationObserver(() => {
    if (!window.__ckgJob || _busy) return;
    _busy = true;
    const job = window.__ckgJob;
    window.__ckgJob = null;
    _executeJob(job).then(result => {
      window.__ckgResult = result;
      _busy = false;
    });
  });

  _observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-ckg-job']
  });

  // ── Message listener dari background ────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ckg_ping') {
      sendResponse({ alive: true, url: location.href });
      return true;
    }

    if (msg.action === 'ckg_exec_step') {
      if (_busy) {
        sendResponse({ success: false, message: 'content: busy' });
        return true;
      }
      _busy = true;
      _executeJob(msg.step, msg.pasienData, msg.settings)
        .then(result => {
          _busy = false;
          sendResponse(result);
        })
        .catch(err => {
          _busy = false;
          sendResponse({ success: false, message: err.message });
        });
      return true; // async response
    }
  });

  // ── Job executor (dinamis import executor dari extension) ────────────────
  async function _executeJob(step, pasienData = {}, settings = {}) {
    try {
      // executor.js di-inject via scripting.executeScript dari background
      // Di sini kita call fungsi global yang sudah diexpose
      if (typeof window.__ckgExecuteStep === 'function') {
        return await window.__ckgExecuteStep(step, pasienData, settings);
      }

      // Fallback: eksekusi primitif langsung
      return await _primitiveFallback(step, pasienData);
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── Primitive fallback jika executor belum ter-inject ───────────────────
  async function _primitiveFallback(step, pasienData) {
    const value = step.excelColumn ? pasienData[step.excelColumn] : step.value;

    switch (step.type) {
      case 'navigate':
        location.href = step.value;
        return { success: true, message: `navigate: ${step.value}` };

      case 'click': {
        const el = document.querySelector(step.selector);
        if (!el) return { success: false, message: `click: tidak ditemukan "${step.selector}"` };
        el.click();
        return { success: true, message: `click: OK` };
      }

      case 'type': {
        const el = document.querySelector(step.selector);
        if (!el) return { success: false, message: `type: tidak ditemukan "${step.selector}"` };
        el.focus();
        el.value = String(value ?? '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, message: `type: OK "${value}"` };
      }

      case 'wait': {
        const ms = parseInt(step.value) || 2000;
        await new Promise(r => setTimeout(r, ms));
        return { success: true, message: `wait: ${ms}ms` };
      }

      default:
        return { success: false, message: `fallback: type "${step.type}" tidak support` };
    }
  }

  console.log('[CKG AutoKlikPro] Content script loaded ✓', location.href);
})();
