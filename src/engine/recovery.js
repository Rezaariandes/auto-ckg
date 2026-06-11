// recovery.js - CKG Auto KlikPro v1.0
// Retry wrapper + checkpoint save ke chrome.storage.session
// PENTING: file ini jalan di SERVICE WORKER — tidak boleh akses DOM sama sekali.
// Step 'navigate' ditangani SW via chrome.tabs.update.
// Step lain dikirim ke content script via chrome.tabs.sendMessage.

const NS = 'ckg_session_';

// ── Checkpoint API ──────────────────────────────────────────────────────────

export async function saveCheckpoint(state) {
  await chrome.storage.session.set({
    [NS + 'checkpoint']: { ...state, savedAt: Date.now() }
  });
}

export async function loadCheckpoint() {
  const res = await chrome.storage.session.get(NS + 'checkpoint');
  return res[NS + 'checkpoint'] || null;
}

export async function clearCheckpoint() {
  await chrome.storage.session.remove(NS + 'checkpoint');
}

// ── Navigate: SW-side via chrome.tabs ──────────────────────────────────────

async function doNavigateSW(tabId, step, settings) {
  const url = step.value;
  if (!url) return { success: false, message: 'navigate: value (URL) kosong' };

  let tab = null;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return { success: false, message: `navigate: tab ${tabId} tidak ditemukan` };
  }

  const normalizedTarget  = url.replace(/\/$/, '');
  const normalizedCurrent = (tab.url || '').replace(/\/$/, '');
  if (normalizedCurrent === normalizedTarget) {
    return { success: true, message: `navigate: already at ${url}` };
  }

  await chrome.tabs.update(tabId, { url });

  const timeout = settings?.navigateTimeoutMs ?? 10000;
  await waitForTabReady(tabId, timeout);

  // Re-inject executor setelah navigasi — reset flag agar versi baru dipakai
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/engine/executor_inject.js'] });
  } catch (_) {}

  await sleep(300);

  return { success: true, message: `navigate: OK → ${url}` };
}

function waitForTabReady(tabId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
  });
}

// ── Step via content script ─────────────────────────────────────────────────

async function execStepInTab(tabId, step, pasienData, settings) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: 'ckg_exec_step', step, pasienData, settings },
      (result) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, message: chrome.runtime.lastError.message });
        } else {
          resolve(result || { success: false, message: 'no response from content script' });
        }
      }
    );
  });
}

// ── Step Runner dengan Retry ────────────────────────────────────────────────

export async function runStepWithRetry(step, pasienData, settings, onLog = () => {}, tabId) {
  const maxRetry   = step.recovery?.maxRetry ?? settings.retryMax ?? 3;
  const retryDelay = step.recovery?.waitMs   ?? settings.retryDelayMs ?? 1500;

  let lastResult = null;
  let attempt    = 0;

  while (attempt <= maxRetry) {
    if (attempt > 0) {
      onLog('warn', `[RETRY ${attempt}/${maxRetry}] ${step.label}`);
      await sleep(retryDelay);
    }

    if (step.type === 'navigate') {
      lastResult = await doNavigateSW(tabId, step, settings);
    } else {
      lastResult = await execStepInTab(tabId, step, pasienData, settings);
    }

    if (lastResult.success) {
      if (attempt > 0) onLog('info', `[RECOVERED] ${step.label}`);
      return { ...lastResult, retries: attempt };
    }

    onLog('warn', `[FAIL] ${step.label}: ${lastResult.message}`);
    attempt++;
  }

  onLog('error', `[GIVE UP] ${step.label} — ${lastResult?.message}`);
  return { success: false, message: lastResult?.message || 'unknown error', retries: maxRetry };
}

// ── Queue Runner ────────────────────────────────────────────────────────────

export async function runStepsForPasien(steps, pasienData, context) {
  const {
    workflow,
    queueIndex,
    settings,
    onLog      = () => {},
    checkStop  = () => false,
    tabId,
  } = context;

  let stepsOk   = 0;
  let stepsFail = 0;

  for (let i = 0; i < steps.length; i++) {
    if (checkStop()) {
      onLog('warn', '[STOP] Run dihentikan oleh user');
      return { success: false, stepsOk, stepsFail, stopped: true };
    }

    const step = steps[i];

    await saveCheckpoint({ workflow, queueIndex, stepIndex: i, pasienData });
    onLog('info', `[STEP ${i + 1}/${steps.length}] ${step.label}`);

    const result = await runStepWithRetry(step, pasienData, settings, onLog, tabId);

    if (result.success) {
      stepsOk++;
    } else {
      stepsFail++;
      if (isCriticalStep(step, i)) {
        onLog('error', `[SKIP PASIEN] Step kritis gagal: ${step.label}`);
        return { success: false, stepsOk, stepsFail, skipReason: step.label };
      }
    }
  }

  await clearCheckpoint();
  return { success: stepsFail === 0, stepsOk, stepsFail };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isCriticalStep(step, index) {
  // Hanya navigate yang benar-benar kritis (tab mungkin salah halaman)
  // wait_button, click_button, dll — gagal boleh lanjut ke step berikutnya
  return step.type === 'navigate';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
