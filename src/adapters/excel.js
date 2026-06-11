// adapters/excel.js - CKG Auto KlikPro v2.0
// Excel Adapter — Wraps existing XLSX parse logic into standardized patientData objects
// Reads .xlsx / .xls files and normalizes column names to DEFAULT_FIELD_MAPPING keys

'use strict';

/**
 * Normalize a patient row from an Excel sheet into the standard patientData object.
 * Handles flexible column naming (case-insensitive, underscore variants).
 *
 * @param {Object} rawRow   — raw row object from XLSX (keys = column headers)
 * @param {Object} [mapping] — optional custom column mapping { standardKey: excelColumnName }
 * @returns {Object} patientData
 */
export function normalizeExcelRow(rawRow, mapping = {}) {
  const DEFAULT_MAP = {
    NIK:            ['NIK', 'nik', 'Nik'],
    Nama:           ['Nama', 'nama', 'NAMA', 'Nama Lengkap'],
    TTL:            ['TTL', 'ttl', 'Tanggal_Lahir', 'Tanggal Lahir', 'TGL_LAHIR'],
    Jenis_Kelamin:  ['Jenis_Kelamin', 'jenis_kelamin', 'JK', 'Kelamin'],
    No_WA:          ['No_WA', 'no_wa', 'No WA', 'HP', 'Telepon', 'Phone'],
    Pekerjaan:      ['Pekerjaan', 'pekerjaan', 'PEKERJAAN'],
    Alamat:         ['Alamat', 'alamat', 'ALAMAT', 'Alamat Lengkap'],
    Provinsi:       ['Provinsi', 'provinsi', 'PROVINSI'],
    Kabupaten:      ['Kabupaten', 'kabupaten', 'KABUPATEN', 'Kota/Kabupaten'],
    Kecamatan:      ['Kecamatan', 'kecamatan', 'KECAMATAN'],
    Kelurahan:      ['Kelurahan', 'kelurahan', 'KELURAHAN', 'Desa/Kelurahan'],
    Status_Nikah:   ['Status_Nikah', 'Status Nikah', 'Status Pernikahan', 'Nikah'],
    BB:             ['BB', 'Berat_Badan', 'Berat Badan', 'BERAT'],
    TB:             ['TB', 'Tinggi_Badan', 'Tinggi Badan', 'TINGGI'],
    GDS:            ['GDS', 'Gula_Darah', 'Gula Darah Sewaktu'],
    TD_Sistolik:    ['TD_Sistolik', 'Sistolik', 'TD Sistolik', 'SBP'],
    TD_Diastolik:   ['TD_Diastolik', 'Diastolik', 'TD Diastolik', 'DBP'],
    Diagnosa:       ['Diagnosa', 'diagnosa', 'DIAGNOSA', 'Diagnosis', 'Penyakit'],
    Tanggal_Periksa:['Tanggal_Periksa', 'Tanggal Periksa', 'Tgl Periksa', 'TGL_PERIKSA'],
    No_Antrian:     ['No_Antrian', 'No Antrian', 'Antrian', 'Queue'],
  };

  const result = {};

  for (const [stdKey, candidates] of Object.entries(DEFAULT_MAP)) {
    // Honor custom mapping first
    const customCol = mapping[stdKey];
    if (customCol && rawRow[customCol] !== undefined) {
      result[stdKey] = String(rawRow[customCol]).trim();
      continue;
    }

    // Try each candidate column name
    for (const col of candidates) {
      if (rawRow[col] !== undefined && rawRow[col] !== null && rawRow[col] !== '') {
        result[stdKey] = String(rawRow[col]).trim();
        break;
      }
    }
  }

  return result;
}

/**
 * Load an Excel file and return array of normalized patientData objects.
 * Requires XLSX (SheetJS) to already be loaded globally as window.XLSX.
 *
 * @param {File|ArrayBuffer} source  — File object from <input> or ArrayBuffer
 * @param {Object} [mapping]          — custom column mapping
 * @returns {Promise<Object[]>} array of patientData objects
 */
export async function loadFromExcel(source, mapping = {}) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('XLSX library tidak tersedia. Pastikan xlsx.min.js sudah dimuat.');

  let data;
  if (source instanceof ArrayBuffer) {
    data = source;
  } else if (source instanceof File) {
    data = await source.arrayBuffer();
  } else {
    throw new Error('Excel Adapter: source harus berupa File atau ArrayBuffer');
  }

  const workbook  = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .map(row => normalizeExcelRow(row, mapping))
    .filter(row => row.NIK); // skip rows without NIK
}

/**
 * Validate a patientData object — return array of error messages.
 * @param {Object} patientData
 * @returns {string[]}
 */
export function validatePatient(patientData) {
  const errors = [];
  const required = ['NIK', 'Nama', 'TTL', 'Jenis_Kelamin', 'No_WA'];

  for (const col of required) {
    if (!patientData[col] || patientData[col].trim() === '') {
      errors.push(`Kolom wajib kosong: ${col}`);
    }
  }

  const nik = (patientData.NIK || '').replace(/\D/g, '');
  if (nik.length !== 16) {
    errors.push(`NIK tidak valid (harus 16 digit): ${patientData.NIK}`);
  }

  return errors;
}
