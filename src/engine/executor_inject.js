(function () {
  'use strict';

  // Reset flag agar inject ulang selalu pakai versi terbaru
  window.__ckgExecutorLoaded = false;
  window.__ckgExecuteStep = null;
  window.__ckgExecutorLoaded = true;

  // ── waitForElement (dari observer.js) ──────────────────────────────────

  function findElement(selector, textHint) {
    if (!selector) return null;
    var selectors = selector.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    for (var si = 0; si < selectors.length; si++) {
      var sel = selectors[si];
      try {
        var candidates = Array.from(document.querySelectorAll(sel));
        if (!candidates.length) continue;
        if (!textHint) return candidates[0];
        var hint = textHint.trim().toLowerCase();
        var match =
          candidates.find(function(el){ return el.innerText && el.innerText.trim().toLowerCase() === hint; }) ||
          candidates.find(function(el){ return el.getAttribute && el.getAttribute('placeholder') && el.getAttribute('placeholder').toLowerCase() === hint; }) ||
          candidates.find(function(el){ return el.innerText && el.innerText.trim().toLowerCase().includes(hint); }) ||
          null;
        if (match) return match;
      } catch(e) {}
    }
    if (textHint) return null;
    for (var si2 = 0; si2 < selectors.length; si2++) {
      try {
        var el = document.querySelector(selectors[si2]);
        if (el) return el;
      } catch(e) {}
    }
    return null;
  }

  function waitForElement(selector, timeoutMs, placeholder) {
    if (timeoutMs === undefined) timeoutMs = 8000;
    return new Promise(function(resolve, reject) {
      var found = findElement(selector, placeholder || null);
      if (found) return resolve(found);

      var deadline = Date.now() + timeoutMs;

      var observer = new MutationObserver(function() {
        var el = findElement(selector, placeholder || null);
        if (el) { observer.disconnect(); return resolve(el); }
        if (Date.now() >= deadline) { observer.disconnect(); return reject(new Error('waitForElement timeout: "' + selector + '"' + (placeholder ? ' [placeholder="' + placeholder + '"]' : ''))); }
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true });

      setTimeout(function() {
        observer.disconnect();
        var el = findElement(selector, placeholder || null);
        if (el) resolve(el);
        else reject(new Error('waitForElement timeout: "' + selector + '"' + (placeholder ? ' [placeholder="' + placeholder + '"]' : '')));
      }, timeoutMs);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(function(r){ setTimeout(r, ms); });
  }

  function nativeInputValueSetter(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (nativeSetter) nativeSetter.call(el, value);
    else el.value = value;
  }

  function nativeSelectSetter(el, value) {
    var nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value') && Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    if (nativeSetter) nativeSetter.call(el, value);
    else el.value = value;
  }

  function resolveValue(step, pasienData) {
    if (step.excelColumn && step.excelColumn !== '__alamat_bundle__') {
      var col = step.excelColumn;
      return pasienData[col] !== undefined ? pasienData[col] : null;
    }
    return step.value !== undefined ? step.value : null;
  }

  function formatDateForSite(raw) {
    if (!raw) return '';
    if (String(raw).match(/^\d{2}\/\d{2}\/\d{4}$/)) return raw;
    var d = new Date(raw);
    if (!isNaN(d)) {
      var day = String(d.getDate()).padStart(2, '0');
      var mon = String(d.getMonth() + 1).padStart(2, '0');
      var yr = d.getFullYear();
      return day + '/' + mon + '/' + yr;
    }
    return raw;
  }

  // Parse tanggal "DD/MM/YYYY" → { day, month, year }
  function parseDDMMYYYY(str) {
    var m = String(str).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return { day: parseInt(m[1]), month: parseInt(m[2]), year: parseInt(m[3]) };
    var d = new Date(str);
    if (!isNaN(d)) return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
    return null;
  }

  // Tutup semua popup/dropdown yang terbuka (Escape)
  function closeOpenDropdowns() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.body.click();
  }

  async function findDropdownOption(text, timeoutMs) {
    if (!timeoutMs) timeoutMs = 3000;
    var selectors = ['[role="option"]', '[class*="option"]', '[class*="item"]', 'li', '.dropdown-item', '.v-list-item'];
    var deadline = Date.now() + timeoutMs;
    var lower = text.toLowerCase();
    while (Date.now() < deadline) {
      // Pass 1: selector standar dropdown
      for (var i = 0; i < selectors.length; i++) {
        var items = Array.from(document.querySelectorAll(selectors[i]));
        var match = items.find(function(el){ return el.innerText && el.innerText.trim().toLowerCase() === lower; }) ||
                    items.find(function(el){ return el.innerText && el.innerText.trim().toLowerCase().includes(lower); });
        if (match) return match;
      }
      // Pass 2: fallback untuk Vue custom dropdown — cari div/span dengan exact text
      var fbEls = Array.from(document.querySelectorAll('div, span, a'));
      var fb = fbEls.find(function(el) {
        var txt = (el.innerText || '').trim();
        return txt.toLowerCase() === lower && txt.length < 120 && el.childElementCount <= 1;
      });
      if (fb) return fb;
      await sleep(150);
    }
    return null;
  }

  // ── Step Handlers ──────────────────────────────────────────────────────

  async function doWait(step, timeout) {
    if (!step.selector) {
      var fixedMs = step.value ? parseInt(step.value) : 1000;
      await sleep(isNaN(fixedMs) ? 1000 : fixedMs);
      return { success: true, message: 'wait: delay ' + fixedMs + 'ms (no selector)' };
    }
    var ms = step.value ? parseInt(step.value) : timeout;
    if (isNaN(ms) || ms <= 0) ms = timeout;
    try {
      await waitForElement(step.selector, ms, step.placeholder || null);
      return { success: true, message: 'wait: element muncul "' + step.selector + '"' };
    } catch(e) {
      return { success: false, message: e.message };
    }
  }

  async function doClick(step, timeout) {
    if (!step.selector && step.buttonText) return doClickButton(step, timeout);
    if (!step.selector) return { success: false, message: 'click: selector null dan tidak ada buttonText' };
    try {
      var el = await waitForElement(step.selector, timeout, step.placeholder || null);
      var clickTarget = el;
      if (!['BUTTON', 'A'].includes(el.tagName)) {
        var ancestor = el.closest('button, a, [role="button"]');
        if (ancestor) clickTarget = ancestor;
      }
      clickTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(200);
      clickTarget.click();
      return { success: true, message: 'click: OK "' + step.label + '"' };
    } catch(e) {
      return { success: false, message: 'click: ' + e.message };
    }
  }

  async function doType(step, value, timeout) {
    if (value === null || value === undefined) {
      return { success: false, message: 'type: value null — cek excelColumn "' + step.excelColumn + '"' };
    }
    try {
      var el = await waitForElement(step.selector, timeout, step.placeholder || null);
      var strVal = String(value);
      // Apply transforms (e.g. untuk nomor telepon Indonesia)
      if (step.transform === 'phone_strip_zero' || step.transform === 'phone_id') {
        strVal = strVal.replace(/^\+62/, '').replace(/^0+/, '');
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus();
      // Clear existing value
      nativeInputValueSetter(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      await sleep(80);
      // Set new value — pakai InputEvent supaya Vue 2 reactive ter-trigger
      nativeInputValueSetter(el, strVal);
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true,
        data: strVal, inputType: 'insertText'
      }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      return { success: true, message: 'type: "' + step.excelColumn + '" = "' + strVal + '"' };
    } catch(e) {
      return { success: false, message: 'type: ' + e.message };
    }
  }

  async function doSelect(step, value, timeout) {
    if (!value) return { success: false, message: 'select: value kosong' };
    try {
      var el = await waitForElement(step.selector, timeout);
      var option = Array.from(el.options).find(function(o){
        return o.value === String(value) || o.text.toLowerCase().includes(String(value).toLowerCase());
      });
      if (!option) return { success: false, message: 'select: opsi "' + value + '" tidak ditemukan' };
      nativeSelectSetter(el, option.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: 'select: OK "' + value + '"' };
    } catch(e) {
      return { success: false, message: 'select: ' + e.message };
    }
  }

  async function doScroll(step, timeout) {
    if (step.selector) {
      try {
        var el = await waitForElement(step.selector, timeout);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch(_) {}
    } else {
      window.scrollBy({ top: parseInt(step.value) || 300, behavior: 'smooth' });
    }
    return { success: true, message: 'scroll: OK' };
  }

  // ── doDatePicker: Vue instance injection + UI calendar fallback ──────────
  // Strategy 1: Inject langsung ke Vue instance (__vue__) — paling reliable,
  //             tidak perlu navigasi visual sama sekali.
  // Strategy 2: Fallback ke klik tombol kalender UI jika Vue tidak accessible.
  async function doDatePicker(step, value, timeout) {
    if (!value) return { success: false, message: 'date_picker: value kosong' };

    var dateStr  = formatDateForSite(String(value));
    var parsed   = parseDDMMYYYY(dateStr);
    if (!parsed) return { success: false, message: 'date_picker: format tanggal tidak valid: "' + dateStr + '"' };
    var targetDay = parsed.day, targetMonth = parsed.month, targetYear = parsed.year;
    // Date object untuk Vue (bulan 0-indexed)
    var targetDate = new Date(targetYear, targetMonth - 1, targetDay, 12, 0, 0);

    try {
      // ── Cari semua container .mx-datepicker di halaman ──────────────────
      // Jika ada placeholder, pilih yang paling dekat ke elemen placeholder
      var allContainers = Array.from(document.querySelectorAll('.mx-datepicker, [class*="datepicker"]:not([class*="popup"])'));
      var container = null;

      if (step.placeholder && allContainers.length > 1) {
        // Cari container yang mengandung atau bertetangga dengan placeholder text
        var ph = step.placeholder.toLowerCase();
        container = allContainers.find(function(c) {
          var parent = c.parentElement || c;
          return (parent.innerText || '').toLowerCase().includes(ph) ||
                 (c.innerText || '').toLowerCase().includes(ph);
        }) || allContainers[0];
      } else if (allContainers.length > 0) {
        container = allContainers[0];
      }

      // Fallback: tunggu dengan waitForElement
      if (!container) {
        try {
          container = await waitForElement(
            [step.selector, '.mx-datepicker'].filter(Boolean).join(', '),
            timeout, step.placeholder || null
          );
        } catch(_) {}
      }
      if (!container) return { success: false, message: 'date_picker: container tidak ditemukan' };

      // ── Strategy 1: Vue instance injection ──────────────────────────────
      // Cari Vue instance di container atau child-nya
      function findVueInstance(el, depth) {
        if (!el || depth > 6) return null;
        if (el.__vue__) return el.__vue__;
        for (var i = 0; i < el.children.length; i++) {
          var v = findVueInstance(el.children[i], depth + 1);
          if (v) return v;
        }
        return null;
      }

      var vm = findVueInstance(container, 0);
      if (vm) {
        // Coba berbagai method yang digunakan vue2-datepicker
        var injected = false;

        // Method A: handleSelectDate (internal method vue2-datepicker)
        if (typeof vm.handleSelectDate === 'function') {
          vm.handleSelectDate(targetDate, 'date');
          injected = true;
        }
        // Method B: selectDate
        else if (typeof vm.selectDate === 'function') {
          vm.selectDate(targetDate);
          injected = true;
        }
        // Method C: set currentValue langsung
        else if ('currentValue' in vm) {
          vm.currentValue = targetDate;
          vm.$emit('input', targetDate);
          injected = true;
        }
        // Method D: cari parent vm yang punya currentValue
        else {
          var parentVm = vm.$parent;
          for (var pUp = 0; pUp < 5 && parentVm; pUp++) {
            if ('currentValue' in parentVm && typeof parentVm.$emit === 'function') {
              parentVm.currentValue = targetDate;
              parentVm.$emit('input', targetDate);
              injected = true;
              break;
            }
            parentVm = parentVm.$parent;
          }
        }

        if (injected) {
          await sleep(500);
          // Tutup popup jika masih terbuka
          document.body.click();
          await sleep(300);
          // Verifikasi: container harus menampilkan angka (tanggal)
          var txt = (container.innerText || container.textContent || '').trim();
          var ok = /\d/.test(txt) && !txt.toLowerCase().includes('pilih');
          if (ok) {
            return { success: true, message: 'date_picker (Vue inject): ' + txt.slice(0, 25) };
          }
          // Inject berhasil tapi display belum update — tetap anggap sukses
          return { success: true, message: 'date_picker (Vue inject): set ' + dateStr };
        }
      }

      // ── Strategy 2: UI Calendar click (fallback) ────────────────────────
      console.log('[CKG] date_picker: Vue instance tidak ditemukan, pakai UI click');

      // Buka popup kalender
      var iconBtn = container.querySelector('i[class*="calendar"], .mx-icon-calendar');
      if (iconBtn) iconBtn.click(); else container.click();
      await sleep(700);

      var popup =
        container.querySelector('.mx-datepicker-popup, .mx-calendar') ||
        document.querySelector('.mx-datepicker-popup');
      if (!popup) {
        container.click();
        await sleep(700);
        popup = document.querySelector('.mx-datepicker-popup, .mx-calendar-wrapper');
      }
      if (!popup) return { success: false, message: 'date_picker: popup tidak muncul & Vue instance tidak ditemukan' };

      // ── Baca header bulan/tahun ──────────────────────────────────────────
      var MONTH_MAP = {
        'jan':1,'feb':2,'mar':3,'apr':4,'mei':5,'may':5,'jun':6,'jul':7,
        'agu':8,'aug':8,'sep':9,'okt':10,'oct':10,'nov':11,'des':12,'dec':12,
        'januari':1,'februari':2,'maret':3,'april':4,'juni':6,'juli':7,
        'agustus':8,'september':9,'oktober':10,'november':11,'desember':12,
        'january':1,'february':2,'march':3,'june':6,'july':7,'august':8,
        'october':10,'december':12,
      };

      function readCurrentMonthYear() {
        // Strategy A: scan individual buttons — di mx-datepicker, bulan & tahun
        //             ada di 2 button TERPISAH (bukan satu string "Jun 2026")
        var monthFound = null, yearFound = null;
        var btns = Array.from(popup.querySelectorAll('button'));
        for (var bi = 0; bi < btns.length; bi++) {
          var t = (btns[bi].innerText || '').trim();
          if (/^\d{4}$/.test(t)) {
            yearFound = parseInt(t);
          } else {
            var slug = t.toLowerCase().replace(/[^a-z]/g, '').slice(0, 9);
            var mo = MONTH_MAP[slug] || MONTH_MAP[slug.slice(0, 3)];
            if (mo) monthFound = mo;
          }
        }
        if (monthFound && yearFound) {
          console.log('[CKG] date_picker calendar:', monthFound + '/' + yearFound);
          return { month: monthFound, year: yearFound };
        }
        // Strategy B: concat text dari header label ("Jun 2026" dalam satu elemen)
        var label = popup.querySelector('.mx-calendar-header-label, .mx-calendar-header');
        if (label) {
          var txt = (label.innerText || label.textContent || '').replace(/\s+/g, ' ').trim();
          var m = txt.match(/([A-Za-z]+)\s+(\d{4})/) || txt.match(/(\d{4})\s+([A-Za-z]+)/);
          if (m) {
            var ms = (m[1].match(/[A-Za-z]/) ? m[1] : m[2]).toLowerCase().slice(0, 9);
            var yr = parseInt(m[1].match(/\d{4}/) ? m[1] : m[2]);
            var mo2 = MONTH_MAP[ms] || MONTH_MAP[ms.slice(0, 3)];
            if (mo2 && yr) return { month: mo2, year: yr };
          }
        }
        // Strategy C: scan semua baris teks di popup
        var lines = (popup.innerText || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
        for (var li = 0; li < lines.length; li++) {
          var m2 = lines[li].match(/([A-Za-z]+)\s+(\d{4})/) || lines[li].match(/(\d{4})\s+([A-Za-z]+)/);
          if (m2) {
            var ms2 = (m2[1].match(/[A-Za-z]/) ? m2[1] : m2[2]).toLowerCase().slice(0, 9);
            var yr2 = parseInt(m2[1].match(/\d{4}/) ? m2[1] : m2[2]);
            var mo3 = MONTH_MAP[ms2] || MONTH_MAP[ms2.slice(0, 3)];
            if (mo3 && yr2) return { month: mo3, year: yr2 };
          }
        }
        console.log('[CKG] date_picker: readCurrentMonthYear GAGAL. popup.innerText:', (popup.innerText || '').slice(0, 100));
        return null;
      }

      function clickBtn(selectors) {
        for (var si = 0; si < selectors.length; si++) {
          try {
            var btn = popup.querySelector(selectors[si]);
            if (btn) { btn.click(); return true; }
          } catch(_) {}
        }
        return false;
      }

      // Fase 1: Navigasi per TAHUN (<</>>) — maks 150 iterasi
      for (var yi = 0; yi < 150; yi++) {
        var cy = readCurrentMonthYear();
        if (!cy || cy.year === targetYear) break;
        var ok1 = targetYear < cy.year
          ? clickBtn(['.mx-btn-icon-double-left','[class*="double-left"]'])
          : clickBtn(['.mx-btn-icon-double-right','[class*="double-right"]']);
        if (!ok1) break;
        await sleep(120);
      }

      // Fase 2: Navigasi per BULAN (</>) — maks 24 iterasi
      for (var mi = 0; mi < 24; mi++) {
        var cm = readCurrentMonthYear();
        if (!cm) break;
        var diff = (targetYear - cm.year) * 12 + (targetMonth - cm.month);
        if (diff === 0) break;
        var ok2 = diff < 0
          ? clickBtn(['.mx-btn-icon-left','[class*="btn-prev"]:not([class*="double"])'])
          : clickBtn(['.mx-btn-icon-right','[class*="btn-next"]:not([class*="double"])']);
        if (!ok2) break;
        await sleep(150);
      }
      await sleep(300);

      // Klik cell tanggal
      var cellSels = [
        '.mx-table-date td.cell:not(.disabled):not(.not-current-month)',
        '.mx-table-date td:not(.disabled)',
        '.mx-table td.cell', 'table.mx-table td', 'td.cell',
      ];
      var clicked = false;
      for (var cs = 0; cs < cellSels.length && !clicked; cs++) {
        var cells = Array.from(popup.querySelectorAll(cellSels[cs]));
        for (var ci = 0; ci < cells.length; ci++) {
          if (parseInt((cells[ci].innerText || '').trim()) === targetDay) {
            cells[ci].click(); clicked = true; break;
          }
        }
      }
      await sleep(400);
      if (clicked) return { success: true, message: 'date_picker (UI click): klik ' + dateStr };
      return { success: false, message: 'date_picker: cell ' + targetDay + ' tidak ditemukan (bulan=' + targetMonth + ' tahun=' + targetYear + ')' };

    } catch(e) {
      return { success: false, message: 'date_picker: ' + e.message };
    }
  }

  // ── doSelectDropdown: multi-click + visibility check ─────────────────────
  // Masalah: dropdown Vue pakai v-show (toggle display:none) BUKAN elemen baru.
  // Solusi: cek visibility pakai getBoundingClientRect (bukan offsetParent/new el).
  //         Klik trigger + semua child elements satu per satu sampai opsi muncul.
  async function doSelectDropdown(step, value, timeout) {
    var target = value !== null && value !== undefined ? value : step.value;
    if (!target) return { success: false, message: 'select_dropdown: value kosong' };
    var lower = String(target).toLowerCase();

    // ── Helper: cek apakah elemen truly visible (handle v-show) ─────────────
    function isVisible(el) {
      if (!el) return false;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      var st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    }

    // ── Helper: cari opsi yang visible berisi teks target ────────────────────
    function findVisibleOption() {
      var all = Array.from(document.querySelectorAll('div,span,li,a,option,p'));
      // Exact match dulu
      var exact = all.find(function(e) {
        return isVisible(e) && (e.innerText || '').trim().toLowerCase() === lower;
      });
      if (exact) return exact;
      // Partial match (harus leaf/near-leaf dan panjang wajar)
      return all.find(function(e) {
        var t = (e.innerText || '').trim().toLowerCase();
        return isVisible(e) && t.includes(lower) && t.length < 60 && e.childElementCount <= 1;
      }) || null;
    }

    // ── Helper: klik el dengan mousedown+mouseup+click sequence ─────────────
    async function doClick3(el) {
      el.scrollIntoView({ block: 'center' });
      await sleep(100);
      el.focus();
      ['mousedown', 'mouseup', 'click'].forEach(function(ev) {
        el.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }));
      });
    }

    // ── Strategi 0: native <select> ─────────────────────────────────────────
    var allSelects = Array.from(document.querySelectorAll('select'));
    for (var si = 0; si < allSelects.length; si++) {
      var s = allSelects[si];
      var ctx = (s.closest('div,section,form') ? s.closest('div,section,form').innerText : '') || '';
      if (step.placeholder && !ctx.toLowerCase().includes(step.placeholder.toLowerCase())) continue;
      var nOpt = Array.from(s.options).find(function(o) {
        return o.text.toLowerCase() === lower || o.text.toLowerCase().includes(lower);
      });
      if (nOpt) {
        nativeSelectSetter(s, nOpt.value);
        s.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(300);
        return { success: true, message: 'select_dropdown (native select): "' + target + '"' };
      }
    }

    try {
      var trigger = await waitForElement(step.selector, timeout, step.placeholder || null);

      // Kumpulkan semua elemen yang akan dicoba diklik:
      // trigger itu sendiri + semua descendant-nya (max 15)
      var elsToCick = [trigger].concat(Array.from(trigger.querySelectorAll('*')).slice(0, 14));
      // Juga tambahkan parent trigger (naik 3 level)
      var p = trigger.parentElement;
      for (var up = 0; up < 3 && p && p !== document.body; up++) {
        elsToCick.push(p);
        p = p.parentElement;
      }

      for (var ci = 0; ci < elsToCick.length; ci++) {
        var el = elsToCick[ci];

        // Cek apakah opsi sudah visible (mungkin dropdown sudah terbuka)
        var alreadyOpen = findVisibleOption();
        if (alreadyOpen) {
          console.log('[CKG] select_dropdown: opsi ditemukan sebelum klik (dropdown sudah terbuka)');
          alreadyOpen.scrollIntoView({ block: 'center' });
          alreadyOpen.click();
          await sleep(300);
          return { success: true, message: 'select_dropdown: OK "' + target + '" (already open)' };
        }

        console.log('[CKG] select_dropdown: coba klik el[' + ci + '] = ' + el.tagName + '.' + (el.className || '').split(' ').slice(0,2).join('.'));
        await doClick3(el);
        await sleep(600);

        var opt = findVisibleOption();
        if (opt) {
          console.log('[CKG] select_dropdown: dropdown terbuka setelah klik el[' + ci + ']');
          opt.scrollIntoView({ block: 'center' });
          opt.click();
          await sleep(300);
          return { success: true, message: 'select_dropdown: OK "' + target + '" (via el[' + ci + '])' };
        }

        // Tutup jika terbuka tapi opsi tidak ditemukan
        document.body.click();
        await sleep(150);
      }

      // ── Fallback: Vue instance injection ─────────────────────────────────
      // Cari Vue instance di trigger atau parent-nya, set value langsung
      var vmEl = trigger;
      for (var vu = 0; vu < 6; vu++) {
        if (!vmEl) break;
        if (vmEl.__vue__) {
          var vm = vmEl.__vue__;
          // Coba berbagai cara set value di Vue dropdown component
          if (typeof vm.$emit === 'function') {
            vm.$emit('input', target);
            vm.$emit('change', target);
          }
          if ('value' in vm) vm.value = target;
          if ('selectedValue' in vm) vm.selectedValue = target;
          if ('currentValue' in vm) vm.currentValue = target;
          await sleep(400);
          // Verifikasi: cek apakah trigger sekarang menampilkan target
          var triggerTxt = (trigger.innerText || '').trim().toLowerCase();
          if (triggerTxt.includes(lower)) {
            return { success: true, message: 'select_dropdown (Vue inject): "' + target + '"' };
          }
          break;
        }
        vmEl = vmEl.parentElement;
      }

      var diagEl = trigger.tagName + '.' + (trigger.className || '').trim().split(/\s+/).slice(0,3).join('.');
      return { success: false, message: 'select_dropdown: opsi "' + target + '" tidak ditemukan | trigger=' + diagEl };
    } catch(e) {
      return { success: false, message: 'select_dropdown: ' + e.message };
    }
  }

  // ── doSelectAntrian: pilih Tanggal Pemeriksaan dari custom Vue calendar ──
  //
  // Struktur kalender yang BENAR (bukan .mx-datepicker):
  //   calRoot = .form-data-individu .relative.p-3
  //             (class lengkap: "relative p-3 pt-2 border rounded-md bg-white shadow-gmail")
  //
  //   btns[0] = nama bulan  e.g. "Jun"
  //   btns[1] = tahun       e.g. "2026"
  //   btns[2] = prev "<"
  //   btns[3] = next ">"
  //   btns[4..N] = tanggal, innerText = "10\n42" (hari + slot tersedia)
  //
  // Input value: JS Date | Excel serial (>40000) | "YYYY-MM-DD" | "DD/MM/YYYY"
  async function doSelectAntrian(step, value, timeout) {
    if (!value) return { success: false, message: 'select_antrian: value kosong' };

    // ── 1. Konversi value → targetDate ──────────────────────────────────────
    var targetDate = null;
    var strVal = String(value).trim();
    var nomor = parseInt(strVal);

    if (value instanceof Date && !isNaN(value.getTime())) {
      targetDate = value;
    } else if (isNaN(nomor) && /[A-Za-z]/.test(strVal)) {
      var pd = new Date(strVal);
      if (!isNaN(pd.getTime())) targetDate = pd;
    } else if (!isNaN(nomor) && nomor > 40000 && nomor < 60000) {
      // Excel date serial
      targetDate = new Date((nomor - 25569) * 86400000);
    } else if (/\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}/.test(strVal)) {
      var p2 = strVal.split(/[\-\/]/);
      targetDate = new Date(parseInt(p2[0]), parseInt(p2[1]) - 1, parseInt(p2[2]));
    } else if (/\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4}/.test(strVal)) {
      var p1 = strVal.split(/[\-\/]/);
      targetDate = new Date(parseInt(p1[2]), parseInt(p1[1]) - 1, parseInt(p1[0]));
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      return { success: false, message: 'select_antrian: tidak bisa parse tanggal dari "' + strVal + '"' };
    }

    var tDay   = targetDate.getDate();
    var tMonth = targetDate.getMonth() + 1;
    var tYear  = targetDate.getFullYear();
    console.log('[CKG] select_antrian: target=' + tDay + '/' + tMonth + '/' + tYear);

    var MONTHS = {
      'jan':1,'feb':2,'mar':3,'apr':4,'mei':5,'may':5,'jun':6,'jul':7,
      'agu':8,'aug':8,'sep':9,'okt':10,'oct':10,'nov':11,'des':12,'dec':12
    };

    try {
      await sleep(500);

      // ── 2. Temukan calRoot — HANYA kalender custom di .form-data-individu ──
      //   Prioritas selector:
      //   A) .form-data-individu .relative.p-3          ← paling spesifik
      //   B) class mengandung "shadow-gmail"             ← fallback kelas unik
      //   C) .form-data-individu *: cari el dengan btn[0]=bulan, btn[1]=tahun
      var calRoot = null;

      // A: selector langsung
      var candidates = Array.from(document.querySelectorAll(
        '.form-data-individu .relative.p-3, .form-data-individu [class*="shadow-gmail"]'
      ));
      if (candidates.length > 0) {
        // Verifikasi: harus punya setidaknya 5 button (bulan + tahun + prev + next + ≥1 tanggal)
        calRoot = candidates.find(function(c) {
          return c.querySelectorAll('button').length >= 5;
        }) || candidates[0];
      }

      // B: fallback scan .form-data-individu untuk container dengan btn[0]=nama bulan
      if (!calRoot) {
        var formRoot = document.querySelector('.form-data-individu');
        if (formRoot) {
          var allDivs = Array.from(formRoot.querySelectorAll('div'));
          calRoot = allDivs.find(function(d) {
            var btns = Array.from(d.querySelectorAll(':scope > button, :scope button'));
            if (btns.length < 5) return false;
            var t0 = (btns[0].innerText || '').trim();
            var t1 = (btns[1].innerText || '').trim();
            return /^[A-Za-z]+$/.test(t0) && /^\d{4}$/.test(t1);
          }) || null;
        }
      }

      // C: fallback global — cari div yang btn[0]=bulan, btn[1]=tahun
      //    Pastikan BUKAN .mx-datepicker
      if (!calRoot) {
        var globalDivs = Array.from(document.querySelectorAll('div:not([class*="mx-"])'));
        calRoot = globalDivs.find(function(d) {
          if (d.closest('.mx-datepicker, .mx-datepicker-popup')) return false;
          var btns = Array.from(d.querySelectorAll(':scope > button'));
          if (btns.length < 5) return false;
          var t0 = (btns[0].innerText || '').trim();
          var t1 = (btns[1].innerText || '').trim();
          return /^[A-Za-z]+$/.test(t0) && /^\d{4}$/.test(t1);
        }) || null;
      }

      if (!calRoot) {
        return { success: false, message: 'select_antrian: calRoot kalender Tanggal Pemeriksaan tidak ditemukan' };
      }

      console.log('[CKG] select_antrian: calRoot=' + calRoot.className.split(' ').slice(0, 4).join('.'));

      // ── 3. Helper baca bulan/tahun dari btn[0] dan btn[1] ──────────────────
      function readCalHeader() {
        var btns = Array.from(calRoot.querySelectorAll('button'));
        if (btns.length < 2) return null;
        var moStr = (btns[0].innerText || '').trim().toLowerCase().slice(0, 3);
        var yrStr = (btns[1].innerText || '').trim();
        var mo = MONTHS[moStr];
        var yr = parseInt(yrStr);
        if (!mo || isNaN(yr)) {
          console.log('[CKG] select_antrian: readCalHeader GAGAL btn[0]="' + btns[0].innerText + '" btn[1]="' + btns[1].innerText + '"');
          return null;
        }
        return { month: mo, year: yr };
      }

      // ── 4. Navigasi ke bulan/tahun yang benar ────────────────────────────
      for (var ni = 0; ni < 36; ni++) {
        var cur = readCalHeader();
        if (!cur) break;
        var diff = (tYear - cur.year) * 12 + (tMonth - cur.month);
        if (diff === 0) break;

        // btn[2] = prev, btn[3] = next  (sesuai struktur kalender)
        var btnsNav = Array.from(calRoot.querySelectorAll('button'));
        if (btnsNav.length < 4) break;
        var navBtn = diff < 0 ? btnsNav[2] : btnsNav[3];
        navBtn.click();
        await sleep(300);
      }
      await sleep(300);

      var finalHeader = readCalHeader();
      console.log('[CKG] select_antrian: kalender setelah navigasi=' + JSON.stringify(finalHeader));

      // ── 5. Klik tombol tanggal yang sesuai ──────────────────────────────
      // btn[4+] berisi innerText="10\n42" (hari + slot)
      // Filter: baris pertama = angka = tDay, bukan disabled
      var allBtns = Array.from(calRoot.querySelectorAll('button'));
      var dateBtns = allBtns.slice(4); // skip btn[0..3] (bulan, tahun, prev, next)

      console.log('[CKG] select_antrian: date buttons=' + dateBtns.length);

      var clicked = false;
      for (var ci = 0; ci < dateBtns.length; ci++) {
        var btn = dateBtns[ci];
        var lines = (btn.innerText || '').trim().split('\n')
          .map(function(l) { return l.trim(); })
          .filter(Boolean);

        if (lines.length === 0) continue;
        var btnDay = parseInt(lines[0]);
        if (isNaN(btnDay) || btnDay !== tDay) continue;

        // Skip disabled
        var isDisabled = btn.disabled ||
                         btn.getAttribute('disabled') !== null ||
                         btn.classList.contains('disabled') ||
                         btn.classList.contains('opacity-50') ||
                         window.getComputedStyle(btn).pointerEvents === 'none';
        if (isDisabled) {
          console.log('[CKG] select_antrian: tanggal ' + btnDay + ' disabled, cari berikutnya...');
          continue;
        }

        btn.scrollIntoView({ block: 'center' });
        await sleep(100);
        btn.click();
        clicked = true;
        console.log('[CKG] select_antrian: ✓ klik tanggal ' + tDay + '/' + tMonth + '/' + tYear + ' | lines=' + JSON.stringify(lines));
        break;
      }

      await sleep(400);
      if (clicked) return { success: true, message: 'select_antrian: klik tanggal ' + tDay + '/' + tMonth + '/' + tYear };
      return { success: false, message: 'select_antrian: tanggal ' + tDay + ' tidak ditemukan di kalender (bulan=' + tMonth + '/' + tYear + ')' };

    } catch(e) {
      return { success: false, message: 'select_antrian: ' + e.message };
    }
  }

  async function doSelectPekerjaan(step, value, timeout) {
    if (!value) return { success: false, message: 'select_pekerjaan: value kosong' };
    try {
      var trigger = await waitForElement(step.selector, timeout, step.placeholder || null);
      trigger.click();
      await sleep(400);
      var searchInput = document.querySelector('input[placeholder*="cari"], input[placeholder*="search"], input[placeholder*="ketik"]');
      if (searchInput) {
        nativeInputValueSetter(searchInput, String(value));
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(600);
      }
      var optionEl = await findDropdownOption(String(value), 3000);
      if (!optionEl) return { success: false, message: 'select_pekerjaan: "' + value + '" tidak ditemukan' };
      optionEl.click();
      return { success: true, message: 'select_pekerjaan: OK "' + value + '"' };
    } catch(e) {
      return { success: false, message: 'select_pekerjaan: ' + e.message };
    }
  }

  async function doSelectAlamat(step, pasienData, timeout) {
    var levels = [
      { key: 'Provinsi',  placeholder: 'Pilih provinsi'  },
      { key: 'Kabupaten', placeholder: 'Pilih kabupaten' },
      { key: 'Kecamatan', placeholder: 'Pilih kecamatan' },
      { key: 'Kelurahan', placeholder: 'Pilih kelurahan' },
    ];
    for (var i = 0; i < levels.length; i++) {
      var level = levels[i];
      var val = pasienData[level.key];
      if (!val) continue;
      try {
        var trigger = await waitForElement('div', 4000, level.placeholder);
        trigger.scrollIntoView({ block: 'center' });
        trigger.click();
        await sleep(500);
        var optionEl = await findDropdownOption(String(val), 4000);
        if (!optionEl) return { success: false, message: 'select_alamat: "' + val + '" (' + level.key + ') tidak ditemukan' };
        optionEl.click();
        await sleep(600);
      } catch(e) {
        return { success: false, message: 'select_alamat [' + level.key + ']: ' + e.message };
      }
    }
    return { success: true, message: 'select_alamat: cascade OK' };
  }

  /**
   * click_button — cari <button> by teks, klik langsung tanpa selector.
   * step.buttonText = teks tombol (case-insensitive, partial match).
   * step.exact = true → exact match only.
   * step.condition.ifVisible = true → jika tombol tidak ada, skip (return success).
   */
  async function doClickButton(step, timeout) {
    var text = (step.buttonText || '').trim();
    if (!text) return { success: false, message: 'click_button: buttonText kosong' };
    var lower = text.toLowerCase();
    var exact = step.exact === true;
    var ifVisible = step.condition && step.condition.ifVisible === true;
    // Untuk ifVisible, gunakan timeout singkat (2 detik saja)
    var effectiveTimeout = ifVisible ? Math.min(timeout, 2000) : timeout;
    var deadline = Date.now() + effectiveTimeout;
    while (Date.now() < deadline) {
      var buttons = Array.from(document.querySelectorAll('button'));
      var match =
        buttons.find(function(b) { return b.innerText && b.innerText.trim().toLowerCase() === lower; }) ||
        (!exact && buttons.find(function(b) { return b.innerText && b.innerText.trim().toLowerCase().includes(lower); }));
      if (match) {
        match.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await sleep(200);
        match.click();
        return { success: true, message: 'click_button: OK "' + text + '"' };
      }
      await sleep(200);
    }
    if (ifVisible) {
      return { success: true, message: 'click_button: skip "' + text + '" (ifVisible=true, tombol tidak ada)' };
    }
    return { success: false, message: 'click_button: tombol "' + text + '" tidak ditemukan setelah ' + timeout + 'ms' };
  }

  /**
   * wait_button — tunggu <button> dengan teks muncul di DOM.
   * step.buttonText = teks tombol yang ditunggu.
   */
  async function doWaitButton(step, timeout) {
    var text = (step.buttonText || '').trim();
    if (!text) return { success: false, message: 'wait_button: buttonText kosong' };
    var lower = text.toLowerCase();
    var deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      var buttons = Array.from(document.querySelectorAll('button'));
      var match =
        buttons.find(function(b) { return b.innerText && b.innerText.trim().toLowerCase() === lower; }) ||
        buttons.find(function(b) { return b.innerText && b.innerText.trim().toLowerCase().includes(lower); });
      if (match) return { success: true, message: 'wait_button: muncul "' + text + '"' };
      await sleep(200);
    }
    return { success: false, message: 'wait_button: timeout menunggu tombol "' + text + '"' };
  }

  async function doQuizAnswer(step, value, timeout) {
    if (!value) return { success: false, message: 'quiz_answer: value kosong' };
    try {
      var questionTitle = step.selector || step.questionTitle;
      var allText = Array.from(document.querySelectorAll('p, span, label, div')).find(function(el){
        return el.innerText && el.innerText.trim().toLowerCase().includes(questionTitle.toLowerCase());
      });
      if (!allText) return { success: false, message: 'quiz_answer: pertanyaan "' + questionTitle + '" tidak ditemukan' };
      var container = allText.closest('[class*="question"], [class*="kuesioner"], form, .card, section') || allText.parentElement;
      var options = Array.from(container.querySelectorAll('button, [role="radio"], label, .option'));
      var tgt = options.find(function(o){ return o.innerText && o.innerText.trim().toLowerCase() === String(value).toLowerCase(); });
      if (!tgt) return { success: false, message: 'quiz_answer: opsi "' + value + '" tidak ditemukan' };
      tgt.click();
      return { success: true, message: 'quiz_answer: "' + questionTitle + '" \u2192 "' + value + '"' };
    } catch(e) {
      return { success: false, message: 'quiz_answer: ' + e.message };
    }
  }

  /**
   * run_schema_quiz — isi semua pertanyaan dari schema kuesioner yang sudah di-mapping.
   * step.schemaKey = nama screen schema (ckg_schema_<key>)
   * step.schemaData = schema object (dikirim dari background saat runtime)
   * Membaca answerMode per pertanyaan:
   *   direct_match → ambil nilai dari pasienData[excelColumn] → cocokkan ke opsi
   *   fixed         → selalu klik fixedAnswer
   *   skip          → lewati
   */
  async function doRunSchemaQuiz(step, pasienData, timeout) {
    var schema = step.schemaData;
    if (!schema || !schema.questions || !schema.questions.length) {
      return { success: false, message: 'run_schema_quiz: schema tidak ditemukan atau kosong' };
    }

    var results = [];
    var okCount = 0;
    var skipCount = 0;
    var failCount = 0;

    for (var qi = 0; qi < schema.questions.length; qi++) {
      var q = schema.questions[qi];
      var mode = q.answerMode || 'direct_match';

      if (mode === 'skip') {
        results.push('  [SKIP] ' + q.question);
        skipCount++;
        continue;
      }

      // Tentukan jawaban target
      var answerTarget = null;
      if (mode === 'fixed') {
        answerTarget = q.fixedAnswer;
      } else if (mode === 'direct_match') {
        var colVal = q.excelColumn ? (pasienData[q.excelColumn] || null) : null;

        if (colVal) {
          // Cari opsi yang labelnya paling cocok dengan nilai Excel
          var colValLower = String(colVal).toLowerCase().trim();
          var opts = q.options || [];
          // Exact match dulu
          var matched = opts.find(function(o) {
            return (o.label || o.value || o).toLowerCase() === colValLower;
          });
          // Partial match jika tidak exact
          if (!matched) {
            matched = opts.find(function(o) {
              var lbl = (o.label || o.value || o).toLowerCase();
              return lbl.includes(colValLower) || colValLower.includes(lbl);
            });
          }
          answerTarget = matched ? (matched.label || matched.value || matched) : colVal;
        }

        // Fallback: kolom kosong ATAU tidak ada yang cocok → pakai defaultFallback
        if (!answerTarget && q.defaultFallback) {
          answerTarget = q.defaultFallback;
          results.push('  [FALLBACK] ' + q.question + ' -> default: "' + q.defaultFallback + '"');
        } else if (!answerTarget) {
          results.push('  [SKIP] ' + q.question + ' (kolom ' + (q.excelColumn || '?') + ' kosong, tidak ada fallback)');
          skipCount++;
          continue;
        }
      }

      if (!answerTarget) {
        results.push('  [SKIP] ' + q.question + ' (tidak ada jawaban)');
        skipCount++;
        continue;
      }

      // Eksekusi seperti quiz_answer
      var qRes = await doQuizAnswer(
        { selector: q.question, questionTitle: q.question },
        answerTarget,
        timeout
      );

      if (qRes.success) {
        results.push('  [OK] ' + q.question + ' \u2192 "' + answerTarget + '"');
        okCount++;
      } else {
        results.push('  [FAIL] ' + q.question + ': ' + qRes.message);
        failCount++;
      }
      await sleep(300); // jeda antar pertanyaan
    }

    var summary = 'run_schema_quiz "' + (schema.displayName || schema.screen) + '": ' +
                  okCount + ' OK, ' + skipCount + ' skip, ' + failCount + ' gagal\n' +
                  results.join('\n');

    return {
      success: failCount === 0,
      message: summary,
    };
  }


  // ── Main executeStep ───────────────────────────────────────────────────

  window.__ckgExecuteStep = async function(step, pasienData, settings) {
    if (!pasienData) pasienData = {};
    if (!settings) settings = {};
    var delay = settings.stepDelayMs !== undefined ? settings.stepDelayMs : 500;
    var elTimeout = settings.elementTimeoutMs !== undefined ? settings.elementTimeoutMs : 8000;
    var value = resolveValue(step, pasienData);

    var result;
    try {
      switch (step.type) {
        case 'navigate':
          location.href = step.value;
          result = { success: true, message: 'navigate: redirect ' + step.value };
          break;
        case 'wait':            result = await doWait(step, elTimeout); break;
        case 'click':           result = await doClick(step, elTimeout); break;
        case 'type':            result = await doType(step, value, elTimeout); break;
        case 'select':          result = await doSelect(step, value, elTimeout); break;
        case 'scroll':          result = await doScroll(step, elTimeout); break;
        case 'date_picker':     result = await doDatePicker(step, value, elTimeout); break;
        case 'select_dropdown': result = await doSelectDropdown(step, value, elTimeout); break;
        case 'select_antrian':  result = await doSelectAntrian(step, value, elTimeout); break;
        case 'select_pekerjaan':result = await doSelectPekerjaan(step, value, elTimeout); break;
        case 'select_alamat':   result = await doSelectAlamat(step, pasienData, elTimeout); break;
        case 'quiz_answer':       result = await doQuizAnswer(step, value, elTimeout); break;
        case 'run_schema_quiz':    result = await doRunSchemaQuiz(step, pasienData, elTimeout); break;
        case 'click_button':    result = await doClickButton(step, elTimeout); break;
        case 'wait_button':     result = await doWaitButton(step, elTimeout); break;
        default:
          result = { success: false, message: 'Unknown step type: "' + step.type + '"' };
      }
    } catch(e) {
      result = { success: false, message: e.message };
    }

    if (delay > 0) await sleep(delay);
    return result;
  };

  console.log('[CKG] executor_inject.js loaded v3.1 ✓ (calRoot fix)');
})();
