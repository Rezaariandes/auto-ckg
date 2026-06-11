// adapters/rme.js - CKG Auto KlikPro v2.0
// RME (Rekam Medik Elektronik) Adapter
// Parses patient data from clipboard-pasted RME text or structured RME JSON exports

'use strict';

/**
 * Parse a plain-text RME excerpt into patientData.
 * Handles common format:
 *   Nama  : Budi Santoso
 *   NIK   : 3201234567890001
 *   TTL   : Jakarta, 10/05/1985
 *   ...
 *
 * @param {string} text — raw RME text (clipboard paste)
 * @returns {Object} patientData
 */
export function parseRMEText(text) {
  if (!text) return {};

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const data  = {};

  const FIELD_PATTERNS = [
    { key: 'Nama',          patterns: ['nama', 'name'] },
    { key: 'NIK',           patterns: ['nik', 'no nik', 'nomor nik', 'ktp'] },
    { key: 'TTL',           patterns: ['ttl', 'tgl lahir', 'tanggal lahir', 'tgl. lahir', 'lahir'] },
    { key: 'Jenis_Kelamin', patterns: ['jenis kelamin', 'jk', 'kelamin', 'sex', 'gender'] },
    { key: 'No_WA',         patterns: ['no wa', 'no. wa', 'no hp', 'hp', 'telp', 'telepon', 'phone'] },
    { key: 'Pekerjaan',     patterns: ['pekerjaan', 'pkrj', 'kerja', 'job'] },
    { key: 'Alamat',        patterns: ['alamat', 'address', 'domisili'] },
    { key: 'Provinsi',      patterns: ['provinsi', 'prov'] },
    { key: 'Kabupaten',     patterns: ['kabupaten', 'kota', 'kab'] },
    { key: 'Kecamatan',     patterns: ['kecamatan', 'kec'] },
    { key: 'Kelurahan',     patterns: ['kelurahan', 'kel', 'desa'] },
    { key: 'Diagnosa',      patterns: ['diagnosa', 'diagnosis', 'penyakit', 'dx'] },
    { key: 'BB',            patterns: ['bb', 'berat badan', 'berat'] },
    { key: 'TB',            patterns: ['tb', 'tinggi badan', 'tinggi'] },
    { key: 'TD_Sistolik',   patterns: ['sistolik', 'sistole', 'sbp', 'td s'] },
    { key: 'TD_Diastolik',  patterns: ['diastolik', 'diastole', 'dbp', 'td d'] },
    { key: 'GDS',           patterns: ['gds', 'gula darah', 'glukosa'] },
  ];

  for (const line of lines) {
    const sepIdx = line.indexOf(':');
    if (sepIdx < 0) continue;

    const rawKey = line.slice(0, sepIdx).trim().toLowerCase();
    const value  = line.slice(sepIdx + 1).trim();

    for (const { key, patterns } of FIELD_PATTERNS) {
      if (patterns.some(p => rawKey.includes(p))) {
        if (!data[key]) data[key] = value; // first match wins
      }
    }
  }

  // Normalize NIK
  if (data.NIK) data.NIK = data.NIK.replace(/\D/g, '').slice(-16);

  // Normalize WA
  if (data.No_WA) {
    let wa = data.No_WA.replace(/\D/g, '');
    if (wa.startsWith('62')) wa = wa.slice(2);
    if (wa.startsWith('0'))  wa = wa.slice(1);
    data.No_WA = wa;
  }

  return data;
}

/**
 * Parse a structured RME JSON object (from EMR API exports).
 * Handles FHIR-like or local RME JSON formats.
 *
 * @param {Object|string} json — JSON object or string
 * @returns {Object} patientData
 */
export function parseRMEJson(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;

  // Standard local RME format
  if (obj.nik || obj.NIK) {
    return {
      NIK:            String(obj.nik || obj.NIK || '').replace(/\D/g, ''),
      Nama:           obj.nama       || obj.name        || obj.patient_name || '',
      TTL:            obj.ttl        || obj.birth_date   || obj.tanggal_lahir || '',
      Jenis_Kelamin:  obj.jk         || obj.gender       || obj.jenis_kelamin || '',
      No_WA:          obj.no_wa      || obj.hp           || obj.phone || '',
      Pekerjaan:      obj.pekerjaan  || obj.occupation   || '',
      Alamat:         obj.alamat     || obj.address      || '',
      Provinsi:       obj.provinsi   || obj.province     || '',
      Kabupaten:      obj.kabupaten  || obj.city         || '',
      Kecamatan:      obj.kecamatan  || obj.district     || '',
      Kelurahan:      obj.kelurahan  || obj.village      || '',
      Diagnosa:       obj.diagnosa   || obj.diagnosis    || obj.dx || '',
      BB:             String(obj.bb  || obj.weight       || ''),
      TB:             String(obj.tb  || obj.height       || ''),
      GDS:            String(obj.gds || obj.blood_glucose|| ''),
      TD_Sistolik:    String(obj.td_sistolik || obj.sbp  || ''),
      TD_Diastolik:   String(obj.td_diastolik|| obj.dbp  || ''),
      Tanggal_Periksa:obj.tanggal_periksa || obj.visit_date || '',
      No_Antrian:     String(obj.no_antrian || obj.queue_number || ''),
    };
  }

  // FHIR Patient resource
  if (obj.resourceType === 'Patient') {
    const name = obj.name?.[0];
    const addr = obj.address?.[0];
    return {
      NIK:           (obj.identifier?.find(i => i.system?.includes('nik'))?.value || '').replace(/\D/g, ''),
      Nama:          [name?.family, ...(name?.given || [])].filter(Boolean).join(' '),
      TTL:           obj.birthDate || '',
      Jenis_Kelamin: obj.gender === 'male' ? 'Laki-laki' : obj.gender === 'female' ? 'Perempuan' : '',
      No_WA:         obj.telecom?.find(t => t.system === 'phone')?.value || '',
      Alamat:        addr?.text || addr?.line?.join(', ') || '',
      Provinsi:      addr?.state || '',
      Kabupaten:     addr?.district || '',
      Kecamatan:     '',
      Kelurahan:     addr?.city || '',
    };
  }

  return {};
}
