// adapters/manual.js - CKG Auto KlikPro v2.0
// Manual Adapter — Build a patientData object from individual form inputs
// Used when healthcare worker enters data directly in the popup form

'use strict';

/**
 * Build a standardized patientData object from individual field values.
 * All fields are optional — only provided fields will be set.
 *
 * @param {Object} fields — key/value map of patient fields
 * @returns {Object} patientData
 */
export function buildManualPatient(fields = {}) {
  return {
    NIK:             String(fields.NIK             || '').replace(/\D/g, ''),
    Nama:            String(fields.Nama            || '').trim(),
    TTL:             String(fields.TTL             || '').trim(),
    Jenis_Kelamin:   String(fields.Jenis_Kelamin   || '').trim(),
    No_WA:           normalizeWA(fields.No_WA      || ''),
    Pekerjaan:       String(fields.Pekerjaan       || '').trim(),
    Alamat:          String(fields.Alamat          || '').trim(),
    Provinsi:        String(fields.Provinsi        || '').trim(),
    Kabupaten:       String(fields.Kabupaten       || '').trim(),
    Kecamatan:       String(fields.Kecamatan       || '').trim(),
    Kelurahan:       String(fields.Kelurahan       || '').trim(),
    Status_Nikah:    String(fields.Status_Nikah    || '').trim(),
    BB:              String(fields.BB              || '').trim(),
    TB:              String(fields.TB              || '').trim(),
    GDS:             String(fields.GDS             || '').trim(),
    TD_Sistolik:     String(fields.TD_Sistolik     || '').trim(),
    TD_Diastolik:    String(fields.TD_Diastolik    || '').trim(),
    Diagnosa:        String(fields.Diagnosa        || '').trim(),
    Tanggal_Periksa: String(fields.Tanggal_Periksa || '').trim(),
    No_Antrian:      String(fields.No_Antrian      || '').trim(),
  };
}

/**
 * Validate a manually-entered patientData object.
 * @param {Object} patientData
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManualPatient(patientData) {
  const errors = [];
  const required = ['NIK', 'Nama', 'TTL', 'Jenis_Kelamin', 'No_WA'];

  for (const col of required) {
    if (!patientData[col] || patientData[col].trim() === '') {
      errors.push(`Field wajib kosong: ${col}`);
    }
  }

  const nik = (patientData.NIK || '').replace(/\D/g, '');
  if (nik && nik.length !== 16) {
    errors.push(`NIK harus 16 digit (${nik.length} digit dimasukkan)`);
  }

  return { valid: errors.length === 0, errors };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeWA(raw) {
  let s = String(raw).replace(/\D/g, '');
  if (s.startsWith('62')) s = s.slice(2);
  if (s.startsWith('0'))  s = s.slice(1);
  return s;
}
