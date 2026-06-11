// observer.js - CKG Auto KlikPro v1.0
// waitForElement via MutationObserver — no polling, no setTimeout loops

/**
 * Tunggu elemen muncul di DOM.
 * @param {string} selector - CSS selector
 * @param {number} timeoutMs - default 8000ms
 * @param {string|null} placeholder - teks inner untuk disambiguate elemen sejenis
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeoutMs = 8000, placeholder = null) {
  return new Promise((resolve, reject) => {
    // Cek langsung — mungkin sudah ada
    const found = findElement(selector, placeholder);
    if (found) return resolve(found);

    const deadline = Date.now() + timeoutMs;

    const observer = new MutationObserver(() => {
      const el = findElement(selector, placeholder);
      if (el) {
        observer.disconnect();
        resolve(el);
      } else if (Date.now() >= deadline) {
        observer.disconnect();
        reject(new Error(`waitForElement timeout: "${selector}"${placeholder ? ` [placeholder="${placeholder}"]` : ''}`));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false
    });

    // Safety timeout — observer bisa kelewat mutasi terakhir
    setTimeout(() => {
      observer.disconnect();
      const el = findElement(selector, placeholder);
      if (el) resolve(el);
      else reject(new Error(`waitForElement timeout: "${selector}"${placeholder ? ` [placeholder="${placeholder}"]` : ''}`));
    }, timeoutMs);
  });
}

/**
 * Cari elemen, opsional filter by innerText/placeholder.
 * @param {string} selector
 * @param {string|null} textHint - cocokkan ke innerText.trim() atau placeholder attr
 * @returns {Element|null}
 */
function findElement(selector, textHint = null) {
  // Support multiple selectors comma-separated — coba satu per satu, return first match
  const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);

  for (const sel of selectors) {
    try {
      const candidates = Array.from(document.querySelectorAll(sel));
      if (!candidates.length) continue;
      if (!textHint) return candidates[0];

      const hint = textHint.trim().toLowerCase();
      const match =
        candidates.find(el => el.innerText?.trim().toLowerCase() === hint) ||
        candidates.find(el => el.getAttribute('placeholder')?.toLowerCase() === hint) ||
        candidates.find(el => el.innerText?.trim().toLowerCase().includes(hint)) ||
        null;
      if (match) return match;
    } catch (_) {
      // selector tidak valid — skip
    }
  }

  // Fallback: jika ada textHint tapi tidak match di sel manapun, kembalikan elemen pertama dari sel pertama yang ada
  if (textHint) return null;
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (_) {}
  }
  return null;
}

/**
 * Tunggu elemen hilang dari DOM (berguna setelah modal close).
 * @param {string} selector
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export function waitForElementGone(selector, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(selector)) return resolve();

    const deadline = Date.now() + timeoutMs;

    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        observer.disconnect();
        resolve();
      } else if (Date.now() >= deadline) {
        observer.disconnect();
        reject(new Error(`waitForElementGone timeout: "${selector}"`));
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      if (!document.querySelector(selector)) resolve();
      else reject(new Error(`waitForElementGone timeout: "${selector}"`));
    }, timeoutMs);
  });
}

/**
 * Tunggu URL berubah ke pattern tertentu.
 * @param {string|RegExp} pattern
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export function waitForUrl(pattern, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (typeof pattern === 'string') return location.href.includes(pattern);
      return pattern.test(location.href);
    };

    if (check()) return resolve();

    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        resolve();
      }
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      if (check()) resolve();
      else reject(new Error(`waitForUrl timeout: ${pattern}`));
    }, timeoutMs);
  });
}
