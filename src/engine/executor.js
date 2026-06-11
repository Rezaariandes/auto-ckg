// executor.js - CKG Auto KlikPro v2.0
// Eksekusi tiap step type: click, type, select, navigate, scroll, wait
// + extended types: date_picker, select_dropdown, select_antrian, select_pekerjaan, select_alamat
// + v2 types: schema_quiz (schema-driven, PPV-dynamic SurveyJS fill)

import { waitForElement, waitForUrl } from './observer.js';
import { SchemaAutofill }           from './schema_autofill.js';
import { SchemaDiscovery }          from './schema_discovery.js';

/**
 * Eksekusi satu step.
 * @param {Object} step - step object dari template JSON
 * @param {Object} pasienData - row data dari Excel
 * @param {Object} settings - dari storage.settings
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function executeStep(step, pasienData = {}, settings = {}) {
  const delay = settings.stepDelayMs ?? 500;
  const elTimeout = settings.elementTimeoutMs ?? 8000;

  // Resolve value: dari Excel atau hardcoded
  const value = resolveValue(step, pasienData);

  try {
    switch (step.type) {

      case 'navigate':
        return await doNavigate(step, elTimeout);

      case 'wait':
        return await doWait(step, elTimeout);

      case 'click':
        return await doClick(step, elTimeout);

      case 'type':
        return await doType(step, value, elTimeout);

      case 'select':
        return await doSelect(step, value, elTimeout);

      case 'scroll':
        return await doScroll(step, elTimeout);

      // ── Extended types dari recording CKG ──────────────────────────
      case 'date_picker':
        return await doDatePicker(step, value, elTimeout);

      case 'select_dropdown':
        return await doSelectDropdown(step, value, elTimeout);

      case 'select_antrian':
        return await doSelectAntrian(step, value, elTimeout);

      case 'select_pekerjaan':
        return await doSelectPekerjaan(step, value, elTimeout);

      case 'select_alamat':
        return await doSelectAlamat(step, pasienData, elTimeout);

      case 'quiz_answer':
        return await doQuizAnswer(step, value, elTimeout);

      // ── v2: Schema-driven SurveyJS fill ───────────────────────────────
      case 'schema_quiz':
        return await doSchemaQuiz(step, pasienData, settings);

      default:
        return { success: false, message: `Unknown step type: "${step.type}"` };
    }
  } finally {
    if (delay > 0) await sleep(delay);
  }
}

// ── Step Handlers ──────────────────────────────────────────────────────────

async function doNavigate(step, timeout) {
  const url = step.value;
  if (!url) return { success: false, message: 'navigate: value (URL) kosong' };

  if (location.href === url || location.href.startsWith(url)) {
    return { success: true, message: `navigate: already at ${url}` };
  }

  location.href = url;

  try {
    await waitForUrl(url, timeout);
    return { success: true, message: `navigate: OK → ${url}` };
  } catch (e) {
    return { success: false, message: `navigate: timeout menunggu URL ${url}` };
  }
}

async function doWait(step, timeout) {
  const ms = step.value ? parseInt(step.value) : timeout;
  try {
    await waitForElement(step.selector, ms, step.placeholder || null);
    return { success: true, message: `wait: element muncul "${step.selector}"` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function doClick(step, timeout) {
  try {
    const el = await waitForElement(step.selector, timeout, step.placeholder || null);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(200);
    el.click();
    return { success: true, message: `click: OK "${step.label}"` };
  } catch (e) {
    return { success: false, message: `click: ${e.message}` };
  }
}

async function doType(step, value, timeout) {
  if (value === null || value === undefined) {
    return { success: false, message: `type: value null — cek excelColumn "${step.excelColumn}"` };
  }
  try {
    const el = await waitForElement(step.selector, timeout, step.placeholder || null);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus();
    // Clear existing — support React controlled inputs
    nativeInputValueSetter(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    // Set new value
    nativeInputValueSetter(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, message: `type: "${step.excelColumn}" = "${value}"` };
  } catch (e) {
    return { success: false, message: `type: ${e.message}` };
  }
}

async function doSelect(step, value, timeout) {
  if (!value) return { success: false, message: 'select: value kosong' };
  try {
    const el = await waitForElement(step.selector, timeout);
    const option = Array.from(el.options).find(
      o => o.value === String(value) || o.text.toLowerCase().includes(String(value).toLowerCase())
    );
    if (!option) return { success: false, message: `select: opsi "${value}" tidak ditemukan` };
    nativeSelectSetter(el, option.value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, message: `select: OK "${value}"` };
  } catch (e) {
    return { success: false, message: `select: ${e.message}` };
  }
}

async function doScroll(step, timeout) {
  if (step.selector) {
    try {
      const el = await waitForElement(step.selector, timeout);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (_) {}
  } else {
    const y = parseInt(step.value) || 300;
    window.scrollBy({ top: y, behavior: 'smooth' });
  }
  return { success: true, message: 'scroll: OK' };
}

// ── Extended Type Handlers ──────────────────────────────────────────────────

/**
 * date_picker — klik container, tunggu kalender muncul, pilih tanggal.
 * Site pakai Vue/custom date picker, bukan <input type="date">.
 * Strategy: cari input tersembunyi, set value langsung + dispatch events.
 */
