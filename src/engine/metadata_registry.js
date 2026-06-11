// metadata_registry.js - CKG Auto KlikPro v2.1
// Metadata-First Architecture — Phase 1 (Registry layer)
//
// Bertanggung jawab atas:
//   1. Normalisasi schema hasil React-state discovery / DOM discovery.
//   2. PPV Registry: index PPV code ↔ label ↔ PPM (question) ↔ screen, dengan
//      version history (deteksi PPV baru / berubah / hilang).
//   3. Merge metadata (PPV/PPM) ke schema DOM sebagai pengayaan (enrichment).
//
// Fungsi murni (normalize/diff/merge) tidak menyentuh chrome.* sehingga dapat
// diuji di Node. Fungsi storage memakai chrome.storage.local.
//
// Storage keys:
//   ckg_metadata_<screen>  → schema metadata terakhir untuk satu screen
//   ckg_ppv_registry       → { [ppv]: { label, code, screen, firstSeen, lastSeen, history:[] } }

'use strict';

// ── Utilities (pure) ─────────────────────────────────────────────────────────

function _norm(s) {
  return (s || '').toString().trim().toLowerCase();
}

/**
 * Pastikan schema punya bentuk standar (questions[].options[].{value,label}).
 * Idempotent — aman dipanggil ke schema metadata maupun DOM.
 * @param {Object} schema
 * @returns {Object}
 */
export function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { screen: 'unknown', title: '', version: 1, questions: [], _source: 'unknown' };
  }
  const questions = Array.isArray(schema.questions) ? schema.questions : [];
  const normQuestions = questions.map(q => {
    const out = {
      question: (q.question || '').toString(),
      type: q.type || 'unknown',
      name: q.name || '',
      code: q.code || '',
      form: q.form || '',
    };
    if (Array.isArray(q.options)) {
      out.options = q.options.map(o => ({
        id: o.id || '',
        value: (o.value != null ? String(o.value) : ''),
        label: (o.label != null ? String(o.label) : ''),
      }));
    }
    if (q.id != null) out.id = q.id;
    if (q.placeholder != null) out.placeholder = q.placeholder;
    return out;
  });
  return {
    screen: schema.screen || 'unknown',
    title: schema.title || '',
    version: schema.version || 1,
    generatedAt: schema.generatedAt || new Date().toISOString(),
    fingerprint: schema.fingerprint || '',
    questions: normQuestions,
    _source: schema._source || 'unknown',
    _form: schema._form || '',
  };
}

/**
 * Bangun daftar entri PPV registry dari satu schema.
 * Hanya pertanyaan yang punya options dengan value (PPV) ikut terindeks.
 * @param {Object} schema
 * @returns {Array<{ppv:string,label:string,code:string,screen:string}>}
 */
export function buildPPVEntries(schema) {
  const entries = [];
  const screen = schema.screen || 'unknown';
  for (const q of (schema.questions || [])) {
    if (!Array.isArray(q.options)) continue;
    for (const o of q.options) {
      if (!o.value) continue;
      entries.push({ ppv: o.value, label: o.label || '', code: q.code || '', screen });
    }
  }
  return entries;
}

/**
 * Hitung perbedaan antara registry lama dan entri baru.
 * @param {Object} oldRegistry  — { [ppv]: entry }
 * @param {Array}  newEntries   — hasil buildPPVEntries()
 * @returns {{added:Array,changed:Array,unchanged:Array}}
 */
export function diffPPV(oldRegistry, newEntries) {
  const added = [], changed = [], unchanged = [];
  for (const e of newEntries) {
    const prev = oldRegistry[e.ppv];
    if (!prev) {
      added.push(e);
    } else if (_norm(prev.label) !== _norm(e.label) || prev.code !== e.code) {
      changed.push({ ppv: e.ppv, from: { label: prev.label, code: prev.code }, to: { label: e.label, code: e.code } });
    } else {
      unchanged.push(e);
    }
  }
  return { added, changed, unchanged };
}

/**
 * Gabungkan registry lama + entri baru → registry baru (immutable copy).
 * Menyimpan history perubahan label/code per PPV.
 * @param {Object} oldRegistry
 * @param {Array}  newEntries
 * @param {string} now ISO timestamp
 * @returns {Object} registry baru
 */
