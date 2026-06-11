// field_mapper.js - CKG Auto KlikPro Field Mapper v1.0
// Resolve nilai dari row Excel untuk dipakai step executor
// Menangani transformasi nilai: format tanggal, nomor WA, dll

const FieldMapper = {

  /**
   * Ambil nilai field dari data pasien, terapkan transformasi jika perlu
   *
   * @param {string} excelColumn - nama kolom Excel (sesuai DEFAULT_FIELD_MAPPING)
   * @param {Object} pasienData  - row data pasien dari Excel
   * @param {Object} mapping     - custom field mapping (dari storage)
   * @returns {string}
   */
  resolve(excelColumn, pasienData, mapping = {}) {
    // Cek custom mapping dulu, fallback ke nama kolom langsung
    const actualCol = mapping[excelColumn] || excelColumn;
    const raw = pasienData[actualCol];

    if (raw === undefined || raw === null || raw === '') return '';

    // Terapkan transformasi berdasarkan kolom
    return this._transform(excelColumn, String(raw).trim());
  },

  /**
   * Bundle alamat — return object semua komponen alamat
   */
  resolveAlamatBundle(pasienData, mapping = {}) {
    return {
      provinsi:   this.resolve('Provinsi', pasienData, mapping),
      kabupaten:  this.resolve('Kabupaten', pasienData, mapping),
      kecamatan:  this.resolve('Kecamatan', pasienData, mapping),
      kelurahan:  this.resolve('Kelurahan', pasienData, mapping),
      detail:     this.resolve('Alamat', pasienData, mapping)
    };
  },

  /**
   * Parse TTL dari Excel ke komponen { day, month, year }
   * Support format: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
   */
  parseTTL(ttlRaw) {
    if (!ttlRaw) return null;
    const s = String(ttlRaw).trim();

    // Format YYYY-MM-DD (ISO)
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { year: m[1], month: m[2], day: m[3] };

    // Format DD-MM-YYYY atau DD/MM/YYYY
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return { year: m[3], month: m[2].padStart(2, '0'), day: m[1].padStart(2, '0') };

    // Format Excel serial number (opsional — jarang dipakai)
    const num = parseFloat(s);
    if (!isNaN(num) && num > 1000) {
      const d = this._excelSerialToDate(num);
      return {
        year: String(d.getFullYear()),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        day: String(d.getDate()).padStart(2, '0')
      };
    }

    console.warn('[FieldMapper] Format TTL tidak dikenali:', s);
    return null;
  },

  /**
   * Normalisasi nomor WA: hilangkan 0 di depan, hilangkan +62
   */
  normalizeWA(raw) {
    let s = String(raw).replace(/\D/g, '');
    if (s.startsWith('62')) s = s.slice(2);
    if (s.startsWith('0')) s = s.slice(1);
    return s;
  },

  /**
   * Normalisasi NIK: pastikan 16 digit string
   */
  normalizeNIK(raw) {
    return String(raw).replace(/\D/g, '').padStart(16, '0').slice(-16);
  },

  /**
   * Normalisasi Diagnosa: split by koma/spasi → array
   * "DM, HT, Obesitas" → ["DM", "HT", "Obesitas"]
   */
  parseDiagnosa(raw) {
    if (!raw) return [];
    return String(raw).split(/[,;\/]+/).map(s => s.trim()).filter(Boolean);
  },

  // ── Private ─────────────────────────────────────────────────────────────

  _transform(col, value) {
    switch (col) {
      case 'No_WA':   return this.normalizeWA(value);
      case 'NIK':     return this.normalizeNIK(value);
      case 'BB':
      case 'TB':
      case 'GDS':
      case 'TD_Sistolik':
      case 'TD_Diastolik':
        // Pastikan angka, ganti koma ke titik
        return value.replace(',', '.');
      default:
        return value;
    }
  },

  _excelSerialToDate(serial) {
    // Excel epoch: 1 Jan 1900 = 1 (dengan bug leap year 1900)
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + serial);
    return d;
  },

  /**
   * Validasi row data pasien — return array error string (kosong = valid)
   */
  validate(pasienData) {
    const errors = [];
    const required = ['NIK', 'Nama', 'TTL', 'Jenis_Kelamin', 'No_WA'];

    for (const col of required) {
      if (!pasienData[col] || String(pasienData[col]).trim() === '') {
        errors.push(`Kolom wajib kosong: ${col}`);
      }
    }

    // NIK harus 16 digit
    const nik = String(pasienData['NIK'] || '').replace(/\D/g, '');
    if (nik.length !== 16) errors.push(`NIK tidak valid (harus 16 digit): ${pasienData['NIK']}`);

    // TTL harus bisa di-parse
    if (pasienData['TTL'] && !this.parseTTL(pasienData['TTL'])) {
      errors.push(`Format TTL tidak dikenali: ${pasienData['TTL']}`);
    }

    return errors;
  },

  /**
   * Resolve answer for a schema question using patient data.
   * Unlike resolve(), this returns an answer *label* (e.g. "Ya", "Tidak")
   * that matches one of the schema question's options.
   *
   * This is the bridge between patient data and schema-driven autofill:
   * patient data (Diagnosa, BB, etc.) → answer label → schema PPV lookup → DOM fill.
   *
   * @param {Object} schemaQuestion — one question entry from a schema
   * @param {Object} pasienData     — patient row
   * @param {Array}  rules          — quiz rules (from QuizEngine)
   * @returns {string|null}         — answer label or null to skip
   */
  resolveForSchema(schemaQuestion, pasienData, rules = []) {
    if (!schemaQuestion?.question) return null;

    // Use the QuizEngine to resolve the answer label for this question
    // QuizEngine.resolveAnswer works on question text → returns a label
    if (typeof QuizEngine !== 'undefined' && rules.length) {
      return QuizEngine.resolveAnswer(schemaQuestion.question, pasienData, rules);
    }

    // Fallback: simple Yes/No based on Diagnosa
    const diagnosa = String(pasienData.Diagnosa || '').toLowerCase();
    const q        = (schemaQuestion.question || '').toLowerCase();

    if (q.includes('merokok') || q.includes('rokok')) {
      return diagnosa.includes('rokok') ? 'Ya' : 'Tidak';
    }
    if (q.includes('diabetes') || q.includes('kencing manis')) {
      return diagnosa.includes('dm') || diagnosa.includes('diabetes') ? 'Ya' : 'Tidak';
    }
    if (q.includes('hipertensi') || q.includes('darah tinggi')) {
      return diagnosa.includes('ht') || diagnosa.includes('hipertensi') ? 'Ya' : 'Tidak';
    }

    return 'Tidak';
  },

};

if (typeof module !== 'undefined') {
  module.exports = { FieldMapper };
}


// ── Storage integration (Phase 6) ─────────────────────────────────────────────

FieldMapper.loadMapping = async function() {
  const res = await chrome.storage.local.get('ckg_field_mapping');
  return res.ckg_field_mapping || {};
};

FieldMapper.saveMapping = async function(mapping) {
  await chrome.storage.local.set({ ckg_field_mapping: mapping });
};

// ── ESM Export ────────────────────────────────────────────────────────────────
export { FieldMapper };
