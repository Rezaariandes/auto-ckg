// tests/metadata_first.test.js
// Unit test ringan (tanpa framework) untuk layer Metadata-First (Phase 1).
// Jalankan: node tests/metadata_first.test.js
//
// Memvalidasi logika murni (tanpa chrome.* / DOM):
//   - react_state_discovery: surveyToSchema, parseQuestionName
//   - metadata_registry: buildPPVEntries, diffPPV, mergeRegistry, mergeMetaIntoDom
//
// Memakai contoh nyata dari riset: Form Builder "Pemeriksaan Hepatitis".

'use strict';

const assert = require('assert');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  - ' + name); }
  catch (e) { console.error('  FAIL - ' + name + '\n        ' + e.message); process.exitCode = 1; }
}

// Contoh payload Form Builder (struktur pages → elements → choices)
const HEPATITIS = {
  pages: [{
    name: 'FRM000044',
    title: 'Pemeriksaan Hepatitis',
    elements: [
      {
        type: 'radiogroup',
        name: 'LPM000167|FRM000044|PPM00000022|text',
        title: 'Hasil Rapid Test Hepatitis B',
        choices: [
          { value: 'PPV00000024', text: 'HBsAg Non Reaktif' },
          { value: 'PPV00000025', text: 'HBsAg Reaktif' },
        ],
      },
      {
        type: 'radiogroup',
        name: 'LPM000167|FRM000044|PPM00000039|text',
        title: 'Hasil Rapid Test Hepatitis C',
        choices: [
          { value: 'PPV00000129', text: 'Anti HCV Non Reaktif' },
          { value: 'PPV00000130', text: 'Anti HCV Reaktif' },
        ],
      },
    ],
  }],
};

(async () => {
  const rsd = require('../src/engine/react_state_discovery.js');
  const reg = await import('../src/engine/metadata_registry.js');

  // ── react_state_discovery ────────────────────────────────────────────────
  test('parseQuestionName mengekstrak FRM & PPM', () => {
    const p = rsd.parseQuestionName('LPM000167|FRM000044|PPM00000022|text');
    assert.strictEqual(p.form, 'FRM000044');
    assert.strictEqual(p.code, 'PPM00000022');
    assert.strictEqual(p.lpm, 'LPM000167');
  });

  test('mapType radiogroup → radio', () => {
    assert.strictEqual(rsd.mapType({ type: 'radiogroup' }), 'radio');
    assert.strictEqual(rsd.mapType({ type: 'text', inputType: 'number' }), 'number');
    assert.strictEqual(rsd.mapType({ type: 'comment' }), 'textarea');
  });

  test('surveyToSchema menghasilkan PPV + PPM dari metadata Hepatitis', () => {
    const s = rsd.surveyToSchema(HEPATITIS, {});
    assert.strictEqual(s._source, 'react-state');
    assert.strictEqual(s._form, 'FRM000044');
    assert.strictEqual(s.questions.length, 2);

    const q1 = s.questions[0];
    assert.strictEqual(q1.question, 'Hasil Rapid Test Hepatitis B');
    assert.strictEqual(q1.code, 'PPM00000022');
    assert.strictEqual(q1.form, 'FRM000044');
    assert.strictEqual(q1.type, 'radio');
    assert.strictEqual(q1.options[0].value, 'PPV00000024');
    assert.strictEqual(q1.options[0].label, 'HBsAg Non Reaktif');
    assert.strictEqual(q1.options[1].value, 'PPV00000025');

    const q2 = s.questions[1];
    assert.strictEqual(q2.code, 'PPM00000039');
    assert.strictEqual(q2.options[0].value, 'PPV00000129');
  });

  test('looksLikeSurvey membedakan payload valid vs sampah', () => {
    assert.strictEqual(rsd.looksLikeSurvey(HEPATITIS), true);
    assert.strictEqual(rsd.looksLikeSurvey({ foo: 1 }), false);
    assert.strictEqual(rsd.looksLikeSurvey({ pages: [] }), false);
  });

  // ── metadata_registry ─────────────────────────────────────────────────────
  const schema = rsd.surveyToSchema(HEPATITIS, {});

  test('buildPPVEntries mengindeks semua PPV', () => {
    const entries = reg.buildPPVEntries(schema);
    assert.strictEqual(entries.length, 4);
    const ppv24 = entries.find(e => e.ppv === 'PPV00000024');
    assert.strictEqual(ppv24.label, 'HBsAg Non Reaktif');
    assert.strictEqual(ppv24.code, 'PPM00000022');
  });

  test('diffPPV mendeteksi PPV baru lalu changed', () => {
    const entries = reg.buildPPVEntries(schema);
    const d1 = reg.diffPPV({}, entries);
    assert.strictEqual(d1.added.length, 4);

    const regAfter = reg.mergeRegistry({}, entries, '2026-01-01T00:00:00Z');
    // Label berubah (UI label bisa berubah, PPV stabil)
    const changedEntries = entries.map(e =>
      e.ppv === 'PPV00000024' ? { ...e, label: 'HBsAg Negatif' } : e);
    const d2 = reg.diffPPV(regAfter, changedEntries);
    assert.strictEqual(d2.changed.length, 1);
    assert.strictEqual(d2.changed[0].ppv, 'PPV00000024');
    assert.strictEqual(d2.changed[0].to.label, 'HBsAg Negatif');
  });

  test('mergeRegistry menyimpan history saat label berubah', () => {
    const entries = reg.buildPPVEntries(schema);
    let r = reg.mergeRegistry({}, entries, '2026-01-01T00:00:00Z');
    const changed = entries.map(e =>
      e.ppv === 'PPV00000024' ? { ...e, label: 'HBsAg Negatif' } : e);
    r = reg.mergeRegistry(r, changed, '2026-02-01T00:00:00Z');
    assert.strictEqual(r['PPV00000024'].label, 'HBsAg Negatif');
    assert.strictEqual(r['PPV00000024'].history.length, 1);
    assert.strictEqual(r['PPV00000024'].history[0].label, 'HBsAg Non Reaktif');
  });

  test('mergeMetaIntoDom mengisi PPV kosong pada schema DOM', () => {
    // Simulasi schema DOM (value PPV kosong, hanya label) — kasus diabetes.json
    const domSchema = {
      screen: 'pemeriksaan_hepatitis',
      questions: [{
        question: 'Hasil Rapid Test Hepatitis B',
        type: 'radio',
        options: [
          { id: '', value: '', label: 'HBsAg Non Reaktif' },
          { id: '', value: '', label: 'HBsAg Reaktif' },
        ],
      }],
    };
    const merged = reg.mergeMetaIntoDom(domSchema, schema);
    assert.strictEqual(merged._enrichedFromMeta, true);
    assert.strictEqual(merged.questions[0].code, 'PPM00000022');
    assert.strictEqual(merged.questions[0].options[0].value, 'PPV00000024');
    assert.strictEqual(merged.questions[0].options[1].value, 'PPV00000025');
  });

  console.log('\n' + passed + ' assertions passed.');
})();
