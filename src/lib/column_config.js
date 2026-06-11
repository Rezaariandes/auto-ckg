// src/lib/column_config.js — CKG Auto KlikPro v2.0
// Helper module: manajemen konfigurasi kolom Excel
// Persistent storage di chrome.storage.local key 'ckg_column_config'

'use strict';

// ── Kolom standar CKG default ─────────────────────────────────────────────────
export const DEFAULT_COLUMNS = [
  { key: 'NIK',             label: 'NIK',                  required: true,  active: true  },
  { key: 'Nama',            label: 'Nama',                 required: true,  active: true  },
  { key: 'TTL',             label: 'TTL',                  required: true,  active: true  },
  { key: 'Jenis_Kelamin',   label: 'Jenis_Kelamin',        required: true,  active: true  },
  { key: 'No_WA',           label: 'No_WA',                required: true,  active: true  },
  { key: 'Pekerjaan',       label: 'Pekerjaan',            required: false, active: true  },
  { key: 'Alamat',          label: 'Alamat',               required: false, active: true  },
  { key: 'Provinsi',        label: 'Provinsi',             required: false, active: true  },
  { key: 'Kabupaten',       label: 'Kabupaten',            required: false, active: true  },
  { key: 'Kecamatan',       label: 'Kecamatan',            required: false, active: true  },
  { key: 'Kelurahan',       label: 'Kelurahan',            required: false, active: true  },
  { key: 'Status_Nikah',    label: 'Status_Nikah',         required: false, active: true  },
  { key: 'BB',              label: 'BB',                   required: false, active: true  },
  { key: 'TB',              label: 'TB',                   required: false, active: true  },
  { key: 'GDS',             label: 'GDS',                  required: false, active: true  },
  { key: 'TD_Sistolik',     label: 'TD_Sistolik',          required: false, active: true  },
  { key: 'TD_Diastolik',    label: 'TD_Diastolik',         required: false, active: true  },
  { key: 'Diagnosa',        label: 'Diagnosa',             required: false, active: true  },
  { key: 'Tanggal_Periksa', label: 'Tanggal_Periksa',      required: false, active: true  },
  { key: 'No_Antrian',      label: 'No_Antrian',           required: false, active: true  },
];

const STORAGE_KEY = 'ckg_column_config';

// ── Data contoh default ───────────────────────────────────────────────────────
export const DEFAULT_SAMPLE_ROWS = [
  {
    NIK: '3578021504880001', Nama: 'Budi Santoso', TTL: '15/04/1988',
    Jenis_Kelamin: 'Laki-laki', No_WA: '08123456789', Pekerjaan: 'Wiraswasta',
    Alamat: 'Jl. Kenanga No. 14', Provinsi: 'Jawa Timur', Kabupaten: 'Kota Surabaya',
    Kecamatan: 'Wonokromo', Kelurahan: 'Jagir', Status_Nikah: 'Menikah',
    BB: '72', TB: '168', GDS: '95', TD_Sistolik: '120', TD_Diastolik: '80',
    Diagnosa: 'Hipertensi', Tanggal_Periksa: '08/06/2026', No_Antrian: '1',
  },
  {
    NIK: '3578025506920002', Nama: 'Siti Rahayu', TTL: '15/06/1992',
    Jenis_Kelamin: 'Perempuan', No_WA: '08987654321', Pekerjaan: 'Ibu Rumah Tangga',
    Alamat: 'Jl. Melati No. 5', Provinsi: 'Jawa Timur', Kabupaten: 'Kota Surabaya',
    Kecamatan: 'Gubeng', Kelurahan: 'Mojo', Status_Nikah: 'Menikah',
    BB: '58', TB: '155', GDS: '200', TD_Sistolik: '140', TD_Diastolik: '90',
    Diagnosa: 'DM', Tanggal_Periksa: '08/06/2026', No_Antrian: '2',
  },
];

// ── Load konfigurasi ──────────────────────────────────────────────────────────
/**
 * Load config dari storage. Merge dengan DEFAULT_COLUMNS jika kolom baru ada.
 * @returns {Promise<{columns: Array, customColumns: Array, sampleRows: Array}>}
 */
export async function loadColumnConfig() {
  const res = await new Promise(r => chrome.storage.local.get(STORAGE_KEY, r));
  const saved = res[STORAGE_KEY];
  if (!saved) return getDefaultConfig();

  // Merge — pastikan kolom standar baru yang belum ada di config lama ikut masuk
  const savedKeys = new Set((saved.columns || []).map(c => c.key));
  const missingDefaults = DEFAULT_COLUMNS
    .filter(d => !savedKeys.has(d.key))
    .map(d => ({ ...d }));

  return {
    columns:       [...(saved.columns || []), ...missingDefaults],
    customColumns: saved.customColumns || [],
    sampleRows:    saved.sampleRows    || [...DEFAULT_SAMPLE_ROWS],
  };
}