async function doDatePicker(step, value, timeout) {
  if (!value) return { success: false, message: 'date_picker: value (TTL) kosong' };

  try {
    // Klik container date picker dulu agar terbuka
    const container = await waitForElement(step.selector, timeout, step.placeholder || null);
    container.click();
    await sleep(400);

    // Coba temukan input[type=text] atau input[type=date] di dalam picker
    const pickerInput = container.querySelector('input[type="text"], input[type="date"]')
      || document.querySelector('.dp__input, input[class*="date"], input[class*="picker"]');

    if (pickerInput) {
      // Format: "2026-06-07" → "07/06/2026" atau format yang site terima
      const formatted = formatDateForSite(String(value));
      nativeInputValueSetter(pickerInput, formatted);
      pickerInput.dispatchEvent(new Event('input', { bubbles: true }));
      pickerInput.dispatchEvent(new Event('change', { bubbles: true }));
      pickerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(300);
      // Dismiss picker
      document.body.click();
      return { success: true, message: `date_picker: set "${formatted}"` };
    }

    return { success: false, message: 'date_picker: picker input tidak ditemukan' };
  } catch (e) {
    return { success: false, message: `date_picker: ${e.message}` };
  }
}

/**
 * select_dropdown — custom Vue dropdown (bukan <select> native).
 * Strategy: klik trigger → tunggu listbox → klik opsi yang cocok.
 */
async function doSelectDropdown(step, value, timeout) {
  const target = value ?? step.value;
  if (!target) return { success: false, message: 'select_dropdown: value kosong' };

  try {
    const trigger = await waitForElement(step.selector, timeout, step.placeholder || null);
    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    await sleep(400);

    // Listbox / dropdown option container muncul
    const optionEl = await findDropdownOption(String(target), 3000);
    if (!optionEl) return { success: false, message: `select_dropdown: opsi "${target}" tidak ditemukan` };

    optionEl.click();
    await sleep(200);
    return { success: true, message: `select_dropdown: OK "${target}"` };
  } catch (e) {
    return { success: false, message: `select_dropdown: ${e.message}` };
  }
}

/**
 * select_antrian — klik tombol angka antrian berdasarkan No_Antrian dari Excel.
 */
