// adapters/csv.js - CKG Auto KlikPro v2.0
// CSV Adapter — Parse CSV files into standardized patientData objects
// Pure browser implementation, no external dependencies.

'use strict';

import { normalizeExcelRow, validatePatient } from './excel.js';

/**
 * Parse a CSV string into rows.
 * Handles quoted fields, commas inside quotes, CRLF/LF line endings.
 *
 * @param {string} csvText
 * @returns {Object[]} array of row objects (keys = header values)
 */
function parseCSV(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = _splitCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = _splitCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Split a single CSV line respecting quoted fields.
 */
function _splitCSVLine(line) {
  const fields = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Load patient data from a CSV file.
 *
 * @param {File|string} source   — File object or CSV text string
 * @param {Object} [mapping]      — custom column mapping
 * @returns {Promise<Object[]>} array of normalized patientData objects
 */
export async function loadFromCSV(source, mapping = {}) {
  let text;
  if (typeof source === 'string') {
    text = source;
  } else if (source instanceof File) {
    text = await source.text();
  } else {
    throw new Error('CSV Adapter: source harus berupa File atau string');
  }

  const rows = parseCSV(text);
  return rows
    .map(row => normalizeExcelRow(row, mapping))
    .filter(row => row.NIK);
}

export { validatePatient };
