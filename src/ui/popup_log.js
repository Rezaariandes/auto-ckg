// src/ui/popup_log.js - CKG Auto KlikPro v1.0
// Tab Log: real-time scrollable activity log, export CSV, clear

const MAX_LOG_DISPLAY = 300; // max entries in DOM
let logEntries = []; // { time, level, message }
let autoScroll = true;

// ── Init ──────────────────────────────────────────────────────────────────

export function initLogTab() {
  loadPersistedLog();
  setupLogButtons();
  listenBackgroundLog();
  setupScrollDetect();
}

// ── Load from storage ─────────────────────────────────────────────────────

async function loadPersistedLog() {
  try {
    const res = await chrome.storage.local.get('ckg_run_log');
    const stored = res['ckg_run_log'] || [];
    if (stored.length) {
      stored.forEach(e => appendEntry(e.level || 'info', e.message || '', e.time, false));
      updateCount();
      scrollToBottom();
    }
  } catch (_) {}
}

// ── Append entry ──────────────────────────────────────────────────────────

export function appendLogEntry(level, message) {
  appendEntry(level, message, Date.now(), true);
}

function appendEntry(level, message, time, animate) {
  const container       = document.getElementById('logContainer');
  const containerInline = document.getElementById('logContainerInline');

  // Remove empty placeholder from both containers
  [container, containerInline].forEach(c => {
    if (c) c.querySelector('.log-empty')?.remove();
  });

  // Classify level from message if not set
  if (level === 'info' && message.startsWith('═══')) level = 'divider';
  if (level === 'info' && message.startsWith('  ✓')) level = 'success';

  const entry = { time: time || Date.now(), level, message };
  logEntries.push(entry);

  // Trim DOM if too many
  if (logEntries.length > MAX_LOG_DISPLAY) {
    logEntries.shift();
    container?.querySelector('.log-entry')?.remove();
    containerInline?.querySelector('.log-entry')?.remove();
  }

  // Build row html
  const rowHtml = `
    <span class="log-time">${formatTime(entry.time)}</span>
    <span class="log-msg">${escapeHtml(message)}</span>
  `;

  // Append to main log container (tab Log)
  if (container) {
    const row = document.createElement('div');
    row.className = `log-entry ${level}${animate ? '' : ' no-anim'}`;
    row.innerHTML = rowHtml;
    container.appendChild(row);
  }

  // Append to inline log (kolom kanan Utama)
  if (containerInline) {
    const rowInline = document.createElement('div');
    rowInline.className = `log-entry ${level}${animate ? '' : ' no-anim'}`;
    rowInline.innerHTML = rowHtml;
    containerInline.appendChild(rowInline);
    if (autoScroll) containerInline.scrollTop = containerInline.scrollHeight;
  }

  updateCount();
  if (autoScroll) scrollToBottom();
}

// ── Controls ──────────────────────────────────────────────────────────────

function setupLogButtons() {
  document.getElementById('btnClearLog')?.addEventListener('click', clearLog);
  document.getElementById('btnExportLog')?.addEventListener('click', exportCSV);
}

function clearLog() {
  logEntries = [];
  const emptyHtml = `
    <div class="log-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      <p>Log kosong. Mulai run untuk melihat aktivitas.</p>
    </div>
  `;
  const container = document.getElementById('logContainer');
  if (container) container.innerHTML = emptyHtml;
  const containerInline = document.getElementById('logContainerInline');
  if (containerInline) containerInline.innerHTML = `<div class="log-empty"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg><p>Log kosong</p></div>`;
  updateCount();
  chrome.storage.local.remove('ckg_run_log');
}

function exportCSV() {
  if (!logEntries.length) return;

  const rows = [['Waktu', 'Level', 'Pesan']];
  logEntries.forEach(e => {
    rows.push([
      new Date(e.time).toISOString(),
      e.level,
      e.message.replace(/"/g, '""')
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `ckg_log_${formatDateFile()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Auto-scroll detect ────────────────────────────────────────────────────

function setupScrollDetect() {
  const container = document.getElementById('logContainer');
  if (!container) return;
  container.addEventListener('scroll', () => {
    const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    autoScroll = fromBottom < 40;
  });
}

// ── Background listener ───────────────────────────────────────────────────

function listenBackgroundLog() {
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'ckg_log') {
      appendLogEntry(msg.level || 'info', msg.message || '');
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────

function scrollToBottom() {
  const container = document.getElementById('logContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

function updateCount() {
  const el = document.getElementById('logCount');
  if (el) el.textContent = `${logEntries.length} entri`;
  const elInline = document.getElementById('logCountInline');
  if (elInline) elInline.textContent = `${logEntries.length} entri`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

function formatDateFile() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