async function doSelectAntrian(step, value, timeout) {
  const nomor = parseInt(value);
  if (isNaN(nomor)) return { success: false, message: `select_antrian: No_Antrian tidak valid: "${value}"` };

  try {
    // Tunggu slot antrian muncul
    await waitForElement(step.selector || 'button', timeout);
    await sleep(300);

    // Cari semua tombol slot, pilih index ke-nomor (1-based)
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter(b => b.innerText.trim().match(/^\d+$/) || b.dataset.slot !== undefined);

    // Coba match by angka dulu
    const byText = buttons.find(b => b.innerText.trim() === String(nomor));
    if (byText) {
      byText.click();
      return { success: true, message: `select_antrian: klik antrian ${nomor}` };
    }

    // Fallback: index ke-N dari list slot
    const slots = document.querySelectorAll('[class*="slot"], [class*="antrian"], [class*="queue"]');
    const target = slots[nomor - 1];
    if (target) {
      target.click();
      return { success: true, message: `select_antrian: klik slot index ${nomor}` };
    }

    return { success: false, message: `select_antrian: slot ${nomor} tidak ditemukan` };
  } catch (e) {
    return { success: false, message: `select_antrian: ${e.message}` };
  }
}

/**
 * select_pekerjaan — dropdown dengan search/filter.
 * Ketik pekerjaan di search input, tunggu list, klik opsi pertama.
 */
async function doSelectPekerjaan(step, value, timeout) {
  if (!value) return { success: false, message: 'select_pekerjaan: value (Pekerjaan) kosong' };

  try {
    const trigger = await waitForElement(step.selector, timeout, step.placeholder || null);
    trigger.click();
    await sleep(400);

    // Cari search input dalam dropdown
    const searchInput = document.querySelector(
      'input[placeholder*="cari"], input[placeholder*="search"], input[placeholder*="ketik"], .dropdown-search input, [class*="search"] input'
    );

    if (searchInput) {
      nativeInputValueSetter(searchInput, String(value));
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(600); // tunggu filter
    }

    const optionEl = await findDropdownOption(String(value), 3000);
    if (!optionEl) return { success: false, message: `select_pekerjaan: "${value}" tidak ditemukan` };

    optionEl.click();
    return { success: true, message: `select_pekerjaan: OK "${value}"` };
  } catch (e) {
    return { success: false, message: `select_pekerjaan: ${e.message}` };
  }
}

/**
 * select_alamat — cascade: Provinsi → Kabupaten → Kecamatan → Kelurahan.
 * Setiap level: klik dropdown → cari opsi → klik → tunggu level berikutnya.
 */
async function doSelectAlamat(step, pasienData, timeout) {
  const levels = [
    { key: 'Provinsi',  placeholder: 'Pilih provinsi'    },
    { key: 'Kabupaten', placeholder: 'Pilih kabupaten'   },
    { key: 'Kecamatan', placeholder: 'Pilih kecamatan'   },
    { key: 'Kelurahan', placeholder: 'Pilih kelurahan'   },
  ];

  for (const level of levels) {
    const val = pasienData[level.key];
    if (!val) continue; // skip jika kolom kosong

    try {
      // Klik trigger dropdown level ini
      const trigger = await waitForElement('div', 4000, level.placeholder);
      trigger.scrollIntoView({ block: 'center' });
      trigger.click();
      await sleep(500);

      const optionEl = await findDropdownOption(String(val), 4000);
      if (!optionEl) {
        return { success: false, message: `select_alamat: "${val}" (${level.key}) tidak ditemukan` };
      }
      optionEl.click();
      await sleep(600); // tunggu level berikutnya load
    } catch (e) {
      return { success: false, message: `select_alamat [${level.key}]: ${e.message}` };
    }
  }

  return { success: true, message: 'select_alamat: cascade OK' };
}

/**
 * quiz_answer — isi jawaban kuesioner berdasarkan judul pertanyaan.
 * step.value = jawaban ("Ya"/"Tidak"/teks).
 * step.selector = judul pertanyaan (label).
 */
