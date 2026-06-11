// scheduler.js - CKG Auto KlikPro v1.0
// Queue manager: iterasi Excel rows → jalankan semua modul aktif per pasien
// Dipanggil dari background.js sebagai pengganti runLoop() inline

import { runPendaftaran } from '../modules/pendaftaran.js';
import { runKonfirmasi }  from '../modules/konfirmasi.js';
import { runKuesioner }   from '../modules/kuesioner.js';
import { runPemeriksaan } from '../modules/pemeriksaan.js';
import { runSelesai }     from '../modules/selesai.js';
import { saveCheckpoint, clearCheckpoint } from './recovery.js';

// Urutan workflow default (bisa dikustomisasi via Settings)
const WORKFLOW_ORDER = [
  { key: 'pendaftaran', fn: runPendaftaran },
  { key: 'konfirmasi',  fn: runKonfirmasi  },
  { key: 'kuesioner',   fn: runKuesioner   },
  { key: 'pemeriksaan', fn: runPemeriksaan },
  { key: 'selesai',     fn: runSelesai     },
];

/**
 * Jalankan semua pasien dalam queue.
 *
 * @param {Object[]} queue       - array row Excel (pasien)
 * @param {Object}   templates   - { pendaftaran, konfirmasi, ... } dari storage
 * @param {Object}   settings    - dari chrome.storage.local (ckg_settings)
 * @param {Object}   callbacks   - { onProgress, onLog, checkStop, checkPause }
 * @returns {Promise<{ok: number, fail: number}>}
 */
export async function runQueue(queue, templates, settings, callbacks = {}) {
  const {
    onProgress  = () => {},
    onLog       = () => {},
    checkStop   = () => false,
    checkPause  = () => false,
    startIndex  = 0,
    tabId,
  } = callbacks;

  const activeWorkflows = settings.activeWorkflows || {};
  const activeModules   = WORKFLOW_ORDER.filter(w => activeWorkflows[w.key] !== false);

  const summary = { ok: 0, fail: 0 };

  for (let idx = startIndex; idx < queue.length; idx++) {
    if (checkStop()) break;

    // Pause handling
    while (checkPause()) {
      await sleep(500);
      if (checkStop()) return summary;
    }

    const pasien = queue[idx];
    const nama   = pasien.Nama || `Pasien-${idx + 1}`;

    onProgress({ current: idx + 1, total: queue.length, pasien: nama, status: 'running' });
    onLog('info', `\n═══ [${idx + 1}/${queue.length}] ${nama} ═══`);

    let pasienOk = true;

    for (const mod of activeModules) {
      if (checkStop()) { pasienOk = false; break; }

      const template = templates[mod.key];
      if (!template || !template.steps?.length) {
        onLog('warn', `[SKIP] template "${mod.key}" tidak tersedia`);
        continue;
      }

      onLog('info', `  ▶ Modul: ${mod.key}`);

      try {
        const result = await mod.fn(pasien, template, settings, {
          onLog,
          checkStop,
          queueIndex: idx,
          tabId,
        });

        if (result.stopped) { pasienOk = false; break; }

        if (result.success) {
          onLog('info', `  ✓ ${mod.key} OK (${result.stepsOk} steps)`);
        } else {
          onLog('warn', `  ✗ ${mod.key} FAIL — ${result.skipReason || result.stepsFail + ' steps gagal'}`);
          // Jika modul pendaftaran gagal → skip modul berikutnya untuk pasien ini
          if (mod.key === 'pendaftaran') {
            onLog('error', `  [SKIP PASIEN] pendaftaran gagal → lewati modul lain`);
            pasienOk = false;
            break;
          }
        }
      } catch (err) {
        onLog('error', `  [ERROR] ${mod.key}: ${err.message}`);
        if (mod.key === 'pendaftaran') { pasienOk = false; break; }
      }
    }

    if (pasienOk) {
      summary.ok++;
      onProgress({ current: idx + 1, total: queue.length, pasien: nama, status: 'ok' });
    } else {
      summary.fail++;
      onProgress({ current: idx + 1, total: queue.length, pasien: nama, status: 'fail' });
    }

    await clearCheckpoint();

    // Jeda antar pasien
    if (!checkStop() && idx < queue.length - 1) {
      await sleep(settings.interPasienDelayMs ?? 1500);
    }
  }

  return summary;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
