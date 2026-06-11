// schema_discovery.js - CKG Auto KlikPro v2.0
// Schema Discovery Engine — Converts any SATUSEHAT screen into schema JSON
// Based on confirmed reverse-engineering findings:
//   .sd-question = question block container
//   .sv-string-viewer = question title text
//   input[type=radio] + .sd-item = radio option with PPV value
//   input[type=number] + aria-labelledby = numeric input

'use strict';

// ── Fingerprint helper (FNV-1a 32-bit, no external deps) ──────────────────

function _fnv32a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Main Discovery ─────────────────────────────────────────────────────────

const SchemaDiscovery = {

  /**
   * Scan the current page and build a full schema object.
   *
   * @param {string} screenName   — e.g. "perilaku_merokok"
   * @param {string} screenTitle  — Human-readable title; auto-detected if omitted
   * @returns {Object} schema
   */
  scanCurrentScreen(screenName = '', screenTitle = '') {
    const questions = this._extractQuestions();

    const detectedTitle = screenTitle
      || document.querySelector('h1, h2, [class*="title"], [class*="heading"]')?.innerText?.trim()
      || screenName
      || 'Unknown Screen';

    const fingerprint = this.generateFingerprint(questions);

    return {
      screen:      screenName || this._slugify(detectedTitle),
      title:       detectedTitle,
      version:     1,
      generatedAt: new Date().toISOString(),
      fingerprint,
      questions,
    };
  },

  /**
   * Extract all questions from the current DOM using SATUSEHAT SurveyJS selectors.
   * @returns {Array<Object>} questions
   */
  _extractQuestions() {
    const schema = [];
    const questionBlocks = document.querySelectorAll('.sd-question');

    questionBlocks.forEach(q => {
      // ── Question title ────────────────────────────────────────
      const question = q.querySelector('.sv-string-viewer')?.innerText?.trim();
      if (!question) return; // skip blocks without visible question text

      const item = { question };

      // ── Extract question name/ID (LPM|FRM|PPM structure) ─────
      const nameAttr = q.getAttribute('data-name') || q.id || '';
      if (nameAttr) item.name = nameAttr;

      // ── Radio inputs ──────────────────────────────────────────
      const radios = q.querySelectorAll('input[type="radio"]');
      if (radios.length) {
        item.type = 'radio';
        item.options = Array.from(radios).map(r => ({
          id:    r.id,
          value: r.value,   // PPV value — dynamically extracted, never hardcoded
          label: r.closest('.sd-item')?.querySelector('.sv-string-viewer')?.innerText?.trim()
              || r.closest('.sd-item')?.innerText?.trim()
              || r.getAttribute('aria-label')
              || r.id,
        }));
      }

      // ── Checkbox inputs ───────────────────────────────────────
      const checkboxes = q.querySelectorAll('input[type="checkbox"]');
      if (!radios.length && checkboxes.length) {
        item.type = 'checkbox';
        item.options = Array.from(checkboxes).map(cb => ({
          id:    cb.id,
          value: cb.value,
          label: cb.closest('.sd-item')?.querySelector('.sv-string-viewer')?.innerText?.trim()
              || cb.closest('.sd-item')?.innerText?.trim()
              || cb.getAttribute('aria-label')
              || cb.id,
        }));
      }

      // ── Number inputs ─────────────────────────────────────────
      const numbers = q.querySelectorAll('input[type="number"]');
      if (!radios.length && !checkboxes.length && numbers.length) {
        item.type = 'number';
        item.id   = numbers[0].id;
        item.placeholder = numbers[0].placeholder || '';
        // Resolve question text via aria-labelledby if .sv-string-viewer not in container
        if (!question) {
          const ariaId = numbers[0].getAttribute('aria-labelledby');
          if (ariaId) {
            item.question = document.getElementById(ariaId)?.innerText?.trim() || '';
          }
        }
      }

      // ── Text inputs ───────────────────────────────────────────
      const texts = q.querySelectorAll('input[type="text"], input:not([type])');
      if (!radios.length && !checkboxes.length && !numbers.length && texts.length) {
        item.type = 'text';
        item.id   = texts[0].id;
        item.placeholder = texts[0].placeholder || '';
      }

      // ── Textarea ──────────────────────────────────────────────
      const textareas = q.querySelectorAll('textarea');
      if (!radios.length && !checkboxes.length && !numbers.length && !texts.length && textareas.length) {
        item.type = 'textarea';
        item.id   = textareas[0].id;
        item.placeholder = textareas[0].placeholder || '';
      }

      // ── Select (native) ───────────────────────────────────────
      const selects = q.querySelectorAll('select');
      if (!item.type && selects.length) {
        item.type = 'select';
        item.id   = selects[0].id;
        item.options = Array.from(selects[0].options).map(o => ({
          value: o.value,
          label: o.text.trim(),
        }));
      }

      // ── Fallback type ─────────────────────────────────────────
      if (!item.type) item.type = 'unknown';

      schema.push(item);
    });

    return schema;
  },

  /**
   * Generate a deterministic fingerprint for a set of questions.
   * Based on: first 3 question texts + total count + input type sequence.
   * This detects form changes without relying on PPV values.
   *
   * @param {Array<Object>} questions
   * @returns {string} hex fingerprint
   */
  generateFingerprint(questions) {
    if (!questions || !questions.length) return '00000000';

    const parts = [
      questions.length,
      ...questions.slice(0, 3).map(q => q.question || ''),
      questions.map(q => q.type?.[0] || '?').join(''),
    ];

    return _fnv32a(parts.join('|'));
  },

  /**
   * Compare fingerprint of stored schema vs current DOM.
   * Returns true if the screen has changed since the schema was saved.
   *
   * @param {Object} storedSchema
   * @returns {{ changed: boolean, oldFp: string, newFp: string }}
   */
  detectChange(storedSchema) {
    const liveQuestions = this._extractQuestions();
    const newFp  = this.generateFingerprint(liveQuestions);
    const oldFp  = storedSchema.fingerprint || '';
    return {
      changed:       oldFp !== newFp,
      oldFingerprint: oldFp,
      newFingerprint: newFp,
      liveQuestions,
    };
  },

  // ── Utilities ────────────────────────────────────────────────────────────

  _slugify(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40)
      || 'unknown';
  },

  // ── Storage: Schema Repository ───────────────────────────────────────────

  /**
   * Save a schema to chrome.storage.local (indexed by screen name).
   * @param {Object} schema
   */
  async saveSchema(schema) {
    const key = 'ckg_schema_' + schema.screen;
    await chrome.storage.local.set({ [key]: schema });

    // Also maintain an index of known screens
    const idxRes = await chrome.storage.local.get('ckg_schema_index');
    const index  = idxRes.ckg_schema_index || [];
    if (!index.includes(schema.screen)) index.push(schema.screen);
    await chrome.storage.local.set({ ckg_schema_index: index });
  },

  /**
   * Load a schema by screen name.
   * @param {string} screenName
   * @returns {Object|null}
   */
  async loadSchema(screenName) {
    const key = 'ckg_schema_' + screenName;
    const res = await chrome.storage.local.get(key);
    return res[key] || null;
  },

  /**
   * Load all schemas from storage.
   * @returns {Object[]}
   */
  async loadAllSchemas() {
    const idxRes = await chrome.storage.local.get('ckg_schema_index');
    const index  = idxRes.ckg_schema_index || [];
    const schemas = [];
    for (const name of index) {
      const s = await this.loadSchema(name);
      if (s) schemas.push(s);
    }
    return schemas;
  },

  /**
   * Sync static schema JSON files (schemas/*.json) into chrome.storage on startup.
   * Call this from background.js onInstalled + service worker wake.
   *
   * @param {string[]} screenNames — list of screen slugs matching schemas/*.json files
   */
  async syncStaticSchemas(screenNames = []) {
    const SCREENS = screenNames.length ? screenNames : [
      'perilaku_merokok', 'tb_dewasa', 'diabetes',
      'hipertensi', 'jantung', 'stroke',
      'aktivitas_fisik', 'pola_makan',
    ];

    for (const name of SCREENS) {
      try {
        const url  = chrome.runtime.getURL(`schemas/${name}.json`);
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        await this.saveSchema(data);
        console.log('[CKG SchemaDiscovery] Synced schema:', name);
      } catch (e) {
        console.warn('[CKG SchemaDiscovery] Failed to sync schema:', name, e.message);
      }
    }
  },

};

// ── ESM Export ────────────────────────────────────────────────────────────
export { SchemaDiscovery };

// Global expose for executor_inject / content script context
if (typeof window !== 'undefined') {
  window.SchemaDiscovery = SchemaDiscovery;
}
