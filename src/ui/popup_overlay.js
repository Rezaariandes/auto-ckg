/**
 * popup_overlay.js — CKG Auto KlikPro
 * Floating Shadow DOM overlay — inject ke halaman web target.
 * Toggle via chrome.action click (dikirim dari background).
 * Fitur: draggable, minimize jadi pill, persistent position.
 */

(function () {
  'use strict';

  const HOST_ID   = '__ckg_overlay_host__';
  const STORE_POS = 'ckg_overlay_pos';
  const STORE_MIN = 'ckg_overlay_minimized';

  // ── Guard: cek context masih valid ─────────────────────────────────────────
  function isContextValid() {
    try { return !!chrome.runtime?.id; } catch(_) { return false; }
  }

  function safeMsg(msg, cb) {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage(msg, cb).catch(() => {});
    } catch(_) {}
  }

  function safeStorageGet(keys, cb) {
    if (!isContextValid()) return;
    try { chrome.storage.local.get(keys, cb); } catch(_) {}
  }

  function safeStorageSet(obj) {
    if (!isContextValid()) return;
    try { chrome.storage.local.set(obj); } catch(_) {}
  }

  // ── Toggle: jika sudah ada, show/hide ─────────────────────────────────────
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    const shadow = existing.shadowRoot;
    const panel  = shadow?.getElementById('ckg-panel');
    const pill   = shadow?.getElementById('ckg-pill');
    if (panel && pill) {
      const bothHidden = panel.style.display === 'none' && pill.style.display === 'none';
      if (bothHidden) {
        // Selalu maximize saat klik icon extension
        pill.style.display  = 'none';
        panel.style.display = 'flex';
        safeStorageSet({ [STORE_MIN]: false });
      } else {
        panel.style.display = 'none';
        pill.style.display  = 'none';
      }
    }
    return;
  }

  // ── Host element ───────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = HOST_ID;
  Object.assign(host.style, {
    position:      'fixed',
    zIndex:        '2147483647',
    top:           '0',
    left:          '0',
    width:         '0',
    height:        '0',
    overflow:      'visible',
    pointerEvents: 'none',
  });
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // ── CSS ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host { all: initial; }

    #ckg-panel, #ckg-pill {
      --accent: #2d4ed8;
      --shadow: 0 8px 32px rgba(45,78,216,0.22), 0 2px 8px rgba(0,0,0,0.12);
    }

    /* ── PANEL ── */
    #ckg-panel {
      position: fixed;
      width: 400px;
      max-height: 90vh;
      background: linear-gradient(135deg, #e8edff 0%, #dce8ff 40%, #e4f0ff 100%);
      border-radius: 16px;
      box-shadow: var(--shadow);
      border: 1.5px solid rgba(255,255,255,0.90);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      color: #0f172a;
      line-height: 1.5;
      user-select: none;
    }
    #ckg-panel:hover {
      box-shadow: 0 12px 48px rgba(45,78,216,0.28), 0 4px 16px rgba(0,0,0,0.14);
    }

    /* ── QUICK ACTION PANEL ── */
    #ckg-quickbar {
      background: rgba(255,255,255,0.92);
      border-top: 1px solid rgba(45,78,216,0.12);
      padding: 8px 12px 10px;
      flex-shrink: 0;
      backdrop-filter: blur(8px);
    }
    #ckg-quickbar-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 7px;
    }
    #ckg-patient-counter {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
    }
    #ckg-patient-counter strong { color: #2d4ed8; }
    .ckg-qbar-btns {
      display: flex;
      gap: 5px;
    }
    .ckg-qbtn {
      padding: 5px 12px;
      border: none;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: filter .12s, transform .1s;
    }
    .ckg-qbtn:active { transform: scale(0.96); }
    .ckg-qbtn-run {
      background: linear-gradient(135deg, #2d4ed8, #4f72f5);
      color: #fff;
      box-shadow: 0 2px 8px rgba(45,78,216,0.25);
    }
    .ckg-qbtn-run:hover { filter: brightness(1.08); }
    .ckg-qbtn-pause {
      background: rgba(245,158,11,0.12);
      color: #d97706;
      border: 1.5px solid rgba(245,158,11,0.28);
    }
    .ckg-qbtn-pause:hover { background: rgba(245,158,11,0.20); filter: none; }
    .ckg-qbtn-stop {
      background: rgba(239,68,68,0.09);
      color: #dc2626;
      border: 1.5px solid rgba(239,68,68,0.22);
    }
    .ckg-qbtn-stop:hover  { background: rgba(239,68,68,0.15); filter: none; }
    #ckg-quickbar-wf {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .ckg-wf-btn {
      padding: 3px 9px;
      border: 1.5px solid rgba(45,78,216,0.18);
      border-radius: 20px;
      background: rgba(45,78,216,0.06);
      color: #2d4ed8;
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background .12s, border-color .12s;
    }
    .ckg-wf-btn:hover { background: rgba(45,78,216,0.14); border-color: #2d4ed8; }
    .ckg-wf-btn.active {
      background: #2d4ed8;
      color: #fff;
      border-color: #2d4ed8;
    }

    /* ── TITLEBAR ── */
    #ckg-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px 8px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2d4ed8 60%, #4f72f5 100%);
      cursor: grab;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      border-radius: 14px 14px 0 0;
    }
    #ckg-titlebar:active { cursor: grabbing; }
    #ckg-titlebar::before {
      content: '';
      position: absolute;
      top: -18px; right: -18px;
      width: 80px; height: 80px;
      background: rgba(255,255,255,0.07);
      border-radius: 50%;
      pointer-events: none;
    }

    .ckg-tbar-left  { display: flex; align-items: center; gap: 9px; position: relative; }
    .ckg-icon-wrap  {
      width: 30px; height: 30px;
      background: rgba(255,255,255,0.18);
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 16px;
    }
    .ckg-title      { font-size: 13.5px; font-weight: 800; color: #fff; letter-spacing: -0.3px; line-height: 1.1; }
    .ckg-title span { color: #93c5fd; }
    .ckg-sub        { font-size: 9px; color: rgba(255,255,255,0.6); font-weight: 500; }
    .ckg-tbar-right { display: flex; align-items: center; gap: 5px; position: relative; }

    .ckg-status-badge {
      display: flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 20px;
      padding: 3px 9px;
      font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.92);
    }
    .ckg-sdot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,0.45);
      transition: background .3s;
    }

    .ckg-win-btn {
      width: 24px; height: 24px;
      border-radius: 6px; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background .12s, transform .1s;
      background: rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.85);
      flex-shrink: 0; pointer-events: all;
    }
    .ckg-win-btn:hover  { background: rgba(255,255,255,0.28); transform: scale(1.05); }
    .ckg-win-btn:active { transform: scale(0.94); }
    .ckg-win-btn.close:hover { background: rgba(239,68,68,0.55); }

    /* ── IFRAME ── */
    #ckg-iframe {
      width: 100%;
      flex: 1;
      border: none;
      background: transparent;
      min-height: 440px;
      max-height: calc(90vh - 130px);
      display: block;
      border-radius: 0;
      pointer-events: all;
    }

    /* ── PILL (minimized = panel tanpa iframe, lebar sama dg panel) ── */
    #ckg-pill {
      position: fixed;
      display: none;
      flex-direction: column;
      width: 400px;
      background: linear-gradient(135deg, #e8edff 0%, #dce8ff 40%, #e4f0ff 100%);
      border-radius: 16px;
      box-shadow: var(--shadow);
      border: 1.5px solid rgba(255,255,255,0.90);
      overflow: hidden;
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }

    /* Titlebar di dalam pill — identik dg #ckg-titlebar */
    #ckg-pill-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px 8px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2d4ed8 60%, #4f72f5 100%);
      cursor: pointer;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      border-radius: 14px 14px 14px 14px;
    }
    #ckg-pill-bar::before {
      content: '';
      position: absolute;
      top: -18px; right: -18px;
      width: 80px; height: 80px;
      background: rgba(255,255,255,0.07);
      border-radius: 50%;
      pointer-events: none;
    }
    .pill-tbar-left  { display: flex; align-items: center; gap: 9px; position: relative; }
    .pill-icon-wrap  {
      width: 30px; height: 30px;
      background: rgba(255,255,255,0.18);
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 16px;
    }
    .pill-title      { font-size: 13.5px; font-weight: 800; color: #fff; letter-spacing: -0.3px; line-height: 1.1; }
    .pill-title span { color: #93c5fd; }
    .pill-sub        { font-size: 9px; color: rgba(255,255,255,0.6); font-weight: 500; }
    .pill-tbar-right { display: flex; align-items: center; gap: 5px; }

    .pill-status-badge {
      display: flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 20px;
      padding: 3px 9px;
      font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.92);
    }
    .pill-sdot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,0.45);
      transition: background .3s;
    }
    .pill-sdot.running {
      background: #4ade80;
      box-shadow: 0 0 6px #4ade80;
      animation: ckg-blink 1.2s infinite;
    }

    @keyframes ckg-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  `;
  shadow.appendChild(style);

  // ── PANEL ─────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'ckg-panel';
  panel.innerHTML = `
    <div id="ckg-titlebar">
      <div class="ckg-tbar-left">
        <div class="ckg-icon-wrap">🏥</div>
        <div>
          <div class="ckg-title">CKG Auto <span>KlikPro</span></div>
          <div class="ckg-sub">Sehat Indonesiaku · Otomasi Input</div>
        </div>
      </div>
      <div class="ckg-tbar-right">
        <div class="ckg-status-badge">
          <span class="ckg-sdot" id="ckg-sdot"></span>
          <span id="ckg-stxt">Siap</span>
        </div>
        <button class="ckg-win-btn minimize" id="ckg-btn-min" title="Minimize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="ckg-win-btn close" id="ckg-btn-close" title="Tutup">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <iframe id="ckg-iframe" src="" allow="clipboard-write"></iframe>
    <!-- Quick Action Bar -->
    <div id="ckg-quickbar">
      <div id="ckg-quickbar-top">
        <div id="ckg-patient-counter">Siap menjalankan otomasi</div>
        <div class="ckg-qbar-btns">
          <button class="ckg-qbtn ckg-qbtn-run" id="ckg-qbtn-run">🚀 Jalankan</button>
          <button class="ckg-qbtn ckg-qbtn-pause" id="ckg-qbtn-pause" style="display:none">⏸ Pause</button>
          <button class="ckg-qbtn ckg-qbtn-stop" id="ckg-qbtn-stop" style="display:none">⏹ Stop</button>
        </div>
      </div>
      <div id="ckg-quickbar-wf">
        <span style="font-size:10px;color:#94a3b8;font-weight:600;align-self:center">Tahapan:</span>
        <button class="ckg-wf-btn" data-wf="pendaftaran">Pendaftaran</button>
        <button class="ckg-wf-btn" data-wf="konfirmasi">Konfirmasi</button>
        <button class="ckg-wf-btn" data-wf="kuesioner">Kuesioner</button>
        <button class="ckg-wf-btn" data-wf="pemeriksaan">Pemeriksaan</button>
      </div>
    </div>
  `;
  shadow.appendChild(panel);

  // ── PILL (minimized header) ─────────────────────────────────────────────────────
  const pill = document.createElement('div');
  pill.id = 'ckg-pill';
  pill.innerHTML = `
    <div id="ckg-pill-bar">
      <div class="pill-tbar-left">
        <div class="pill-icon-wrap">🏥</div>
        <div>
          <div class="pill-title">CKG Auto <span>KlikPro</span></div>
          <div class="pill-sub">Sehat Indonesiaku · Otomasi Input</div>
        </div>
      </div>
      <div class="pill-tbar-right">
        <div class="pill-status-badge">
          <span class="pill-sdot" id="pill-sdot"></span>
          <span id="pill-stxt">Siap</span>
        </div>
        <button class="ckg-win-btn" id="ckg-pill-expand" title="Perbesar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
        <button class="ckg-win-btn close" id="ckg-pill-close" title="Tutup">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  `;
  shadow.appendChild(pill);

  // ── Load iframe + sembunyikan header asli di popup.html ───────────────────
  const iframe = shadow.getElementById('ckg-iframe');
  iframe.src = chrome.runtime.getURL('popup.html') + '?overlay=1';

  // Overlay mode: popup.html baca ?overlay=1 dan hide .app-header sendiri.
  // Backup: inject CSS saat iframe load (defensive double-hide)
  iframe.addEventListener('load', () => {
    try {
      const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iDoc) return;
      const s = iDoc.createElement('style');
      s.id = 'ckg-overlay-hide';
      s.textContent = '.app-header { display: none !important; }';
      (iDoc.head || iDoc.documentElement).appendChild(s);
    } catch (_) {
      // cross-origin guard — seharusnya tidak terjadi karena same extension origin
    }
  });

  // ── Restore posisi & state minimized ──────────────────────────────────────
  safeStorageGet([STORE_POS, STORE_MIN], res => {
    const pos = res[STORE_POS] || { right: 24, top: 24 };
    setPos(panel, pos);
    setPillPos(pill, pos);

    if (res[STORE_MIN]) {
      panel.style.display = 'none';
      pill.style.display  = 'flex';
    }
    // else: panel sudah display:flex dari CSS default
  });

  function setPos(el, pos) {
    el.style.right = Math.max(pos.right, 0) + 'px';
    el.style.top   = Math.max(pos.top,   0) + 'px';
    el.style.left   = '';
    el.style.bottom = '';
  }

  function setPillPos(el, pos) {
    el.style.right = Math.max(pos.right, 0) + 'px';
    el.style.top   = Math.max(pos.top,   0) + 'px';
    el.style.left   = '';
    el.style.bottom = '';
  }

  function savePos() {
    const vw   = window.innerWidth;
    const rect = panel.getBoundingClientRect();
    const pos  = { right: vw - rect.right, top: rect.top };
    safeStorageSet({ [STORE_POS]: pos });
    setPillPos(pill, pos);
  }

  // ── Drag panel ────────────────────────────────────────────────────────────
  const titlebar = shadow.getElementById('ckg-titlebar');
  let dragging = false, dragOX = 0, dragOY = 0;

  titlebar.addEventListener('mousedown', e => {
    if (e.target.closest('.ckg-win-btn')) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    dragOX = e.clientX - rect.left;
    dragOY = e.clientY - rect.top;
    // switch ke left+top
    panel.style.right  = '';
    panel.style.bottom = '';
    panel.style.left   = rect.left + 'px';
    panel.style.top    = rect.top  + 'px';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup',   onDragEnd);
    e.preventDefault();
  });

  function onDrag(e) {
    if (!dragging) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = panel.offsetWidth,  h  = panel.offsetHeight;
    panel.style.left = Math.max(0, Math.min(e.clientX - dragOX, vw - w)) + 'px';
    panel.style.top  = Math.max(0, Math.min(e.clientY - dragOY, vh - h)) + 'px';
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup',   onDragEnd);
    savePos();
    // revert ke right+top anchoring
    setPos(panel, {
      right: window.innerWidth - panel.getBoundingClientRect().right,
      top:   panel.getBoundingClientRect().top,
    });
  }

  // ── Minimize ──────────────────────────────────────────────────────────────
  shadow.getElementById('ckg-btn-min').addEventListener('click', () => {
    // Pill muncul tepat di posisi titlebar panel (top-right sama)
    const rect = panel.getBoundingClientRect();
    const vw   = window.innerWidth, vh = window.innerHeight;
    pill.style.right  = Math.max(vw - rect.right, 0) + 'px';
    // anchor dari atas: bottom = vh - (rect.top + tinggi pill)
    // tapi pakai top agar lebih presisi
    pill.style.top    = Math.max(rect.top, 0) + 'px';
    pill.style.left   = '';
    pill.style.bottom = '';
    panel.style.display = 'none';
    pill.style.display  = 'flex';
    safeStorageSet({ [STORE_MIN]: true });
  });

  // ── Pill: drag via pill-bar ───────────────────────────────────────────────
  const pillBar = shadow.getElementById('ckg-pill-bar');
  let pillDragging = false, pillDragOX = 0, pillDragOY = 0;

  pillBar.addEventListener('mousedown', e => {
    if (e.target.closest('.ckg-win-btn')) return;
    pillDragging = true;
    pillDragOX   = e.clientX;
    pillDragOY   = e.clientY;
    const rect = pill.getBoundingClientRect();
    pill.style.right  = '';
    pill.style.bottom = '';
    pill.style.left   = rect.left + 'px';
    pill.style.top    = rect.top  + 'px';
    document.addEventListener('mousemove', onPillDrag);
    document.addEventListener('mouseup',   onPillDragEnd);
    e.preventDefault();
  });

  function onPillDrag(e) {
    if (!pillDragging) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = pill.offsetWidth,  h  = pill.offsetHeight;
    pill.style.left = Math.max(0, Math.min(parseFloat(pill.style.left) + e.clientX - pillDragOX, vw - w)) + 'px';
    pill.style.top  = Math.max(0, Math.min(parseFloat(pill.style.top)  + e.clientY - pillDragOY, vh - h)) + 'px';
    pillDragOX = e.clientX;
    pillDragOY = e.clientY;
  }

  function onPillDragEnd() {
    if (!pillDragging) return;
    pillDragging = false;
    document.removeEventListener('mousemove', onPillDrag);
    document.removeEventListener('mouseup',   onPillDragEnd);
    const vw = window.innerWidth;
    const rect = pill.getBoundingClientRect();
    pill.style.right  = Math.max(vw - rect.right, 0) + 'px';
    pill.style.top    = Math.max(rect.top, 0) + 'px';
    pill.style.left   = '';
    pill.style.bottom = '';
  }

  // ── Pill: expand button ───────────────────────────────────────────────────
  shadow.getElementById('ckg-pill-expand').addEventListener('click', () => {
    const rect = pill.getBoundingClientRect();
    const vw   = window.innerWidth, vh = window.innerHeight;
    panel.style.right  = Math.max(vw - rect.right, 0) + 'px';
    panel.style.top    = Math.max(rect.top, 0) + 'px';
    panel.style.left   = '';
    panel.style.bottom = '';
    pill.style.display  = 'none';
    panel.style.display = 'flex';
    safeStorageSet({ [STORE_MIN]: false });
  });

  // ── Pill: close button ────────────────────────────────────────────────────
  function closeOverlay() {
    pill.style.display  = 'none';
    panel.style.display = 'none';
    // Beritahu background agar tidak auto re-inject saat navigasi
    safeMsg({ action: 'ckg_overlay_closed' });
  }

  shadow.getElementById('ckg-pill-close').addEventListener('click', closeOverlay);
  shadow.getElementById('ckg-btn-close').addEventListener('click', closeOverlay);

  // ── Quick Action Bar ──────────────────────────────────────────────────────
  const qbtnRun   = shadow.getElementById('ckg-qbtn-run');
  const qbtnPause = shadow.getElementById('ckg-qbtn-pause');
  const qbtnStop  = shadow.getElementById('ckg-qbtn-stop');
  const counter   = shadow.getElementById('ckg-patient-counter');

  qbtnRun.addEventListener('click', () => {
    safeMsg({ action: 'ckg_start', workflow: 'all', data: [], resume: false });
  });
  qbtnPause.addEventListener('click', () => {
    safeMsg({ action: 'ckg_pause' });
  });
  qbtnStop.addEventListener('click', () => {
    safeMsg({ action: 'ckg_stop' });
    qbtnRun.style.display   = '';
    qbtnPause.style.display = 'none';
    qbtnStop.style.display  = 'none';
    if (counter) counter.innerHTML = 'Siap menjalankan otomasi';
  });

  // WF shortcut buttons
  shadow.querySelectorAll('.ckg-wf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      safeMsg({ action: 'ckg_start', workflow: btn.dataset.wf, data: [], resume: false });
    });
  });

  // Highlight WF button berdasarkan URL saat ini
  function highlightActiveWF() {
    const url = window.location.href;
    shadow.querySelectorAll('.ckg-wf-btn').forEach(btn => {
      btn.classList.toggle('active', url.includes(btn.dataset.wf));
    });
  }
  highlightActiveWF();

  // ── Status dot sync + quick bar sync ─────────────────────────────────────
  if (!isContextValid()) return;
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'ckg_progress') {
      syncDot();
      if (counter && msg.current !== undefined && msg.total !== undefined) {
        counter.innerHTML = `Memproses <strong>${msg.current}</strong> dari <strong>${msg.total}</strong> pasien`;
        if (msg.pasien) counter.innerHTML += ` · ${msg.pasien}`;
      }
    } else if (msg.action === 'ckg_done') {
      syncDot();
      const s = msg.summary || {};
      if (counter) counter.innerHTML = `✅ Selesai: <strong>${s.ok || 0}</strong> berhasil, <strong>${s.fail || 0}</strong> gagal`;
      qbtnRun.style.display   = '';
      qbtnPause.style.display = 'none';
      qbtnStop.style.display  = 'none';
    } else if (msg.action === 'ckg_log') {
      syncDot();
    }
  });

  function syncDot() {
    safeMsg({ action: 'ckg_get_state' }, res => {
      if (chrome.runtime.lastError || !res) return;
      const sdot     = shadow.getElementById('ckg-sdot');
      const stxt     = shadow.getElementById('ckg-stxt');
      const pillDot  = shadow.getElementById('pill-sdot');
      const pillStxt = shadow.getElementById('pill-stxt');
      if (!sdot) return;

      if (res.running && !res.paused) {
        sdot.style.background = '#4ade80';
        sdot.style.boxShadow  = '0 0 6px #4ade80';
        sdot.style.animation  = 'ckg-blink 1.2s infinite';
        pillDot.className     = 'pill-sdot running';
        stxt.textContent      = 'Berjalan…';
        if (pillStxt) pillStxt.textContent = 'Berjalan…';
        qbtnRun.style.display   = 'none';
        qbtnPause.style.display = '';
        qbtnStop.style.display  = '';
        qbtnPause.textContent   = '⏸ Pause';
      } else if (res.paused) {
        sdot.style.background = '#fbbf24';
        sdot.style.boxShadow  = '';
        sdot.style.animation  = '';
        pillDot.className     = 'pill-sdot';
        stxt.textContent      = 'Dijeda';
        if (pillStxt) pillStxt.textContent = 'Dijeda';
        qbtnPause.textContent = '▶ Lanjut';
      } else {
        sdot.style.background = 'rgba(255,255,255,0.45)';
        sdot.style.boxShadow  = '';
        sdot.style.animation  = '';
        pillDot.className     = 'pill-sdot';
        stxt.textContent      = 'Siap';
        if (pillStxt) pillStxt.textContent = 'Siap';
        qbtnRun.style.display   = '';
        qbtnPause.style.display = 'none';
        qbtnStop.style.display  = 'none';
      }
    });
  }

  // Initial sync
  syncDot();

  console.log('[CKG AutoKlikPro] Floating overlay v2.0 mounted ✓');
})();