export function mergeRegistry(oldRegistry, newEntries, now = new Date().toISOString()) {
  const reg = JSON.parse(JSON.stringify(oldRegistry || {}));
  for (const e of newEntries) {
    const prev = reg[e.ppv];
    if (!prev) {
      reg[e.ppv] = {
        ppv: e.ppv, label: e.label, code: e.code, screen: e.screen,
        firstSeen: now, lastSeen: now, history: [],
      };
    } else {
      if (_norm(prev.label) !== _norm(e.label) || prev.code !== e.code) {
        prev.history = prev.history || [];
        prev.history.push({ at: now, label: prev.label, code: prev.code });
      }
      prev.label = e.label || prev.label;
      prev.code = e.code || prev.code;
      prev.screen = e.screen || prev.screen;
      prev.lastSeen = now;
    }
  }
  return reg;
}

/**
 * Enrich schema DOM dengan PPV/PPM dari schema metadata.
 * Cocokkan pertanyaan via teks (title) → isi `code`, dan option.value (PPV)
 * via pencocokan label. Tidak menimpa value DOM jika sudah ada.
 * @param {Object} domSchema
 * @param {Object} metaSchema
 * @returns {Object} schema gabungan (copy)
 */
export function mergeMetaIntoDom(domSchema, metaSchema) {
  const dom = normalizeSchema(domSchema);
  if (!metaSchema || !Array.isArray(metaSchema.questions) || !metaSchema.questions.length) {
    return dom;
  }
  const meta = normalizeSchema(metaSchema);

  const findMetaQ = (qText) => {
    const n = _norm(qText);
    return meta.questions.find(mq =>
      _norm(mq.question) === n ||
      (_norm(mq.question) && (_norm(mq.question).includes(n) || n.includes(_norm(mq.question))))
    ) || null;
  };

  for (const q of dom.questions) {
    const mq = findMetaQ(q.question);
    if (!mq) continue;
    if (!q.code && mq.code) q.code = mq.code;
    if (!q.form && mq.form) q.form = mq.form;
    if (!q.name && mq.name) q.name = mq.name;
    if (Array.isArray(q.options) && Array.isArray(mq.options)) {
      for (const o of q.options) {
        if (o.value) continue; // jangan timpa PPV yang sudah ada dari DOM
        const m = mq.options.find(mo => _norm(mo.label) === _norm(o.label) ||
          (_norm(mo.label) && _norm(o.label) && (_norm(mo.label).includes(_norm(o.label)) || _norm(o.label).includes(_norm(mo.label)))));
        if (m && m.value) o.value = m.value;
      }
    }
  }
  dom._enrichedFromMeta = true;
  return dom;
}

// ── Storage layer (chrome.storage.local) ─────────────────────────────────────

const PPV_REGISTRY_KEY = 'ckg_ppv_registry';

function _hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

export const MetadataRegistry = {
  normalizeSchema, buildPPVEntries, diffPPV, mergeRegistry, mergeMetaIntoDom,

  async getRegistry() {
    if (!_hasChromeStorage()) return {};
    const res = await chrome.storage.local.get(PPV_REGISTRY_KEY);
    return res[PPV_REGISTRY_KEY] || {};
  },

  async getMetadata(screen) {
    if (!_hasChromeStorage()) return null;
    const key = 'ckg_metadata_' + screen;
    const res = await chrome.storage.local.get(key);
    return res[key] || null;
  },

  /**
   * Simpan schema metadata + perbarui PPV registry. Mengembalikan ringkasan diff.
   * @param {Object} rawSchema
   * @returns {Promise<{ok:boolean, screen:string, diff:Object}>}
   */
  async upsertMetadata(rawSchema) {
    const schema = normalizeSchema(rawSchema);
    const now = new Date().toISOString();
    const newEntries = buildPPVEntries(schema);

    if (!_hasChromeStorage()) {
      return { ok: false, screen: schema.screen, diff: diffPPV({}, newEntries), error: 'no chrome.storage' };
    }

    const oldReg = await this.getRegistry();
    const diff = diffPPV(oldReg, newEntries);
    const newReg = mergeRegistry(oldReg, newEntries, now);

    await chrome.storage.local.set({
      ['ckg_metadata_' + schema.screen]: schema,
      [PPV_REGISTRY_KEY]: newReg,
    });

    return { ok: true, screen: schema.screen, diff, ppvCount: newEntries.length };
  },
};

// Global expose untuk konteks injeksi / debugging
if (typeof window !== 'undefined') {
  window.MetadataRegistry = MetadataRegistry;
}
