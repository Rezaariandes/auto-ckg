// react_state_discovery.js - CKG Auto KlikPro v2.1
// Metadata-First Discovery — Phase 1
//
// Membaca metadata Form Builder SATUSEHAT langsung dari React runtime state
// (Survey Model di memory), BUKAN dari DOM. Sumber kebenaran sebenarnya:
//
//   Server → Encrypted Payload → Frontend Decrypt → React State → Survey Model → DOM
//
// Modul ini menelusuri React Fiber, menemukan objek SurveyModel / payload Form
// Builder (struktur pages → elements → choices), lalu menormalkannya ke bentuk
// schema yang sama dengan DOM extractor — tapi dengan kode FRM/PPM/PPV terisi.
//
// Karakter penting:
//   - Berjalan di MAIN world (lihat background.js: world:'MAIN'), karena properti
//     React Fiber (__reactFiber$xxx) hanya terlihat dari konteks JS halaman.
//   - Diinject sebagai classic script via chrome.scripting.executeScript({ files }),
//     jadi TIDAK memakai ESM `export` (pola sama dengan executor_inject.js).
//   - Defensif total: tidak pernah throw; gagal → kembalikan null/ schema kosong.
//   - Juga dapat di-require() di Node untuk unit test (lihat ekspor di bawah).

