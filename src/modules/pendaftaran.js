// pendaftaran.js - CKG Auto KlikPro v1.0
// Modul: Daftar Baru → isi form → Submit
// Fungsi utama: run(pasienData, template, settings, ctx)

import { runStepsForPasien } from '../engine/recovery.js';

/**
 * Jalankan workflow pendaftaran untuk satu pasien.
 *
 * @param {Object} pasienData  - row Excel (NIK, Nama, TTL, dll)
 * @param {Object} template    - { meta, steps } dari storage
 * @param {Object} settings    - settings global
 * @param {Object} ctx         - { onLog, checkStop, queueIndex }
 */
export async function runPendaftaran(pasienData, template, settings, ctx = {}) {
  const { onLog = () => {}, checkStop = () => false, queueIndex = 0, tabId } = ctx;

  // Validasi kolom wajib
  const required = ['NIK', 'Nama', 'TTL', 'Jenis_Kelamin', 'Tanggal_Periksa', 'No_Antrian'];
  for (const col of required) {
    if (!pasienData[col]) {
      onLog('warn', `[pendaftaran] kolom "${col}" kosong — skip pasien`);
      return { success: false, stepsFail: 0, stepsOk: 0, skipReason: `kolom ${col} kosong` };
    }
  }

  // Normalisasi data sebelum run
  const data = normalizePasienData(pasienData);

  return runStepsForPasien(template.steps, data, {
    workflow: 'pendaftaran',
    queueIndex,
    settings,
    onLog,
    checkStop,
    tabId,
  });
}

/**
 * Normalisasi & derivasi kolom sebelum dikirim ke executor.
 * - Format TTL: pastikan YYYY-MM-DD
 * - Jenis_Kelamin: normalize ke "Laki-laki" / "Perempuan"
 * - Status_Nikah: normalize
 */
function normalizePasienData(raw) {
  const d = { ...raw };

  // TTL: support "10-10-1990" → "1990-10-10"
  if (d.TTL && !d.TTL.match(/^\d{4}-/)) {
    const parts = String(d.TTL).split(/[-/.]/);
    if (parts.length === 3) {
      // Deteksi: jika part[2] berupa tahun 4 digit → dd-mm-yyyy
      if (parts[2].length === 4) {
        d.TTL = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
  }

  // Jenis kelamin: L → Laki-laki, P → Perempuan
  const jkMap = {
    'l': 'Laki-laki', 'laki': 'Laki-laki', 'laki-laki': 'Laki-laki',
    'p': 'Perempuan', 'perempuan': 'Perempuan', 'wanita': 'Perempuan',
  };
  const jkRaw = String(d.Jenis_Kelamin || '').toLowerCase().trim();
  d.Jenis_Kelamin = jkMap[jkRaw] ?? d.Jenis_Kelamin;

  // Status nikah
  const nikahMap = {
    'menikah': 'Menikah', 'kawin': 'Menikah',
    'belum menikah': 'Belum Menikah', 'belum kawin': 'Belum Menikah',
    'cerai': 'Cerai', 'duda': 'Cerai', 'janda': 'Cerai',
  };
  const nikahRaw = String(d.Status_Nikah || '').toLowerCase().trim();
  d.Status_Nikah = nikahMap[nikahRaw] ?? d.Status_Nikah;

  // NIK: pastikan string (Excel bisa parse as number)
  d.NIK = String(d.NIK || '').trim();
  d.No_WA = String(d.No_WA || '').trim();
  d.No_Antrian = parseInt(d.No_Antrian) || 1;

  return d;
}
