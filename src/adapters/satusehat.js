// adapters/satusehat.js - CKG Auto KlikPro v2.0
// SATUSEHAT Adapter — Read patient data directly from the open SATUSEHAT page
// Extracts pre-filled patient context (name, NIK) from the live DOM

'use strict';

/**
 * Extract patient context from the currently open SATUSEHAT page.
 * SATUSEHAT often shows patient name/NIK on the registration or confirmation page.
 *
 * @returns {Object} partial patientData (may be incomplete — supplement from other adapters)
 */
export function extractFromCurrentPage() {
  const data = {};

  // Common SATUSEHAT DOM patterns — query multiple candidates
  const SELECTORS = {
    Nama: [
      '[data-field="nama"]', '[class*="patient-name"]', '[class*="nama-pasien"]',
      'span[id*="nama"]', 'div[id*="nama"]',
    ],
    NIK: [
      '[data-field="nik"]', '[class*="nik"]', 'span[id*="nik"]',
    ],
    TTL: [
      '[data-field="ttl"]', '[data-field="birth"]', '[class*="lahir"]',
    ],
    Jenis_Kelamin: [
      '[data-field="jk"]', '[data-field="gender"]', '[class*="jenis-kelamin"]',
    ],
    No_WA: [
      '[data-field="wa"]', '[data-field="phone"]', '[class*="telepon"]',
    ],
    Alamat: [
      '[data-field="alamat"]', '[class*="alamat"]',
    ],
  };

  for (const [key, selectors] of Object.entries(SELECTORS)) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerText?.trim()) {
          data[key] = el.innerText.trim();
          break;
        }
      } catch (_) { /* invalid selector — skip */ }
    }
  }

  // Try to find NIK in a text pattern anywhere on page (NIK = 16 digits)
  if (!data.NIK) {
    const bodyText = document.body.innerText || '';
    const nikMatch = bodyText.match(/\b(\d{16})\b/);
    if (nikMatch) data.NIK = nikMatch[1];
  }

  // Normalize NIK
  if (data.NIK) data.NIK = data.NIK.replace(/\D/g, '').slice(-16);

  return data;
}

/**
 * Detect the current SATUSEHAT screen/module being displayed.
 * Uses URL path and page heading to identify the active form.
 *
 * @returns {{ screen: string, url: string, title: string }}
 */
export function detectCurrentScreen() {
  const url   = location.href;
  const title = document.querySelector('h1, h2, [class*="title"]')?.innerText?.trim() || '';

  // URL-based detection
  const SCREEN_MAP = [
    { pattern: /kuesioner|questionnaire/i, screen: 'kuesioner' },
    { pattern: /pendaftaran|registration|daftar/i, screen: 'pendaftaran' },
    { pattern: /pemeriksaan|examination|periksa/i, screen: 'pemeriksaan' },
    { pattern: /konfirmasi|confirm/i, screen: 'konfirmasi' },
    { pattern: /selesai|done|complete/i, screen: 'selesai' },
  ];

  for (const { pattern, screen } of SCREEN_MAP) {
    if (pattern.test(url) || pattern.test(title)) {
      return { screen, url, title };
    }
  }

  // Title-based kuesioner sub-screen detection
  const KUESIONER_MAP = [
    { pattern: /merokok|rokok/i,       screen: 'perilaku_merokok' },
    { pattern: /tuberkulosis|tb/i,     screen: 'tb_dewasa' },
    { pattern: /diabetes|kencing manis/i, screen: 'diabetes' },
    { pattern: /hipertensi|darah tinggi/i, screen: 'hipertensi' },
    { pattern: /jantung/i,             screen: 'jantung' },
    { pattern: /stroke/i,              screen: 'stroke' },
    { pattern: /aktivitas fisik/i,     screen: 'aktivitas_fisik' },
    { pattern: /pola makan/i,          screen: 'pola_makan' },
  ];

  for (const { pattern, screen } of KUESIONER_MAP) {
    if (pattern.test(title)) {
      return { screen, url, title };
    }
  }

  return { screen: 'unknown', url, title };
}
