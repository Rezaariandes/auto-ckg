// selesai.js - CKG Auto KlikPro v1.0
// Modul: Selesaikan Layanan → Konfirmasi akhir

import { runStepsForPasien } from '../engine/recovery.js';

/**
 * Jalankan workflow selesai untuk satu pasien.
 * Modul ini menutup sesi layanan — kritis, tapi tidak ada data Excel spesifik.
 */
export async function runSelesai(pasienData, template, settings, ctx = {}) {
  const { onLog = () => {}, checkStop = () => false, queueIndex = 0, tabId } = ctx;

  return runStepsForPasien(template.steps, pasienData, {
    workflow: 'selesai',
    queueIndex,
    settings,
    onLog,
    checkStop,
    tabId,
  });
}
