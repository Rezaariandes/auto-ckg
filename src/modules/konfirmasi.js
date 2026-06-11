// konfirmasi.js - CKG Auto KlikPro v1.0
// Modul: Konfirmasi Kehadiran pasien

import { runStepsForPasien } from '../engine/recovery.js';

/**
 * Jalankan workflow konfirmasi untuk satu pasien.
 * Konfirmasi biasanya terjadi setelah pasien terdaftar di antrian.
 */
export async function runKonfirmasi(pasienData, template, settings, ctx = {}) {
  const { onLog = () => {}, checkStop = () => false, queueIndex = 0, tabId } = ctx;

  // Konfirmasi minimal butuh NIK atau Nama
  if (!pasienData.NIK && !pasienData.Nama) {
    onLog('warn', '[konfirmasi] NIK dan Nama kosong — skip');
    return { success: false, stepsOk: 0, stepsFail: 0, skipReason: 'NIK/Nama kosong' };
  }

  const data = { ...pasienData, NIK: String(pasienData.NIK || '').trim() };

  return runStepsForPasien(template.steps, data, {
    workflow: 'konfirmasi',
    queueIndex,
    settings,
    onLog,
    checkStop,
    tabId,
  });
}
