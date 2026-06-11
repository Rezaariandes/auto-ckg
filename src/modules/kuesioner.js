// kuesioner.js - CKG Auto KlikPro v1.0
// Modul: Isi kuesioner — integrasikan quiz_rules logic ke step execution

import { runStepsForPasien } from '../engine/recovery.js';
import { resolveQuizAnswers } from '../logic/quiz_rules.js';

/**
 * Jalankan workflow kuesioner untuk satu pasien.
 *
 * Alur:
 * 1. Load rules dari storage
 * 2. Resolve jawaban berdasarkan data pasien (Diagnosa, dll)
 * 3. Inject jawaban ke step-step quiz_answer
 * 4. Jalankan steps
 */
export async function runKuesioner(pasienData, template, settings, ctx = {}) {
  const { onLog = () => {}, checkStop = () => false, queueIndex = 0, tabId } = ctx;

  if (!pasienData.NIK) {
    onLog('warn', '[kuesioner] NIK kosong — skip');
    return { success: false, stepsOk: 0, stepsFail: 0, skipReason: 'NIK kosong' };
  }

  // Resolve jawaban dari quiz rules
  let resolvedAnswers = {};
  try {
    resolvedAnswers = await resolveQuizAnswers(pasienData);
    const count = Object.keys(resolvedAnswers).length;
    if (count > 0) {
      onLog('info', `[kuesioner] ${count} jawaban di-override dari quiz rules`);
    }
  } catch (err) {
    onLog('warn', `[kuesioner] quiz rules error: ${err.message} — pakai default template`);
  }

  // Inject jawaban ke step quiz_answer
  const steps = injectAnswers(template.steps, resolvedAnswers);

  return runStepsForPasien(steps, pasienData, {
    workflow: 'kuesioner',
    queueIndex,
    settings,
    onLog,
    checkStop,
    tabId,
  });
}

/**
 * Override nilai step quiz_answer berdasarkan resolvedAnswers.
 * resolvedAnswers: { [titleContains_lower]: answer }
 *
 * @param {Object[]} steps
 * @param {Object} answers
 * @returns {Object[]} cloned steps dengan value yang diperbarui
 */
function injectAnswers(steps, answers) {
  if (!Object.keys(answers).length) return steps;

  return steps.map(step => {
    if (step.type !== 'quiz_answer') return step;

    const key = (step.questionTitle || step.selector || '').toLowerCase().trim();

    // Cek apakah ada jawaban override untuk pertanyaan ini
    for (const [titlePart, answer] of Object.entries(answers)) {
      if (key.includes(titlePart.toLowerCase())) {
        return { ...step, value: answer };
      }
    }
    return step;
  });
}
