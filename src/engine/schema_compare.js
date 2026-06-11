// schema_compare.js - CKG Auto KlikPro v2.0
// Schema Comparator — Detects changes between schema versions
// Compares: added/removed questions, PPV changes, label changes, type changes

'use strict';

const SchemaCompare = {

  /**
   * Compare two schema objects and return a structured diff.
   *
   * @param {Object} oldSchema — previously stored schema
   * @param {Object} newSchema — freshly discovered schema
   * @returns {Object} diff result
   */
  compare(oldSchema, newSchema) {
    const oldQs = oldSchema?.questions || [];
    const newQs = newSchema?.questions || [];

    const added    = [];
    const removed  = [];
    const changed  = [];
    const unchanged = [];

    // Index new questions by normalized question text for O(1) lookup
    const newMap = new Map(
      newQs.map(q => [this._normalizeText(q.question), q])
    );
    const oldMap = new Map(
      oldQs.map(q => [this._normalizeText(q.question), q])
    );

    // Find removed and changed
    for (const oldQ of oldQs) {
      const key    = this._normalizeText(oldQ.question);
      const matchQ = newMap.get(key);

      if (!matchQ) {
        removed.push({ question: oldQ.question, type: oldQ.type });
        continue;
      }

      const diff = this._diffQuestion(oldQ, matchQ);
      if (diff.hasChanges) {
        changed.push({ question: oldQ.question, changes: diff.changes });
      } else {
        unchanged.push(oldQ.question);
      }
    }

    // Find added
    for (const newQ of newQs) {
      const key = this._normalizeText(newQ.question);
      if (!oldMap.has(key)) {
        added.push({ question: newQ.question, type: newQ.type, options: newQ.options });
      }
    }

    const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;
    const severity   = this._calcSeverity(added, removed, changed);

    return {
      hasChanges,
      severity,        // 'none' | 'minor' | 'major' | 'critical'
      summary: {
        added:     added.length,
        removed:   removed.length,
        changed:   changed.length,
        unchanged: unchanged.length,
        total:     newQs.length,
      },
      added,
      removed,
      changed,
      unchanged,
      oldFingerprint: oldSchema?.fingerprint || '',
      newFingerprint: newSchema?.fingerprint || '',
      comparedAt: new Date().toISOString(),
    };
  },

  /**
   * Compare two individual question entries.
   * Checks: type change, PPV value changes, label changes, option count.
   */
  _diffQuestion(oldQ, newQ) {
    const changes = [];

    // Type change
    if (oldQ.type !== newQ.type) {
      changes.push({ field: 'type', old: oldQ.type, new: newQ.type });
    }

    // Options diff (for radio/checkbox)
    if (oldQ.options || newQ.options) {
      const oldOpts = oldQ.options || [];
      const newOpts = newQ.options || [];

      // Build maps by label for comparison
      const oldOptMap = new Map(oldOpts.map(o => [this._normalizeText(o.label || ''), o]));
      const newOptMap = new Map(newOpts.map(o => [this._normalizeText(o.label || ''), o]));

      // Detect PPV changes (same label, different value)
      for (const [label, oldOpt] of oldOptMap) {
        const newOpt = newOptMap.get(label);
        if (newOpt && oldOpt.value !== newOpt.value) {
          changes.push({
            field:    'ppv_changed',
            label:    oldOpt.label,
            oldValue: oldOpt.value,
            newValue: newOpt.value,
          });
        }
        if (!newOpt) {
          changes.push({ field: 'option_removed', label: oldOpt.label, value: oldOpt.value });
        }
      }

      // Detect new options
      for (const [label, newOpt] of newOptMap) {
        if (!oldOptMap.has(label)) {
          changes.push({ field: 'option_added', label: newOpt.label, value: newOpt.value });
        }
      }

      // Count change
      if (oldOpts.length !== newOpts.length) {
        changes.push({ field: 'option_count', old: oldOpts.length, new: newOpts.length });
      }
    }

    // ID change (number/text fields)
    if (oldQ.id && newQ.id && oldQ.id !== newQ.id) {
      changes.push({ field: 'element_id', old: oldQ.id, new: newQ.id });
    }

    return { hasChanges: changes.length > 0, changes };
  },

  /**
   * Calculate overall severity of changes.
   * critical = questions removed (may break workflow)
   * major    = PPV values changed (self-healing required)
   * minor    = labels or options added
   * none     = no changes
   */
  _calcSeverity(added, removed, changed) {
    if (removed.length > 0)  return 'critical';

    const ppvChanges = changed.some(c =>
      c.changes?.some(ch => ch.field === 'ppv_changed' || ch.field === 'type')
    );
    if (ppvChanges) return 'major';

    if (added.length > 0 || changed.length > 0) return 'minor';

    return 'none';
  },

  _normalizeText(text = '') {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  },

  // ── Storage ──────────────────────────────────────────────────────────────

  /**
   * Save a comparison result to the compare history log.
   * @param {string} screenName
   * @param {Object} diff
   */
  async saveCompareResult(screenName, diff) {
    const key = 'ckg_compare_log';
    const res = await chrome.storage.local.get(key);
    const log = res[key] || [];
    log.push({ screen: screenName, ...diff });
    // Keep last 100 comparisons
    if (log.length > 100) log.splice(0, log.length - 100);
    await chrome.storage.local.set({ [key]: log });
  },

  /**
   * Load compare history for a given screen.
   * @param {string} [screenName] — filter by screen, or omit for all
   * @returns {Object[]}
   */
  async loadCompareHistory(screenName = null) {
    const res = await chrome.storage.local.get('ckg_compare_log');
    const log = res.ckg_compare_log || [];
    return screenName ? log.filter(e => e.screen === screenName) : log;
  },

  /**
   * Format a diff result for display in Developer Mode UI.
   * @param {Object} diff
   * @returns {string} human-readable text
   */
  formatDiff(diff) {
    if (!diff.hasChanges) return '✅ Schema tidak berubah — tidak ada perbedaan.';

    const lines = [
      `⚠️  Severity: ${diff.severity.toUpperCase()}`,
      `📊  ${diff.summary.added} ditambah | ${diff.summary.removed} dihapus | ${diff.summary.changed} berubah | ${diff.summary.unchanged} sama`,
    ];

    if (diff.added.length) {
      lines.push('\n➕ PERTANYAAN BARU:');
      diff.added.forEach(q => lines.push(`   • ${q.question} [${q.type}]`));
    }

    if (diff.removed.length) {
      lines.push('\n❌ PERTANYAAN DIHAPUS:');
      diff.removed.forEach(q => lines.push(`   • ${q.question}`));
    }

    if (diff.changed.length) {
      lines.push('\n🔄 PERTANYAAN BERUBAH:');
      diff.changed.forEach(item => {
        lines.push(`   • ${item.question}`);
        item.changes.forEach(c => {
          if (c.field === 'ppv_changed') {
            lines.push(`     ↳ PPV berubah [${c.label}]: ${c.oldValue} → ${c.newValue}`);
          } else if (c.field === 'type') {
            lines.push(`     ↳ Tipe berubah: ${c.old} → ${c.new}`);
          } else {
            lines.push(`     ↳ ${c.field}: ${JSON.stringify(c)}`);
          }
        });
      });
    }

    return lines.join('\n');
  },
};

// ── ESM Export ────────────────────────────────────────────────────────────
export { SchemaCompare };

if (typeof window !== 'undefined') {
  window.SchemaCompare = SchemaCompare;
}
