// recorder.js — CKG Auto KlikPro v2.0
// Di-inject on-demand oleh background.js saat mode rekam aktif.
// Menampilkan floating toolbar Stop/Undo/Pause + merekam klik & input.

(function () {
  'use strict';

  // Guard: cegah double-inject
  if (window.__ckgRecorderLoaded) return;
  window.__ckgRecorderLoaded = true;

  // ── State ────────────────────────────────────────────────────────────────

  let _eventCount = 0;
  let _active     = true;
  let _paused     = false;
  const _debounce = new Map();

  // ── Inject CSS ───────────────────────────────────────────────────────────

  const _style = document.createElement('style');
  _style.textContent = `
    @keyframes __ckg_blink {
      0%,100% { opacity:1; } 50% { opacity:0.25; }
    }
    @keyframes __ckg_fadein {
      from { opacity:0; transform:translateY(12px) scale(0.95); }
      to   { opacity:1; transform:translateY(0)    scale(1);    }
    }
    #__ckg_toolbar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 0;
      background: rgba(15, 15, 20, 0.96);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 40px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
      backdrop-filter: blur(16px);
      padding: 6px 8px;
      user-select: none;
      animation: __ckg_fadein 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: grab;
      min-width: 320px;
    }
    #__ckg_toolbar:active { cursor: grabbing; }
    .__ckg_dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      background: #ef4444;
      flex-shrink: 0;
      animation: __ckg_blink 1.2s infinite;
      margin-right: 2px;
    }
    .__ckg_dot.paused {
      background: #f59e0b;
      animation: none;
    }
    .__ckg_label {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      padding: 0 10px 0 6px;
      letter-spacing: 0.01em;
    }
    .__ckg_count {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      background: rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 2px 9px;
      margin-right: 8px;
      letter-spacing: 0.02em;
      min-width: 42px;
      text-align: center;
    }
    .__ckg_divider {
      width: 1px;
      height: 22px;
      background: rgba(255,255,255,0.1);
      margin: 0 4px;
      flex-shrink: 0;
    }
    .__ckg_btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: none;
      cursor: pointer;
      border-radius: 28px;
      font-size: 11.5px;
      font-weight: 600;
      padding: 6px 13px;
      transition: background 0.15s, transform 0.1s, opacity 0.15s;
      white-space: nowrap;
      letter-spacing: 0.02em;
      font-family: inherit;
    }
    .__ckg_btn:active { transform: scale(0.94); }
    .__ckg_btn_undo {
      background: rgba(255,255,255,0.08);
      color: #cbd5e1;
    }
    .__ckg_btn_undo:hover { background: rgba(255,255,255,0.14); color: #f1f5f9; }
    .__ckg_btn_undo:disabled { opacity: 0.35; cursor: default; }
    .__ckg_btn_pause {
      background: rgba(245,158,11,0.15);
      color: #fbbf24;
    }
    .__ckg_btn_pause:hover { background: rgba(245,158,11,0.28); }
    .__ckg_btn_pause.is-paused {
      background: rgba(74,222,128,0.13);
      color: #4ade80;
    }
    .__ckg_btn_pause.is-paused:hover { background: rgba(74,222,128,0.24); }
    .__ckg_btn_stop {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #fff;
      box-shadow: 0 2px 8px rgba(220,38,38,0.4);
    }
    .__ckg_btn_stop:hover {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 3px 12px rgba(220,38,38,0.55);
    }
    .__ckg_drag_handle {
      cursor: grab;
      color: rgba(255,255,255,0.25);
      padding: 0 4px 0 2px;
      font-size: 14px;
      line-height: 1;
      flex-shrink: 0;
    }
    .__ckg_drag_handle:active { cursor: grabbing; }
  `;
  document.head.appendChild(_style);

  // ── Build Toolbar ────────────────────────────────────────────────────────

  const _toolbar = document.createElement('div');
  _toolbar.id = '__ckg_toolbar';
  _toolbar.innerHTML = `
    <span class="__ckg_drag_handle" title="Geser toolbar">⠿</span>
    <span class="__ckg_dot" id="__ckg_dot"></span>
    <span class="__ckg_label" id="__ckg_label">Merekam…</span>
    <span class="__ckg_count" id="__ckg_count">0 aksi</span>
    <span class="__ckg_divider"></span>
    <button class="__ckg_btn __ckg_btn_undo" id="__ckg_btn_undo" disabled title="Hapus aksi terakhir">
      ↩ Undo
    </button>
    <button class="__ckg_btn __ckg_btn_pause" id="__ckg_btn_pause" title="Jeda rekaman sementara">
      ⏸ Pause
    </button>
    <span class="__ckg_divider"></span>
    <button class="__ckg_btn __ckg_btn_stop" id="__ckg_btn_stop" title="Hentikan rekaman & simpan">
      ⏹ Stop
    </button>
  `;
  document.body.appendChild(_toolbar);

  const _dot      = document.getElementById('__ckg_dot');
  const _label    = document.getElementById('__ckg_label');
  const _count    = document.getElementById('__ckg_count');
  const _btnUndo  = document.getElementById('__ckg_btn_undo');
  const _btnPause = document.getElementById('__ckg_btn_pause');
  const _btnStop  = document.getElementById('__ckg_btn_stop');

  function _updateUI() {
    _count.textContent       = `${_eventCount} aksi`;
    _btnUndo.disabled        = _eventCount === 0;
    _dot.className           = '__ckg_dot' + (_paused ? ' paused' : '');
    _label.textContent       = _paused ? 'Dijeda' : 'Merekam…';
    _btnPause.textContent    = _paused ? '▶ Lanjut' : '⏸ Pause';
    _btnPause.className      = '__ckg_btn __ckg_btn_pause' + (_paused ? ' is-paused' : '');
  }

  // ── Draggable ────────────────────────────────────────────────────────────

  let _dragging = false;
  let _dragOffX = 0, _dragOffY = 0;

  // Mulai pakai absolute positioning hanya setelah drag pertama
  function _startDrag(e) {
    if (e.button !== 0) return;
    // Jangan drag saat klik tombol
    if (e.target.closest('.__ckg_btn')) return;

    _dragging = true;
    const rect = _toolbar.getBoundingClientRect();
    _dragOffX  = e.clientX - rect.left;
    _dragOffY  = e.clientY - rect.top;

    // Switch dari fixed+translate ke fixed+top/left
    _toolbar.style.transform  = 'none';
    _toolbar.style.left       = rect.left + 'px';
    _toolbar.style.bottom     = 'auto';
    _toolbar.style.top        = rect.top + 'px';
    _toolbar.style.cursor     = 'grabbing';

    e.preventDefault();
  }

  function _onDrag(e) {
    if (!_dragging) return;
    _toolbar.style.left = (e.clientX - _dragOffX) + 'px';
    _toolbar.style.top  = (e.clientY - _dragOffY) + 'px';
  }

  function _stopDrag() {
    if (!_dragging) return;
    _dragging = false;
    _toolbar.style.cursor = 'grab';
  }

  _toolbar.addEventListener('mousedown', _startDrag);
  document.addEventListener('mousemove', _onDrag,  { passive: true });
  document.addEventListener('mouseup',   _stopDrag, { passive: true });

  // ── Toolbar Button Actions ────────────────────────────────────────────────

  _btnStop.addEventListener('click', (e) => {
    e.stopPropagation();
    _active = false;
    _cleanup();
    try {
      chrome.runtime.sendMessage({ action: 'ckg_stop_record' }, (res) => {
        // Notifikasi sukses di halaman
        _showToast(`✅ Rekaman selesai — ${_eventCount} aksi tersimpan`);
      });
    } catch (_) {}
  });

  _btnUndo.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_eventCount === 0) return;
    try {
      chrome.runtime.sendMessage({ action: 'ckg_undo_record' }, (res) => {
        if (res?.ok) {
          _eventCount = res.count;
          _updateUI();
          _showToast('↩ Aksi terakhir dihapus');
        }
      });
    } catch (_) {}
  });

  _btnPause.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      chrome.runtime.sendMessage({ action: 'ckg_pause_record' }, (res) => {
        if (res?.ok) {
          _paused = res.paused;
          _updateUI();
        }
      });
    } catch (_) {}
  });

  // ── Toast Notification ───────────────────────────────────────────────────

  function _showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:rgba(15,15,20,0.95)', 'color:#f1f5f9',
      'font:600 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'padding:10px 20px', 'border-radius:24px',
      'border:1px solid rgba(255,255,255,0.12)',
      'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
      'backdrop-filter:blur(12px)',
      'pointer-events:none',
      'transition:opacity 0.3s',
    ].join(';');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
  }

  // ── Selector generator ────────────────────────────────────────────────────

  function _bestSelector(el) {
    if (el.id && !el.id.includes(' '))        return `#${el.id}`;
    if (el.name && !el.name.includes(' '))    return `[name="${el.name}"]`;
    if (el.placeholder)                       return `[placeholder="${el.placeholder}"]`;

    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 3) {
      let seg = node.tagName.toLowerCase();
      if (node.className) {
        const cls = [...node.classList]
          .filter(c => !c.match(/^(ng-|v-|js-|is-|has-)/))
          .slice(0, 2);
        if (cls.length) seg += '.' + cls.join('.');
      }
      parts.unshift(seg);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function _eventPayload(el, type, extra = {}) {
    return {
      type,
      tag:         el.tagName?.toLowerCase() || '',
      selector:    _bestSelector(el),
      id:          el.id || null,
      name:        el.name || null,
      placeholder: el.placeholder || null,
      text:        (el.innerText || el.textContent || '').trim().slice(0, 80),
      value:       el.value ?? null,
      ...extra,
    };
  }

  // ── Event: click ──────────────────────────────────────────────────────────

  function _onMousedown(e) {
    if (!_active || _paused) return;
    const el = e.target;
    if (!el || el.closest('#__ckg_toolbar')) return;

    const tag = el.tagName?.toLowerCase();
    if (['input', 'textarea'].includes(tag) && !['checkbox', 'radio'].includes(el.type)) return;

    const payload = _eventPayload(el, 'click', {
      text: (el.innerText || el.textContent || el.value || '').trim().slice(0, 80),
    });
    _sendEvent(payload);
  }

  // ── Event: input / change (debounced) ────────────────────────────────────

  function _onInput(e) {
    if (!_active || _paused) return;
    const el  = e.target;
    if (el.closest('#__ckg_toolbar')) return;
    const sel = _bestSelector(el);

    if (_debounce.has(sel)) clearTimeout(_debounce.get(sel));
    _debounce.set(sel, setTimeout(() => {
      _debounce.delete(sel);
      const payload = _eventPayload(el, e.type === 'change' ? 'change' : 'input', {
        value: el.value ?? null,
      });
      _sendEvent(payload);
    }, 400));
  }

  // ── Send to background ────────────────────────────────────────────────────

  function _sendEvent(event) {
    _eventCount++;
    _updateUI();
    try {
      chrome.runtime.sendMessage({ action: 'ckg_record_event', event });
    } catch (_) {}
  }

  // ── Register listeners ────────────────────────────────────────────────────

  document.addEventListener('mousedown', _onMousedown, { capture: true, passive: true });
  document.addEventListener('input',     _onInput,     { capture: true, passive: true });
  document.addEventListener('change',    _onInput,     { capture: true, passive: true });

  // ── Cleanup ──────────────────────────────────────────────────────────────

  function _cleanup() {
    document.removeEventListener('mousedown', _onMousedown, { capture: true });
    document.removeEventListener('input',     _onInput,     { capture: true });
    document.removeEventListener('change',    _onInput,     { capture: true });
    document.removeEventListener('mousemove', _onDrag);
    document.removeEventListener('mouseup',   _stopDrag);

    _toolbar.style.opacity    = '0';
    _toolbar.style.transition = 'opacity 0.25s';
    setTimeout(() => {
      _toolbar.remove();
      _style.remove();
    }, 280);

    window.__ckgRecorderLoaded = false;
  }

  // ── Stop handler dari background (misal stop dari UI ekstensi) ───────────

  chrome.runtime.onMessage.addListener(function _stopHandler(msg) {
    if (msg.action !== 'ckg_stop_recorder') return;
    _active = false;
    _cleanup();
    chrome.runtime.onMessage.removeListener(_stopHandler);
  });

  _updateUI();
  console.log('[CKG] Recorder v2 injected ✓');
})();
