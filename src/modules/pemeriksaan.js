// pemeriksaan.js - CKG Auto KlikPro v1.0
// Modul: Input data pemeriksaan fisik (BB, TB, GDS, TD)

import { runStepsForPasien } from '../engine/recovery.js';

/**
 * Jalankan workflow pemeriksaan untuk satu pasien.
 * Validasi: minimal salah satu kolom pemeriksaan harus ada.
 */
export async function runPemeriksaan(pasienData, template, settings, ctx = {}) {
  const { onLog = () => {}, checkStop = () => false, queueIndex = 0, tabId } = ctx;

  const pemeriksaanCols = ['BB', 'TB', 'GDS', 'TD_Sistolik', 'TD_Diastolik'];
  const hasAny = pemeriksaanCols.some(c => pasienData[c] !== undefined && pasienData[c] !== '');

  if (!hasAny) {
    onLog('warn', '[pemeriksaan] semua kolom pemeriksaan kosong — skip');
    return { success: true, stepsOk: 0, stepsFail: 0, skipReason: 'no data' };
  }

  // Normalisasi: angka sebagai string bersih, TD_Sistolik/TD_Diastolik sebagai integer
  const data = { ...pasienData };
  ['BB', 'TB', 'GDS', 'TD_Sistolik', 'TD_Diastolik'].forEach(col => {
    if (data[col] !== undefined) data[col] = String(parseFloat(data[col]) || data[col]).trim();
  });

  // Derivasi: hitung IMT jika BB dan TB tersedia (untuk log saja)
  if (data.BB && data.TB) {
    const bmi = (parseFloat(data.BB) / Math.pow(parseFloat(data.TB) / 100, 2)).toFixed(1);
    onLog('info', `[pemeriksaan] IMT kalkulasi: ${bmi} (BB=${data.BB} TB=${data.TB})`);
  }

  return runStepsForPasien(template.steps, data, {
    workflow: 'pemeriksaan',
    queueIndex,
    settings,
    onLog,
    checkStop,
    tabId,
  });
}