async function doQuizAnswer(step, value, timeout) {
  if (!value) return { success: false, message: 'quiz_answer: value kosong' };

  try {
    // Temukan container pertanyaan berdasarkan teks judul
    const questionTitle = step.selector || step.questionTitle;
    const allText = Array.from(document.querySelectorAll('p, span, label, div'))
      .find(el => el.innerText?.trim().toLowerCase().includes(questionTitle.toLowerCase()));

    if (!allText) return { success: false, message: `quiz_answer: pertanyaan "${questionTitle}" tidak ditemukan` };

    // Cari answer options dalam parent container
    const container = allText.closest('[class*="question"], [class*="kuesioner"], form, .card, section') || allText.parentElement;
    const options = Array.from(container.querySelectorAll('button, [role="radio"], label, .option'));
    const target = options.find(o => o.innerText.trim().toLowerCase() === String(value).toLowerCase());

    if (!target) return { success: false, message: `quiz_answer: opsi "${value}" tidak ditemukan` };

    target.click();
    return { success: true, message: `quiz_answer: "${questionTitle}" → "${value}"` };
  } catch (e) {
    return { success: false, message: `quiz_answer: ${e.message}` };
  }
}

// ── v2: Schema Quiz Handler ──────────────────────────────────────────────

/**
 * schema_quiz — schema-driven SurveyJS fill.
 * step.questionTitle = question text to match in DOM
 * step.value / step.answerLabel = answer label (human text, e.g. "Ya", "Tidak")
 * step.screenName = schema screen name for PPV resolution
 *
 * Self-healing: discovers live PPV from DOM — no hardcoded values.
 */
async function doSchemaQuiz(step, pasienData, settings = {}) {
  const questionText = step.questionTitle || step.selector || '';
  const answerLabel  = step.answerLabel   || step.value    || '';
  const screenName   = step.screenName    || '';
  const pasienNIK    = pasienData?.NIK    || '';

  if (!questionText) return { success: false, message: 'schema_quiz: questionTitle kosong' };
  if (!answerLabel)  return { success: false, message: 'schema_quiz: answerLabel kosong' };

  // Load schema from storage for PPV lookup (self-healing)
  let schema = null;
  if (screenName) {
    try {
      schema = await SchemaDiscovery.loadSchema(screenName);
    } catch (_) { /* schema not yet stored — fall back to DOM label matching */ }
  }

  // If no stored schema, do a live discovery for PPV on this screen
  if (!schema) {
    try {
      schema = SchemaDiscovery.scanCurrentScreen(screenName);
    } catch (_) { /* continue without schema */ }
  }

  return SchemaAutofill.fillQuestion({
    questionText,
    answerLabel,
    schema,
    pasienNIK,
    screenName,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Cari opsi dropdown yang cocok dengan text (case-insensitive, partial).
 * Dropdown Vue biasanya render di `[class*="option"], li, [role="option"]`.
 */
async function findDropdownOption(text, timeoutMs = 3000) {
  const selectors = [
    '[role="option"]',
    '[class*="option"]',
    '[class*="item"]',
    'li',
    '.dropdown-item',
    '.v-list-item',
  ];

  const deadline = Date.now() + timeoutMs;
  const lower = text.toLowerCase();

  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const items = Array.from(document.querySelectorAll(sel));
      const match = items.find(el => el.innerText?.trim().toLowerCase() === lower)
        || items.find(el => el.innerText?.trim().toLowerCase().includes(lower));
      if (match) return match;
    }
    await sleep(150);
  }
  return null;
}

/**
 * Format tanggal dari Excel (berbagai format) → format site.
 * Input bisa: "1990-10-10", "10-10-1990", Date object.
 * Output: "10/10/1990" (format umum di site kesehatan RI).
 */
function formatDateForSite(raw) {
  if (!raw) return '';
  // Coba parse
  const d = new Date(raw);
  if (!isNaN(d)) {
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${day}/${mon}/${yr}`;
  }
  // Passthrough jika tidak bisa parse
  return raw;
}

function resolveValue(step, pasienData) {
  if (step.excelColumn && step.excelColumn !== '__alamat_bundle__') {
    const col = step.excelColumn;
    return pasienData[col] !== undefined ? pasienData[col] : null;
  }
  return step.value ?? null;
}

/** React/Vue-safe input setter via native descriptor. */
function nativeInputValueSetter(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
}

function nativeSelectSetter(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
