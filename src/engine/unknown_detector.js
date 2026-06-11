// unknown_detector.js - CKG Auto KlikPro v2.0
// Unknown Question Detector
// Cross-references live-discovered questions against the Schema Repository.
// Questions not found in any stored schema are flagged and logged.

'use strict';

const UnknownDetector = {

  /**
   * Detect questions that do not exist in any stored schema.
   *
   * @param {Array<Object>} liveQuestions — from schema_discovery.js
   * @param {Array<Object>} repository    — all stored schemas (array of schema objects)
   * @param {string} screenName           — current screen context
   * @returns {Array<Object>} unknown items
   */
  detect(liveQuestions, repository, screenName = '') {
    if (!liveQuestions?.length) return [];

    // Build a flat set of all known question texts (normalized)
    const knownSet = new Set();
    for (const schema of (repository || [])) {
      for (const q of (schema.questions || [])) {
        knownSet.add(this._normalize(q.question));
      }
    }

    const unknown = [];
    for (const q of liveQuestions) {
      const norm = this._normalize(q.question);
      if (!knownSet.has(norm)) {
        unknown.push({
          screen:    screenName,
          question:  q.question,
          type:      q.type,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return unknown;
  },

  /**
   * Detect unknowns by loading repository from chrome.storage automatically.
   * Convenience method for in-page use.
   *
   * @param {Array<Object>} liveQuestions
   * @param {string} screenName
   * @returns {Promise<Array<Object>>}
   */
  async detectFromStorage(liveQuestions, screenName = '') {
    const idxRes   = await chrome.storage.local.get('ckg_schema_index');
    const index    = idxRes.ckg_schema_index || [];
    const repository = [];

    for (const name of index) {
      const res = await chrome.storage.local.get('ckg_schema_' + name);
      const s   = res['ckg_schema_' + name];
      if (s) repository.push(s);
    }

    return this.detect(liveQuestions, repository, screenName);
  },

  // ── Storage ──────────────────────────────────────────────────────────────

  /**
   * Persist unknown questions to storage (append-only log).
   * @param {Array<Object>} items
   */
  async save(items) {
    if (!items?.length) return;
    const key = 'ckg_unknown_questions';
    const res = await chrome.storage.local.get(key);
    const log = res[key] || [];

    for (const item of items) {
      // Deduplicate by normalized question text + screen
      const exists = log.some(
        e => e.screen === item.screen && this._normalize(e.question) === this._normalize(item.question)
      );
      if (!exists) log.push(item);
    }

    // Cap at 500 entries
    if (log.length > 500) log.splice(0, log.length - 500);
    await chrome.storage.local.set({ [key]: log });
  },

  /**
   * Load all logged unknown questions.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const res = await chrome.storage.local.get('ckg_unknown_questions');
    return res.ckg_unknown_questions || [];
  },

  /**
   * Load unknowns filtered by screen name.
   * @param {string} screenName
   * @returns {Promise<Array<Object>>}
   */
  async getByScreen(screenName) {
    const all = await this.getAll();
    return all.filter(e => e.screen === screenName);
  },

  /**
   * Clear all unknown question logs.
   */
  async clear() {
    await chrome.storage.local.remove('ckg_unknown_questions');
  },

  /**
   * Export unknowns as JSON string for download.
   * @returns {Promise<string>}
   */
  async exportJSON() {
    const items = await this.getAll();
    return JSON.stringify(items, null, 2);
  },

  // ── Utilities ─────────────────────────────────────────────────────────────

  _normalize(text = '') {
    return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  },

  /**
   * Format unknown items for display in Developer Mode.
   * @param {Array<Object>} items
   * @returns {string}
   */
  formatReport(items) {
    if (!items?.length) return '✅ Tidak ada pertanyaan tidak dikenal.';
    const lines = [`❓ ${items.length} pertanyaan tidak dikenal ditemukan:\n`];
    items.forEach((item, i) => {
      lines.push(`${i + 1}. [${item.screen}] ${item.question}`);
      lines.push(`   Tipe: ${item.type || '?'} | ${item.timestamp}`);
    });
    return lines.join('\n');
  },
};

// ── ESM Export ────────────────────────────────────────────────────────────
export { UnknownDetector };

if (typeof window !== 'undefined') {
  window.UnknownDetector = UnknownDetector;
}
