// storage.js - CKG Auto KlikPro Storage Wrapper v1.0
// Wrapper tipis di atas chrome.storage dengan namespace 'ckg_'
// Semua key otomatis di-prefix agar tidak konflik dengan extension lain

const NS = 'ckg_';

const storage = {

  // ── Local (persisten, tetap walau browser restart) ─────────────────────

  async get(key, fallback = null) {
    const k = NS + key;
    const res = await chrome.storage.local.get(k);
    return res[k] !== undefined ? res[k] : fallback;
  },

  async set(key, value) {
    await chrome.storage.local.set({ [NS + key]: value });
  },

  async remove(key) {
    await chrome.storage.local.remove(NS + key);
  },

  async getAll() {
    const all = await chrome.storage.local.get(null);
    const result = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(NS)) {
        result[k.slice(NS.length)] = v;
      }
    }
    return result;
  },

  async clear() {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith(NS));
    await chrome.storage.local.remove(keys);
  },

  // ── Session (hilang saat browser/extension restart) ────────────────────
  // Dipakai untuk: checkpoint run, state queue aktif

  session: {
    async get(key, fallback = null) {
      const k = NS + 'session_' + key;
      const res = await chrome.storage.session.get(k);
      return res[k] !== undefined ? res[k] : fallback;
    },

    async set(key, value) {
      await chrome.storage.session.set({ [NS + 'session_' + key]: value });
    },

    async remove(key) {
      await chrome.storage.session.remove(NS + 'session_' + key);
    },

    async clear() {
      const all = await chrome.storage.session.get(null);
      const prefix = NS + 'session_';
      const keys = Object.keys(all).filter(k => k.startsWith(prefix));
      await chrome.storage.session.remove(keys);
    }
  },

  // ── Named getters/setters untuk domain spesifik ────────────────────────

  templates: {
    async get(workflowName) {
      return storage.get('template_' + workflowName, null);
    },
    async set(workflowName, steps) {
      await storage.set('template_' + workflowName, steps);
    },
    async getAll() {
      const WORKFLOWS = ['pendaftaran', 'konfirmasi', 'kuesioner', 'pemeriksaan', 'selesai'];
      const result = {};
      for (const wf of WORKFLOWS) {
        result[wf] = await storage.get('template_' + wf, null);
      }
      return result;
    }
  },

  quizRules: {
    async get() {
      return storage.get('quiz_rules', []);
    },
    async set(rules) {
      await storage.set('quiz_rules', rules);
    }
  },

  fieldMapping: {
    async get() {
      return storage.get('field_mapping', DEFAULT_FIELD_MAPPING);
    },
    async set(mapping) {
      await storage.set('field_mapping', mapping);
    }
  },

  settings: {
    async get() {
      return storage.get('settings', DEFAULT_SETTINGS);
    },
    async set(settings) {
      await storage.set('settings', settings);
    },
    async patch(partial) {
      const current = await storage.settings.get();
      await storage.set('settings', { ...current, ...partial });
    }
  },

  // ── Run state (checkpoint per pasien) ──────────────────────────────────

  runState: {
    async save(state) {
      // state = { queueIndex, stepIndex, pasienData, workflow, timestamp }
      await storage.session.set('run_state', { ...state, timestamp: Date.now() });
    },
    async get() {
      return storage.session.get('run_state', null);
    },
    async clear() {
      await storage.session.remove('run_state');
    }
  },

  // ── Run log (simpan hasil per sesi) ────────────────────────────────────

  runLog: {
    async append(entry) {
      // entry = { time, pasien, workflow, status, message }
      const logs = await storage.get('run_log', []);
      logs.push({ ...entry, time: Date.now() });
      // Max 500 entries, buang yang lama
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      await storage.set('run_log', logs);
    },
    async get() {
      return storage.get('run_log', []);
    },
    async clear() {
      await storage.remove('run_log');
    }
  }
};

// ── Default configs ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  retryMax: 3,
  retryDelayMs: 1500,
  stepDelayMs: 500,        // jeda antar step
  navigateTimeoutMs: 10000,
  elementTimeoutMs: 8000,
  activeWorkflows: {
    pendaftaran: true,
    konfirmasi: true,
    kuesioner: true,
    pemeriksaan: true,
    selesai: true
  }
};

const DEFAULT_FIELD_MAPPING = {
  NIK: 'NIK',
  Nama: 'Nama',
  TTL: 'TTL',
  Jenis_Kelamin: 'Jenis_Kelamin',
  No_WA: 'No_WA',
  Pekerjaan: 'Pekerjaan',
  Alamat: 'Alamat',
  Provinsi: 'Provinsi',
  Kabupaten: 'Kabupaten',
  Kecamatan: 'Kecamatan',
  Kelurahan: 'Kelurahan',
  Status_Nikah: 'Status_Nikah',
  BB: 'BB',
  TB: 'TB',
  GDS: 'GDS',
  TD_Sistolik: 'TD_Sistolik',
  TD_Diastolik: 'TD_Diastolik',
  Diagnosa: 'Diagnosa',
  Tanggal_Periksa: 'Tanggal_Periksa',
  No_Antrian: 'No_Antrian'
};

// Export untuk ES module (background.js) dan juga support non-module
if (typeof module !== 'undefined') {
  module.exports = { storage, DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING };
}

// ── ESM Export ────────────────────────────────────────────────────────────────
export { storage, DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING };
