// element_picker.js — CKG Auto KlikPro v1.7
// Di-inject on-demand oleh background.js saat user klik "Pilih dari Halaman".
// Overlay hover-highlight, klik → generate selector → kirim ke options.

(function () {
  'use strict';

  // Guard: cegah double-inject
  if (window.__ckgPickerLoaded) return;
  window.__ckgPickerLoaded = true;

  // ── Overlay ────────────────────────────────────────────────────────────────

  const _overlay = document.createElement('div');
  _overlay.id = '__ckg_picker_overlay';
  _overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483646',
    'cursor:crosshair', 'background:rgba(37,99,235,0.04)',
    'pointer-events:all',
  ].join(';');
  document.body.appendChild(_overlay);

  // Highlight box yang mengikuti elemen yang di-hover
  const _highlight = document.createElement('div');
  _highlight.id = '__ckg_picker_highlight';
  _highlight.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'pointer-events:none',
    'border:2px solid #2563eb', 'border-radius:3px',
    'background:rgba(37,99,235,0.1)',
    'transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s',
    'box-shadow:0 0 0 1px rgba(255,255,255,0.6)',
  ].join(';');
  document.body.appendChild(_highlight);

  // Label tooltip
  const _tooltip = document.createElement('div');
  _tooltip.id = '__ckg_picker_tooltip';
  _tooltip.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'pointer-events:none',
    'background:#1e3a8a', 'color:#fff',
    'font:600 11px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",monospace',
    'padding:4px 8px', 'border-radius:5px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
    'white-space:nowrap', 'max-width:320px',
    'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');
  document.body.appendChild(_tooltip);

  // Instruksi banner
  const _banner = document.createElement('div');
  _banner.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'pointer-events:none',
    'background:rgba(30,58,138,0.95)', 'color:#fff',
    'font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'padding:8px 18px', 'border-radius:20px',
    'box-shadow:0 2px 12px rgba(0,0,0,0.35)',
    'backdrop-filter:blur(6px)',
  ].join(';');
  _banner.textContent = '🎯 Klik elemen yang ingin dipilih  •  Esc untuk batal';
  document.body.appendChild(_banner);

  // ── Selector generator ────────────────────────────────────────────────────

  function _bestSelector(el) {
    if (el.id && !el.id.includes(' '))        return `#${el.id}`;
    if (el.name && !el.name.includes(' '))    return `[name="${el.name}"]`;
    if (el.placeholder)                       return `[placeholder="${el.placeholder}"]`;

    // CSS path ringkas (max 3 level, filter class noise)
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 3) {
      let seg = node.tagName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        const cls = [...node.classList]
          .filter(c => !c.match(/^(ng-|v-|js-|is-|has-|active|focus|hover)/))
          .slice(0, 2);
        if (cls.length) seg += '.' + cls.join('.');
      }
      parts.unshift(seg);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  // ── Hover ─────────────────────────────────────────────────────────────────

  let _lastEl = null;

  function _onMousemove(e) {
    // Tentukan elemen di bawah overlay
    _overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    _overlay.style.pointerEvents = 'all';

    if (!el || el === _lastEl) return;
    _lastEl = el;

    const rect = el.getBoundingClientRect();
    _highlight.style.cssText += [
      `;top:${rect.top}px`, `left:${rect.left}px`,
      `width:${rect.width}px`, `height:${rect.height}px`,
      'display:block',
    ].join(';');

    const sel = _bestSelector(el);
    _tooltip.textContent = sel;
    // Position tooltip above element
    const tipTop = rect.top > 36 ? rect.top - 28 : rect.bottom + 4;
    _tooltip.style.top  = `${tipTop}px`;
    _tooltip.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 200))}px`;
  }

  // ── Click: pilih elemen ───────────────────────────────────────────────────

  function _onMousedown(e) {
    e.preventDefault();
    e.stopPropagation();

    _overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    _overlay.style.pointerEvents = 'all';

    if (!el) { _cleanup(); return; }

    const selector = _bestSelector(el);
    const text     = (el.innerText || el.textContent || '').trim().slice(0, 80);
    const tag      = el.tagName.toLowerCase();

    try {
      chrome.runtime.sendMessage({
        action: 'ckg_element_picked',
        selector, tag, text,
      });
    } catch (_) {}

    _cleanup();
  }

  // ── Escape: batal ─────────────────────────────────────────────────────────

  function _onKeydown(e) {
    if (e.key === 'Escape') _cleanup(true);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  function _cleanup(cancelled = false) {
    _overlay.remove();
    _highlight.remove();
    _tooltip.remove();
    _banner.remove();
    document.removeEventListener('mousemove', _onMousemove, true);
    document.removeEventListener('keydown',   _onKeydown,   true);
    _overlay.removeEventListener('mousedown', _onMousedown);
    window.__ckgPickerLoaded = false;

    if (cancelled) {
      try { chrome.runtime.sendMessage({ action: 'ckg_pick_cancelled' }); } catch (_) {}
    }
  }

  // ── Register ──────────────────────────────────────────────────────────────

  _overlay.addEventListener('mousedown', _onMousedown);
  document.addEventListener('mousemove', _onMousemove, { capture: true, passive: true });
  document.addEventListener('keydown',   _onKeydown,   { capture: true });

  // Jika options.html kirim cancel
  chrome.runtime.onMessage.addListener(function _cancelHandler(msg) {
    if (msg.action === 'ckg_cancel_pick') {
      _cleanup(false);
      chrome.runtime.onMessage.removeListener(_cancelHandler);
    }
  });

  console.log('[CKG] Element picker injected ✓');
})();