(function (global) {
  'use strict';

  // ── Konstanta batas traversal (hindari loop / pohon raksasa) ───────────────
  var MAX_FIBER_NODES = 20000;  // batas jumlah fiber yang dikunjungi
  var MAX_OBJ_DEPTH   = 8;      // kedalaman deep-search dalam satu objek state
  var MAX_OBJ_NODES   = 50000;  // batas node objek yang dikunjungi saat deep-search

  // ── Helper: ambil React Fiber dari sebuah DOM node ─────────────────────────
  function getFiberFromNode(node) {
    if (!node) return null;
    for (var key in node) {
      if (key.indexOf('__reactFiber$') === 0 ||
          key.indexOf('__reactInternalInstance$') === 0) {
        return node[key];
      }
    }
    return null;
  }

  // ── Helper: kumpulkan root fiber dari beberapa kandidat DOM ────────────────
  function collectRootFibers() {
    var roots = [];
    var candidates = [];
    var byId = document.getElementById('root') || document.getElementById('app');
    if (byId) candidates.push(byId);
    if (document.body) candidates.push(document.body);
    // Tambahan: elemen yang biasa membungkus SurveyJS
    var extra = document.querySelectorAll('[id*="root"],[class*="sd-root"],[class*="sv-root"],[class*="survey"]');
    for (var i = 0; i < extra.length && i < 20; i++) candidates.push(extra[i]);

    for (var c = 0; c < candidates.length; c++) {
      var fiber = getFiberFromNode(candidates[c]);
      if (fiber) {
        // Naik ke root untuk cakupan maksimal
        var top = fiber;
        var guard = 0;
        while (top.return && guard < 10000) { top = top.return; guard++; }
        if (roots.indexOf(top) === -1) roots.push(top);
      }
    }
    return roots;
  }

  // ── Helper: apakah objek terlihat seperti payload Form Builder / Survey ────
  function looksLikeSurvey(obj) {
    if (!obj || typeof obj !== 'object') return false;
    var pages = obj.pages;
    if (!Array.isArray(pages) || pages.length === 0) return false;
    // minimal satu page punya elements/questions berupa array
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (!p || typeof p !== 'object') continue;
      var els = p.elements || p.questions;
      if (Array.isArray(els)) return true;
    }
    return false;
  }

  // ── Helper: deep-search satu objek state untuk struktur survey ─────────────
  function deepFindSurvey(start, found, visited, counter) {
    if (!start || typeof start !== 'object') return;
    var stack = [{ obj: start, depth: 0 }];
    while (stack.length) {
      var cur = stack.pop();
      var obj = cur.obj;
      var depth = cur.depth;
      if (!obj || typeof obj !== 'object') continue;
      if (visited.has(obj)) continue;
      visited.add(obj);
      counter.n++;
      if (counter.n > MAX_OBJ_NODES) return;

      // Survey model langsung
      if (looksLikeSurvey(obj)) { found.push(obj); continue; }

      // Survey model SurveyJS sering punya toJSON() yang menghasilkan {pages}
      if (typeof obj.toJSON === 'function' && Array.isArray(obj.pages)) {
        try {
          var json = obj.toJSON();
          if (looksLikeSurvey(json)) { found.push(json); continue; }
        } catch (_) {}
      }

      if (depth >= MAX_OBJ_DEPTH) continue;

      // Telusuri properti (lewati DOM node & fungsi untuk efisiensi)
      var keys;
      try { keys = Object.keys(obj); } catch (_) { continue; }
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k === '_owner' || k === 'stateNode' || k === 'return' ||
            k === '_reactInternals' || k === 'ownerDocument' || k === 'parentNode') continue;
        var v;
        try { v = obj[k]; } catch (_) { continue; }
        if (!v || typeof v !== 'object') continue;
        if (v.nodeType) continue; // DOM node
        stack.push({ obj: v, depth: depth + 1 });
      }
    }
  }

  // ── Traversal fiber tree → kumpulkan kandidat survey ───────────────────────
  function findSurveyObjects() {
    var roots = collectRootFibers();
    var found = [];
    var visitedObjs = new WeakSet();
    var counter = { n: 0 };
    var visitedFibers = new WeakSet();
    var queue = roots.slice();
    var fiberCount = 0;

    while (queue.length) {
      var fiber = queue.shift();
      if (!fiber || visitedFibers.has(fiber)) continue;
      visitedFibers.add(fiber);
      fiberCount++;
      if (fiberCount > MAX_FIBER_NODES) break;

      // Sumber state pada sebuah fiber
      var sources = [fiber.memoizedProps, fiber.memoizedState];
      var sn = fiber.stateNode;
      if (sn && typeof sn === 'object') {
        sources.push(sn.props);
        sources.push(sn.state);
        sources.push(sn.survey);   // SurveyJS React kadang simpan di instance
        sources.push(sn.model);
      }
      for (var s = 0; s < sources.length; s++) {
        if (sources[s] && typeof sources[s] === 'object') {
          deepFindSurvey(sources[s], found, visitedObjs, counter);
          if (found.length) return found; // cukup satu survey valid pertama
        }
      }

      if (fiber.child)   queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    return found;
  }

  // ── Parse "LPM000167|FRM000044|PPM00000022|text" → kode komponen ───────────
  function parseQuestionName(name) {
    var out = { lpm: '', form: '', code: '', raw: name || '' };
    if (!name || typeof name !== 'string') return out;
    var parts = name.split('|');
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i].trim();
      if (/^LPM/i.test(t)) out.lpm = t;
      else if (/^FRM/i.test(t)) out.form = t;
      else if (/^PPM/i.test(t)) out.code = t;
    }
    return out;
  }

  // ── Ambil tipe mentah element SurveyJS ─────────────────────────────────────
  // Pada React runtime, element adalah instance Question: properti `type` sering
  // `undefined`, tetapi `getType()` dan `jsonObj.type` mengembalikan tipe asli
  // ("radiogroup"/"text"/"panel"/...). Raw JSON Form Builder tetap pakai `type`.
  function getElType(el) {
    if (!el) return '';
    try { if (el.type) return String(el.type); } catch (_) {}
    try { if (typeof el.getType === 'function') { var gt = el.getType(); if (gt) return String(gt); } } catch (_) {}
    try { if (el.jsonObj && el.jsonObj.type) return String(el.jsonObj.type); } catch (_) {}
    return '';
  }

  // ── Normalisasi tipe SurveyJS → tipe internal Auto CKG ─────────────────────
  function mapType(el) {
    var t = getElType(el).toLowerCase();
    switch (t) {
      case 'radiogroup': return 'radio';
      case 'checkbox':   return 'checkbox';
      case 'dropdown':   return 'select';
      case 'comment':    return 'textarea';
      case 'rating':     return 'radio';
      case 'boolean':    return 'radio';
      case 'text':
        return (el && (el.inputType === 'number' || el.inputType === 'tel')) ? 'number'
             : (el && el.inputType === 'date') ? 'date'
             : 'text';
      default:
        return t || 'unknown';
    }
  }

  // ── Ambil teks dari sebuah choice (object / ItemValue / string) ────────────
  function choiceLabel(choice) {
    if (choice == null) return '';
    if (typeof choice === 'string' || typeof choice === 'number') return String(choice);
    // {value, text} (raw JSON) atau ItemValue ({value, text getter, locText})
    try {
      if (choice.text != null && typeof choice.text !== 'object') return String(choice.text).trim();
      if (choice.locText && choice.locText.text) return String(choice.locText.text).trim();
      if (choice.title != null) return String(choice.title).trim();
    } catch (_) {}
    return choice.value != null ? String(choice.value) : '';
  }

  function choiceValue(choice) {
    if (choice == null) return '';
    if (typeof choice === 'string' || typeof choice === 'number') return String(choice);
    return choice.value != null ? String(choice.value) : '';
  }

  // ── Slugify untuk screen name ──────────────────────────────────────────────
  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'unknown';
  }

  // ── Fingerprint berbasis KODE (PPM/PPV), bukan teks ────────────────────────
  function fingerprintByCode(questions) {
    var parts = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      parts.push(q.code || q.name || q.question || '');
      if (q.options) {
        for (var j = 0; j < q.options.length; j++) parts.push(q.options[j].value || '');
      }
    }
    var str = parts.join('|');
    var hash = 0x811c9dc5;
    for (var k = 0; k < str.length; k++) {
      hash ^= str.charCodeAt(k);
      hash = (hash * 0x01000193) >>> 0;
    }
    return 'meta_' + hash.toString(16);
  }

  // ── Konversi survey/form-builder object → schema Auto CKG ──────────────────
  function surveyToSchema(survey, opts) {
    opts = opts || {};
    var pages = survey.pages || [];
    var questions = [];
    var firstForm = '';
    var titleFromPage = '';

    for (var p = 0; p < pages.length; p++) {
      var page = pages[p];
      if (!page) continue;
      if (!titleFromPage && page.title) titleFromPage = String(page.title);
      var els = page.elements || page.questions || [];
      for (var e = 0; e < els.length; e++) {
        var el = els[e];
        var elType = getElType(el).toLowerCase();
        if (!el || elType === 'panel' || elType === 'html') {
          // panel: bisa berisi nested elements
          if (el && Array.isArray(el.elements)) {
            els = els.concat(el.elements);
          }
          continue;
        }
        var parsed = parseQuestionName(el.name);
        if (!firstForm && parsed.form) firstForm = parsed.form;

        var item = {
          question: (el.title != null ? String(el.title) : '') ||
                    (el.label != null ? String(el.label) : '') ||
                    parsed.code || parsed.raw || '',
          type: mapType(el),
          name: el.name || '',
          code: parsed.code,
          form: parsed.form,
        };

        var choices = el.choices;
        if (Array.isArray(choices) && choices.length) {
          item.options = [];
          for (var c = 0; c < choices.length; c++) {
            item.options.push({
              id: '',
              value: choiceValue(choices[c]),  // PPV — dari metadata, bukan DOM
              label: choiceLabel(choices[c]),
            });
          }
        }
        questions.push(item);
      }
    }

    var title = opts.screenTitle || titleFromPage || (survey.title ? String(survey.title) : '') || firstForm || 'Unknown Screen';
    var screen = opts.screenName || (firstForm ? slugify(firstForm) : slugify(title));

    return {
      screen: screen,
      title: title,
      version: 1,
      generatedAt: new Date().toISOString(),
      fingerprint: fingerprintByCode(questions),
      questions: questions,
      _source: 'react-state',
      _form: firstForm,
      _questionCount: questions.length,
    };
  }

  // ── API utama (dipanggil di MAIN world via executeScript) ──────────────────
  function extractReactMetadata(opts) {
    try {
      var surveys = findSurveyObjects();
      if (!surveys.length) {
        return { ok: false, error: 'Survey model tidak ditemukan di React state', _source: 'react-state' };
      }
      var schema = surveyToSchema(surveys[0], opts || {});
      if (!schema.questions.length) {
        return { ok: false, error: 'Survey ditemukan tapi tidak ada pertanyaan', schema: schema, _source: 'react-state' };
      }
      return { ok: true, schema: schema, _source: 'react-state' };
    } catch (e) {
      return { ok: false, error: 'extractReactMetadata: ' + (e && e.message), _source: 'react-state' };
    }
  }

  // ── Ekspor ─────────────────────────────────────────────────────────────────
  // Browser (MAIN world): expose global agar bisa dipanggil dari func injection.
  global.__ckgExtractReactMetadata = extractReactMetadata;

  // Node (unit test): ekspor helper murni.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      extractReactMetadata: extractReactMetadata,
      surveyToSchema: surveyToSchema,
      parseQuestionName: parseQuestionName,
      mapType: mapType,
      getElType: getElType,
      choiceLabel: choiceLabel,
      choiceValue: choiceValue,
      looksLikeSurvey: looksLikeSurvey,
      fingerprintByCode: fingerprintByCode,
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
