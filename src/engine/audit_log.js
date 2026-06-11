// audit_log.js - CKG Auto KlikPro v2.0
// Audit Logger — Append-only log for every auto-fill action
// Records: question, answer, PPV, screen, timestamp
// Capped at 1000 entries. Exportable as JSON/CSV.

'use strict';

const AuditLog = {

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Log a single fill action.
   *
   * @param {Object} entry
   * @param {string} entry.question  — question text
   * @param {string} entry.answer    — answer label (human text)
   * @param {string} [entry.ppv]     — PPV value if radio/checkbox (e.g. PPV00000364)
   * @param {string} [entry.screen]  — screen/form name
   * @param {string} [entry.type]    — field type: radio|number|text|select…
   * @param {string} [entry.pasien]  — NIK or name for traceability
   */
  async logFill(entry) {
    const key = 'ckg_audit_log';
    const res = await chrome.storage.local.get(key);
    const log = res[key] || [];

    log.push({
      question:  entry.question  || '',
      answer:    entry.answer    || '',
      ppv:       entry.ppv       || '',
      screen:    entry.screen    || '',
      type:      entry.type      || '',
      pasien:    entry.pasien    || '',
      timestamp: new Date().toISOString(),
    });

    // Cap at 1000 entries — drop oldest
    if (log.length > 1000) log.splice(0, log.length - 1000);
    await chrome.storage.local.set({ [key]: log });
  },

  /**
   * Batch log multiple fill actions at once (more efficient).
   * @param {Object[]} entries
   */
  async logBatch(entries) {
    if (!entries?.length) return;
    const key = 'ckg_audit_log';
    const res = await chrome.storage.local.get(key);
    const log = res[key] || [];
    const ts  = new Date().toISOString();

    for (const entry of entries) {
      log.push({
        question:  entry.question  || '',
        answer:    entry.answer    || '',
        ppv:       entry.ppv       || '',
        screen:    entry.screen    || '',
        type:      entry.type      || '',
        pasien:    entry.pasien    || '',
        timestamp: entry.timestamp || ts,
      });
    }

    if (log.length > 1000) log.splice(0, log.length - 1000);
    await chrome.storage.local.set({ [key]: log });
  },

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Load all audit log entries.
   * @returns {Promise<Object[]>}
   */
  async getLogs() {
    const res = await chrome.storage.local.get('ckg_audit_log');
    return res.ckg_audit_log || [];
  },

  /**
   * Load entries filtered by screen.
   * @param {string} screenName
   * @returns {Promise<Object[]>}
   */
  async getByScreen(screenName) {
    const logs = await this.getLogs();
    return logs.filter(e => e.screen === screenName);
  },

  /**
   * Load entries filtered by pasien NIK/name.
   * @param {string} pasien
   * @returns {Promise<Object[]>}
   */
  async getByPasien(pasien) {
    const logs = await this.getLogs();
    const norm = (pasien || '').toLowerCase();
    return logs.filter(e => (e.pasien || '').toLowerCase().includes(norm));
  },

  /**
   * Get summary stats for the log.
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const logs   = await this.getLogs();
    const screens = {};
    let fillCount = 0;

    for (const e of logs) {
      fillCount++;
      if (e.screen) screens[e.screen] = (screens[e.screen] || 0) + 1;
    }

    return {
      total:   fillCount,
      screens,
      oldest:  logs[0]?.timestamp || null,
      newest:  logs[logs.length - 1]?.timestamp || null,
    };
  },

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export all logs as JSON string.
   * @returns {Promise<string>}
   */
  async exportJSON() {
    const logs = await this.getLogs();
    return JSON.stringify(logs, null, 2);
  },

  /**
   * Export all logs as CSV string.
   * @returns {Promise<string>}
   */
  async exportCSV() {
    const logs = await this.getLogs();
    if (!logs.length) return 'timestamp,screen,pasien,type,question,answer,ppv\n';

    const header = 'timestamp,screen,pasien,type,question,answer,ppv';
    const rows = logs.map(e => [
      e.timestamp, e.screen, e.pasien, e.type,
      `"${(e.question || '').replace(/"/g, '""')}"`,
      `"${(e.answer   || '').replace(/"/g, '""')}"`,
      e.ppv,
    ].join(','));

    return [header, ...rows].join('\n');
  },

  // ── Maintenance ───────────────────────────────────────────────────────────

  /**
   * Clear all audit log entries.
   */
  async clear() {
    await chrome.storage.local.remove('ckg_audit_log');
  },

  /**
   * Trim log to the most recent N entries.
   * @param {number} keepLast
   */
  async trim(keepLast = 500) {
    const key  = 'ckg_audit_log';
    const res  = await chrome.storage.local.get(key);
    const logs = res[key] || [];
    if (logs.length > keepLast) {
      const trimmed = logs.slice(-keepLast);
      await chrome.storage.local.set({ [key]: trimmed });
    }
  },

  // ── Formatting ────────────────────────────────────────────────────────────

  /**
   * Format recent entries for display in Developer Mode UI.
   * @param {number} limit — how many recent entries to show
   * @returns {Promise<string>}
   */
  async formatRecent(limit = 20) {
    const logs   = await this.getLogs();
    const recent = logs.slice(-limit).reverse();
    if (!recent.length) return '📋 Audit log kosong.';

    const lines = [`📋 ${logs.length} total entri — ${recent.length} terbaru:\n`];
    recent.forEach((e, i) => {
      lines.push(`${i + 1}. [${e.timestamp?.slice(0, 19)}] ${e.screen || '?'}`);
      lines.push(`   Q: ${e.question}`);
      lines.push(`   A: ${e.answer}${e.ppv ? ` (PPV: ${e.ppv})` : ''}`);
      if (e.pasien) lines.push(`   Pasien: ${e.pasien}`);
    });

    return lines.join('\n');
  },
};

// ── ESM Export ────────────────────────────────────────────────────────────
export { AuditLog };

if (typeof window !== 'undefined') {
  window.AuditLog = AuditLog;
}