/**
 * Simpan konfigurasi ke storage.
 */
export async function saveColumnConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

/**
 * Reset ke konfigurasi default.
 */
export async function resetColumnConfig() {
  await chrome.storage.local.remove(STORAGE_KEY);
  return getDefaultConfig();
}

function getDefaultConfig() {
  return {
    columns:       DEFAULT_COLUMNS.map(c => ({ ...c })),
    customColumns: [],
    sampleRows:    [...DEFAULT_SAMPLE_ROWS],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Ambil semua kolom aktif (standar + custom), gabungan, yang active=true.
 * Kembalikan dalam urutan sesuai config.
 * @param {Object} config
 * @returns {Array<{key, label, required, active}>}
 */
export function getActiveColumns(config) {
  const all = [
    ...(config.columns || []),
    ...(config.customColumns || []),
  ];
  return all.filter(c => c.active !== false);
}

/**
 * Kembalikan list key-label untuk dropdown Excel Column di quiz modal.
 * Termasuk kolom standar aktif + custom kolom.
 * @param {Object} config
 * @returns {Array<{value, label}>}
 */
export function getExcelColumnOptions(config) {
  return getActiveColumns(config).map(c => ({
    value: c.key,
    label: c.label !== c.key ? `${c.label} (${c.key})` : c.key,
  }));
}

/**
 * Build mapping object { standardKey → aliasName } untuk normalizeExcelRow.
 * Digunakan oleh excel.js agar bisa membaca alias kolom dari file Excel user.
 * @param {Object} config
 * @returns {Object}
 */
export function buildAliasMapping(config) {
  const mapping = {};
  const all = [
    ...(config.columns || []),
    ...(config.customColumns || []),
  ];
  for (const col of all) {
    // Jika label berbeda dari key, berarti user telah mengubah nama alias
    if (col.label && col.label !== col.key) {
      mapping[col.key] = col.label;
    }
  }
  return mapping;
}

// ── Auto-generate column key dari teks pertanyaan ────────────────────────────

const QUESTION_KEY_RULES = [
  // Demografi
  [/jenis.?kelamin|gender|laki.?laki|perempuan/i,    'Jenis_Kelamin'],
  [/status.?perkaw|menikah|nikah|pernikahan/i,        'Status_Nikah'],
  [/pendidikan|sekolah|ijazah/i,                      'Pendidikan'],
  [/pekerjaan|profesi|bekerja/i,                      'Pekerjaan'],
  [/agama|religi/i,                                   'Agama'],
  [/usia|umur\b/i,                                    'Usia'],
  // Gaya hidup
  [/merokok|rokok|nikotin/i,                          'Merokok'],
  [/batang.?rokok|sehari.+rokok|rokok.+sehari/i,      'Jml_Rokok_Hari'],
  [/alkohol|minum.?keras|minuman.?keras/i,            'Konsumsi_Alkohol'],
  [/aktivitas.?fisik|olahraga|bergerak/i,             'Aktivitas_Fisik'],
  [/frekuensi.+olahraga|olahraga.+seminggu/i,        'Frekuensi_Olahraga'],
  [/makan.?sayur|konsumsi.?sayur/i,                   'Konsumsi_Sayur'],
  [/makan.?buah|konsumsi.?buah/i,                     'Konsumsi_Buah'],
  [/berlemak|goreng|junk.?food|fast.?food/i,          'Konsumsi_Lemak'],
  [/garam|asin/i,                                     'Konsumsi_Garam'],
  [/manis|gula\b/i,                                   'Konsumsi_Gula'],
  // Riwayat penyakit
  [/diabetes|kencing.?manis|dm\b/i,                   'Riwayat_DM'],
  [/hipertensi|tekanan.?darah.+tinggi/i,              'Riwayat_Hipertensi'],
  [/stroke/i,                                         'Riwayat_Stroke'],
  [/jantung/i,                                        'Riwayat_Jantung'],
  [/kanker|tumor/i,                                   'Riwayat_Kanker'],
  [/asma|sesak.?napas/i,                              'Riwayat_Asma'],
  [/ginjal/i,                                         'Riwayat_Ginjal'],
  [/tbc|tuberkulosis/i,                               'Riwayat_TBC'],
  [/kolesterol/i,                                     'Kolesterol'],
  // Reproduksi / Kanker
  [/hubung.?intim|seksual|berhubungan/i,              'Hub_Seksual'],
  [/haid|menstruasi|mens/i,                           'Status_Haid'],
  [/menopause/i,                                      'Menopause'],
  [/hamil|kehamilan/i,                                'Kehamilan'],
  [/kb\b|kontrasepsi/i,                               'Kontrasepsi'],
  [/pap.?smear|iva/i,                                 'Riwayat_Pap_Smear'],
  // Mental
  [/stress|stres|tekanan.?mental/i,                   'Stres'],
  [/tidur|insomnia/i,                                 'Kualitas_Tidur'],
  [/depresi/i,                                        'Depresi'],
  // Klinis
  [/berat.?badan|\bbb\b/i,                            'BB'],
  [/tinggi.?badan|\btb\b/i,                           'TB'],
  [/gula.?darah|glukosa|hba1c/i,                      'GDS'],
  [/sistolik|diastolik|tekanan.?darah/i,              'Tekanan_Darah'],
  [/nadi|denyut.?nadi/i,                              'Nadi'],
  [/saturasi|spo2|oksigen/i,                          'SpO2'],
  [/kolesterol/i,                                     'Kolesterol'],
  [/asam.?urat/i,                                     'Asam_Urat'],
];

/**
 * Generate column key dari teks pertanyaan.
 * Coba cocokkan ke QUESTION_KEY_RULES dulu, fallback ke singkatan schema + index.
 */
function questionToKey(questionText, schemaName, idx) {
  for (const [regex, key] of QUESTION_KEY_RULES) {
    if (regex.test(questionText)) return key;
  }
  // Fallback: singkatan huruf pertama setiap kata di schema name + nomor urut
  const abbr = schemaName
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 5);
  return `${abbr || 'Q'}_${idx + 1}`;
}

/**
 * Baca semua schema kuesioner (ckg_schema_*) dari storage,
 * ekstrak semua excelColumn (dan auto-generate untuk yang belum ada),
 * merge ke config. Kolom baru ditambahkan ke customColumns dengan
 * { fromSchema: true, active: false }.
 *
 * Juga write-back excelColumn ke schema jika pertanyaan belum punya mapping.
 *
 * @param {Object} config — config yang sudah di-load
 * @returns {Promise<{ config: Object, added: string[] }>}
 */
export async function syncColumnsFromSchemas(config) {
  // 1. Load semua schema
  const all = await new Promise(r => chrome.storage.local.get(null, r));
  const schemaKeys = Object.keys(all).filter(k => k.startsWith('ckg_schema_'));

  // 2. Kumpulkan semua kolom unik — baik yang sudah set maupun yang perlu di-generate
  const foundCols = new Map(); // key → { key, schemaName, isGenerated }
  const schemasToUpdate = {};  // schemas yang butuh write-back excelColumn

  for (const sk of schemaKeys) {
    const schema = all[sk];
    if (!schema?.questions?.length) continue;

    const schemaName = schema.displayName || schema.title || sk.replace('ckg_schema_', '');
    let schemaModified = false;

    schema.questions.forEach((q, idx) => {
      if (q.answerMode === 'skip') return;

      let colKey = q.excelColumn;
      let isGenerated = false;

      // Jika belum ada excelColumn → auto-generate dari teks pertanyaan
      if (!colKey) {
        colKey = questionToKey(q.question || '', schemaName, idx);
        isGenerated = true;
        // Write-back ke schema agar pertanyaan terhubung ke kolom ini
        q.excelColumn = colKey;
        schemaModified = true;
      }

      if (!foundCols.has(colKey)) {
        foundCols.set(colKey, { key: colKey, schemaName, isGenerated });
      }
    });

    if (schemaModified) {
      schemasToUpdate[sk] = schema;
    }
  }

  // 3. Write-back schema yang berubah (tanpa menunggu, fire & forget)
  if (Object.keys(schemasToUpdate).length) {
    chrome.storage.local.set(schemasToUpdate);
  }

  // 4. Cari kolom yang belum ada di config
  const existingKeys = new Set([
    ...(config.columns || []).map(c => c.key),
    ...(config.customColumns || []).map(c => c.key),
  ]);

  const added = [];
  for (const [key, info] of foundCols) {
    if (!existingKeys.has(key)) {
      config.customColumns = config.customColumns || [];
      config.customColumns.push({
        key,
        label:      key,
        active:     false,          // user yang tentukan mana yang aktif
        required:   false,
        fromSchema: true,
        schemaName: info.schemaName,
      });
      existingKeys.add(key);
      added.push(key);
    }
  }

  return { config, added };
}

/**
 * Hitung statistik penggunaan kolom dari semua schema.
 * Digunakan untuk menampilkan "dipakai di N kuesioner" di panel.
 * @returns {Promise<Map<string, string[]>>} key → [schemaName, ...]
 */
export async function getColumnUsageMap() {
  const all = await new Promise(r => chrome.storage.local.get(null, r));
  const schemaKeys = Object.keys(all).filter(k => k.startsWith('ckg_schema_'));
  const usage = new Map();
  for (const sk of schemaKeys) {
    const schema = all[sk];
    const name = schema?.displayName || schema?.title || sk.replace('ckg_schema_', '');
    for (const q of (schema?.questions || [])) {
      if (q.excelColumn) {
        if (!usage.has(q.excelColumn)) usage.set(q.excelColumn, []);
        if (!usage.get(q.excelColumn).includes(name)) {
          usage.get(q.excelColumn).push(name);
        }
      }
    }
  }
  return usage;
}
