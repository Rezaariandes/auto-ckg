// schema_autofill.js - CKG Auto KlikPro v2.0
// Universal AutoFill Engine — Schema-driven, PPV-dynamic, React/SurveyJS-safe
//
// This module replaces hardcoded quiz_answer logic with a schema-aware engine:
//   1. Receives a question text + intended answer label
//   2. Looks up the matching schema question → finds the PPV value
//   3. Fills the actual DOM input using that PPV (never hardcoded)
//   4. Triggers all required React/SurveyJS events (click + input + change + blur)
//
// Self-Healing: if SATUSEHAT changes PPV00000364 → PPV00009999, this engine
// re-discovers it from the DOM via schema_discovery.js and continues working.

'use strict';

// ── Event helpers — required for React + SurveyJS controlled inputs ─────────

function _triggerEvents(el, events = ['click', 'input', 'change', 'blur']) {
  for (const evtName of events) {
    let evt;
    if (evtName === 'click') {
      evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    } else if (evtName === 'blur' || evtName === 'focus') {
      evt = new FocusEvent(evtName, { bubbles: true });
    } else {
      evt = new Event(evtName, { bubbles: true });
    }
    el.dispatchEvent(evt);
  }
}

function _nativeInputSet(el, value) {
  const proto  = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Schema lookup helpers ────────────────────────────────────────────────────

/**
 * Find a question entry in a schema by normalized text match.
 * @param {Object} schema
 * @param {string} questionText
 * @returns {Object|null}
 */
function _findSchemaQuestion(schema, questionText) {
  if (!schema?.questions) return null;
  const norm = (questionText || '').trim().toLowerCase();
  return schema.questions.find(q =>
    (q.question || '').trim().toLowerCase() === norm ||
    (q.question || '').trim().toLowerCase().includes(norm) ||
    norm.includes((q.question || '').trim().toLowerCase())
  ) || null;
}

/**
 * Find the PPV value for a given answer label within a schema question.
 * @param {Object} schemaQuestion
 * @param {string} answerLabel
 * @returns {string|null} PPV value or null
 */
function _resolvePPV(schemaQuestion, answerLabel) {
  if (!schemaQuestion?.options) return null;
  const norm = (answerLabel || '').trim().toLowerCase();
  const opt  = schemaQuestion.options.find(o =>
    (o.label || '').trim().toLowerCase() === norm ||
    (o.label || '').trim().toLowerCase().includes(norm) ||
    norm.includes((o.label || '').trim().toLowerCase())
  );
  return opt?.value || null;
}

// ── Main AutoFill Engine ─────────────────────────────────────────────────────

const SchemaAutofill = {

  /**
   * Fill a single question on the current page.
   *
   * @param {Object} params
   * @param {string}  params.questionText  — text of the question (used for DOM lookup)
   * @param {string}  params.answerLabel   — human-readable answer label (e.g. "Ya", "Tidak")
   * @param {Object}  [params.schema]      — schema object for this screen (optional but recommended)
   * @param {string}  [params.pasienNIK]   — for audit log
   * @param {string}  [params.screenName]  — for audit log
   * @param {boolean} [params.skipAudit]   — skip audit logging
   * @returns {Promise<{success: boolean, message: string, ppv?: string}>}
   */
  async fillQuestion({ questionText, answerLabel, schema = null, pasienNIK = '', screenName = '', skipAudit = false }) {
    if (!questionText) return { success: false, message: 'fillQuestion: questionText kosong' };
    if (!answerLabel && answerLabel !== 0) return { success: false, message: 'fillQuestion: answerLabel kosong' };

    // ── 1. Find question block in DOM ─────────────────────────────────────
    const questionBlock = this._findQuestionBlock(questionText);
    if (!questionBlock) {
      return { success: false, message: `fillQuestion: pertanyaan tidak ditemukan di DOM: "${questionText}"` };
    }

    // ── 2. Determine fill strategy from DOM ───────────────────────────────
    const radios     = questionBlock.querySelectorAll('input[type="radio"]');
    const checkboxes = questionBlock.querySelectorAll('input[type="checkbox"]');
    const numbers    = questionBlock.querySelectorAll('input[type="number"]');
    const texts      = questionBlock.querySelectorAll('input[type="text"], input:not([type])');
    const textareas  = questionBlock.querySelectorAll('textarea');
    const selects    = questionBlock.querySelectorAll('select');

    let result;

    if (radios.length) {
      // ── Schema PPV lookup → selectRadio ──────────────────────────────
      const schemaQ = schema ? _findSchemaQuestion(schema, questionText) : null;
      const ppv     = schemaQ ? _resolvePPV(schemaQ, answerLabel) : null;

      result = await this.selectRadio(questionBlock, answerLabel, ppv);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: ppv || result.ppv, screenName, pasienNIK, type: 'radio' });
      }

    } else if (checkboxes.length) {
      result = await this.selectCheckbox(questionBlock, answerLabel);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: '', screenName, pasienNIK, type: 'checkbox' });
      }

    } else if (numbers.length) {
      result = await this.setNumber(numbers[0], answerLabel);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: '', screenName, pasienNIK, type: 'number' });
      }

    } else if (textareas.length) {
      result = await this.setTextarea(textareas[0], answerLabel);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: '', screenName, pasienNIK, type: 'textarea' });
      }

    } else if (selects.length) {
      result = await this.setSelect(selects[0], answerLabel);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: '', screenName, pasienNIK, type: 'select' });
      }

    } else if (texts.length) {
      result = await this.setText(texts[0], answerLabel);
      if (result.success && !skipAudit) {
        await this._auditLog({ questionText, answerLabel, ppv: '', screenName, pasienNIK, type: 'text' });
      }

    } else {
      result = { success: false, message: `fillQuestion: tidak ada input ditemukan untuk "${questionText}"` };
    }

    return result;
  },

  /**
   * Fill all questions on the current screen based on a schema + answer map.
   *
   * @param {Object} schema       — schema for this screen
   * @param {Object} answerMap    — { normalizedQuestion: answerLabel }
   * @param {Object} [options]
   * @param {string} [options.pasienNIK]
   * @param {string} [options.screenName]
   * @param {number} [options.delayMs]   — ms between each fill (default 300)
   * @returns {Promise<{filled: number, skipped: number, errors: Object[]}>}
   */
  async fillScreen(schema, answerMap, { pasienNIK = '', screenName = '', delayMs = 300 } = {}) {
    let filled = 0, skipped = 0;
    const errors = [];

    for (const [questionText, answerLabel] of Object.entries(answerMap)) {
      if (!answerLabel && answerLabel !== 0) { skipped++; continue; }

      const result = await this.fillQuestion({
        questionText, answerLabel, schema, pasienNIK, screenName,
      });

      if (result.success) {
        filled++;
      } else {
        errors.push({ question: questionText, answer: answerLabel, error: result.message });
      }

      if (delayMs > 0) await _sleep(delayMs);
    }

    return { filled, skipped, errors };
  },

  // ── Low-level fill primitives ─────────────────────────────────────────────

  /**
   * Select a radio option.
   * Strategy: try PPV value match first, fall back to label text match.
   *
   * @param {Element} questionBlock
   * @param {string}  answerLabel
   * @param {string|null} ppv       — PPV value from schema (preferred)
   * @returns {Promise<{success: boolean, message: string, ppv?: string}>}
   */
  async selectRadio(questionBlock, answerLabel, ppv = null) {
    const radios = Array.from(questionBlock.querySelectorAll('input[type="radio"]'));
    if (!radios.length) return { success: false, message: 'selectRadio: no radio inputs' };

    let target = null;

    // 1. Try exact PPV value match (schema-driven, most reliable)
    if (ppv) {
      target = radios.find(r => r.value === ppv);
    }

    // 2. Fall back: scan DOM for PPV by matching label text in .sd-item
    if (!target) {
      const norm = (answerLabel || '').trim().toLowerCase();
      target = radios.find(r => {
        const item  = r.closest('.sd-item') || r.closest('label') || r.parentElement;
        const label = item?.querySelector('.sv-string-viewer')?.innerText?.trim()
                   || item?.innerText?.trim()
                   || r.getAttribute('aria-label')
                   || '';
        return label.toLowerCase() === norm || label.toLowerCase().includes(norm);
      });
    }

    if (!target) {
      return { success: false, message: `selectRadio: opsi "${answerLabel}" tidak ditemukan` };
    }

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await _sleep(100);

    // Click the radio + its label container
    const item = target.closest('.sd-item') || target.closest('label') || target.parentElement;
    if (item) item.click();
    target.checked = true;
    _triggerEvents(target, ['click', 'input', 'change']);

    return { success: true, message: `selectRadio: "${answerLabel}" ✓`, ppv: target.value };
  },

  /**
   * Select a checkbox option by label match.
   * @param {Element} questionBlock
   * @param {string}  answerLabel
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async selectCheckbox(questionBlock, answerLabel) {
    const checkboxes = Array.from(questionBlock.querySelectorAll('input[type="checkbox"]'));
    if (!checkboxes.length) return { success: false, message: 'selectCheckbox: no checkbox inputs' };

    const norm   = (answerLabel || '').trim().toLowerCase();
    const target = checkboxes.find(cb => {
      const item  = cb.closest('.sd-item') || cb.closest('label') || cb.parentElement;
      const label = item?.querySelector('.sv-string-viewer')?.innerText?.trim()
                 || item?.innerText?.trim()
                 || cb.getAttribute('aria-label')
                 || '';
      return label.toLowerCase() === norm || label.toLowerCase().includes(norm);
    });

    if (!target) return { success: false, message: `selectCheckbox: opsi "${answerLabel}" tidak ditemukan` };

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await _sleep(100);

    const item = target.closest('.sd-item') || target.closest('label') || target.parentElement;
    if (item) item.click();
    target.checked = true;
    _triggerEvents(target, ['click', 'input', 'change']);

    return { success: true, message: `selectCheckbox: "${answerLabel}" ✓` };
  },

  /**
   * Set a number input value.
   * @param {Element} input
   * @param {string|number} value
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setNumber(input, value) {
    if (!input) return { success: false, message: 'setNumber: input null' };
    const v = String(value).replace(',', '.');
    input.focus();
    _nativeInputSet(input, v);
    _triggerEvents(input, ['input', 'change', 'blur']);
    return { success: true, message: `setNumber: "${v}" ✓` };
  },

  /**
   * Set a text input value.
   * @param {Element} input
   * @param {string} value
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setText(input, value) {
    if (!input) return { success: false, message: 'setText: input null' };
    input.focus();
    _nativeInputSet(input, '');
    _triggerEvents(input, ['input']);
    await _sleep(50);
    _nativeInputSet(input, String(value));
    _triggerEvents(input, ['input', 'change', 'blur']);
    return { success: true, message: `setText: "${value}" ✓` };
  },

  /**
   * Set a textarea value.
   * @param {Element} textarea
   * @param {string} value
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setTextarea(textarea, value) {
    if (!textarea) return { success: false, message: 'setTextarea: element null' };
    textarea.focus();
    _nativeInputSet(textarea, String(value));
    _triggerEvents(textarea, ['input', 'change', 'blur']);
    return { success: true, message: `setTextarea: ✓` };
  },

  /**
   * Set a native <select> element value.
   * @param {Element} select
   * @param {string} value
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setSelect(select, value) {
    if (!select) return { success: false, message: 'setSelect: element null' };
    const norm   = String(value).toLowerCase();
    const option = Array.from(select.options).find(
      o => o.value.toLowerCase() === norm || o.text.toLowerCase().includes(norm)
    );
    if (!option) return { success: false, message: `setSelect: opsi "${value}" tidak ditemukan` };

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, option.value);
    else select.value = option.value;
    _triggerEvents(select, ['input', 'change']);
    return { success: true, message: `setSelect: "${option.text}" ✓` };
  },

  /**
   * Set a date input value.
   * Handles both native <input type="date"> and SurveyJS custom date pickers.
   * @param {Element} container   — question block container
   * @param {string}  dateValue   — date string in any standard format
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setDate(container, dateValue) {
    const dateInput = container?.querySelector('input[type="date"]');
    if (dateInput) {
      // ISO format required: YYYY-MM-DD
      let iso = dateValue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const d = new Date(dateValue);
        if (!isNaN(d)) {
          iso = d.toISOString().split('T')[0];
        }
      }
      _nativeInputSet(dateInput, iso);
      _triggerEvents(dateInput, ['input', 'change', 'blur']);
      return { success: true, message: `setDate: "${iso}" ✓` };
    }

    // Custom date picker — try text input within container
    const textInput = container?.querySelector('input[type="text"]');
    if (textInput) {
      textInput.click();
      await _sleep(200);
      _nativeInputSet(textInput, dateValue);
      _triggerEvents(textInput, ['input', 'change']);
      textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await _sleep(200);
      document.body.click();
      return { success: true, message: `setDate (custom picker): "${dateValue}" ✓` };
    }

    return { success: false, message: 'setDate: no date input found in container' };
  },

  // ── DOM Helpers ───────────────────────────────────────────────────────────

  /**
   * Find a question block (.sd-question) by matching its title text.
   * @param {string} questionText
   * @returns {Element|null}
   */
  _findQuestionBlock(questionText) {
    const norm = (questionText || '').trim().toLowerCase();
    const blocks = document.querySelectorAll('.sd-question');

    for (const block of blocks) {
      const title = block.querySelector('.sv-string-viewer')?.innerText?.trim() || '';
      if (title.toLowerCase() === norm || title.toLowerCase().includes(norm) || norm.includes(title.toLowerCase())) {
        return block;
      }
    }

    // Fallback: search all text nodes
    return null;
  },

  // ── Audit integration ─────────────────────────────────────────────────────

  async _auditLog({ questionText, answerLabel, ppv, screenName, pasienNIK, type }) {
    try {
      // Dynamic import to avoid circular deps — audit_log may not always be loaded
      if (typeof AuditLog !== 'undefined') {
        await AuditLog.logFill({
          question: questionText,
          answer:   answerLabel,
          ppv:      ppv || '',
          screen:   screenName,
          type,
          pasien:   pasienNIK,
        });
      } else if (typeof chrome !== 'undefined') {
        // Fallback: direct storage write
        const key = 'ckg_audit_log';
        const res = await chrome.storage.local.get(key);
        const log = res[key] || [];
        log.push({ question: questionText, answer: answerLabel, ppv: ppv || '', screen: screenName, type, pasien: pasienNIK, timestamp: new Date().toISOString() });
        if (log.length > 1000) log.splice(0, log.length - 1000);
        await chrome.storage.local.set({ [key]: log });
      }
    } catch (_) { /* audit failure must never block fill */ }
  },
};

// ── ESM Export ────────────────────────────────────────────────────────────
export { SchemaAutofill };

if (typeof window !== 'undefined') {
  window.SchemaAutofill = SchemaAutofill;
}
