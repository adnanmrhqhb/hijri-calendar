/*!
 * <hijri-calendar> — standalone Hijri (Misri / Dawoodi Bohra) calendar & date picker
 * Vanilla JavaScript Web Component. Zero dependencies. Shadow DOM for style isolation.
 *
 * Calendar arithmetic ported from mumineen_calendar_js by Murtaza Gulamali (MIT).
 *
 * Usage:
 *   <script src="hijri-calendar.js"></script>
 *   <input id="dob" type="text">
 *   <hijri-calendar target="#dob" popup></hijri-calendar>
 *
 * See README.md for all attributes, properties, events and theming hooks.
 */
(function (window, document) {
  "use strict";

  if (!window || !document || !window.customElements) return;

  // Optional auto-init from the <script> tag itself:
  //   <script src="hijri-calendar.js" data-target="#dob" data-popup data-format="hijri"></script>
  var currentScript = document.currentScript;
  function autoInit() {
    if (!currentScript || !currentScript.dataset || !currentScript.dataset.target) return;
    var create = function () {
      var el = document.createElement("hijri-calendar"), ds = currentScript.dataset;
      for (var key in ds) {
        if (!Object.prototype.hasOwnProperty.call(ds, key)) continue;
        el.setAttribute(key.replace(/[A-Z]/g, function (c) { return "-" + c.toLowerCase(); }), ds[key]);
      }
      var anchor = null;
      try { anchor = document.querySelector(ds.target); } catch (e) { anchor = null; }
      (anchor || currentScript).insertAdjacentElement("afterend", el);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", create);
    else create();
  }

  // Script included more than once: the element is already registered, only honour the data-* auto-init.
  if (window.customElements.get("hijri-calendar")) { autoInit(); return; }

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  var MIN_YEAR = 1000;
  var MAX_YEAR = 3000;

  // Hijri year remainders (mod 30) that are Kabisa (leap) years
  var KABISA_YEAR_REMAINDERS = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];

  // cumulative days in a Hijri year at the end of each month (months 0..10)
  var DAYS_IN_YEAR = [30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];

  // cumulative days in a 30-year cycle at the end of each year
  var DAYS_IN_30_YEARS = [
     354,  708, 1063, 1417, 1771, 2126, 2480, 2834,  3189,  3543,
    3898, 4252, 4606, 4961, 5315, 5669, 6024, 6378,  6732,  7087,
    7441, 7796, 8150, 8504, 8859, 9213, 9567, 9922, 10276, 10631
  ];

  var HIJRI_MONTHS_LONG = [
    "Moharram al-Haraam", "Safar al-Muzaffar", "Rabi al-Awwal", "Rabi al-Aakhar",
    "Jumada al-Ula", "Jumada al-Ukhra", "Rajab al-Asab", "Shabaan al-Karim",
    "Ramadaan al-Moazzam", "Shawwal al-Mukarram", "Zilqadah al-Haraam", "Zilhaj al-Haraam"
  ];

  var HIJRI_MONTHS_SHORT = [
    "Moharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II",
    "Rajab", "Shabaan", "Ramadaan", "Shawwal", "Zilqadah", "Zilhaj"
  ];

  var GREG_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var ARABIC_DIGITS = [
    "٠", "١", "٢", "٣", "٤",
    "٥", "٦", "٧", "٨", "٩"
  ];

  var FORMAT_PRESETS = {
    "iso":        "YYYY-MM-DD",
    "gregorian":  "D MMMM YYYY",
    "hijri":      "hD hMMMM hYYYYH",
    "hijri-iso":  "hYYYY-hMM-hDD",
    "both":       "hD hMMMM hYYYYH (D MMMM YYYY)"
  };

  /* ------------------------------------------------------------------ */
  /*  HijriDate                                                          */
  /* ------------------------------------------------------------------ */

  function HijriDate(year, month, day) {
    this.year = year;
    this.month = month; // 0-based
    this.day = day;     // 1-based
  }

  HijriDate.prototype.getYear = function () { return this.year; };
  HijriDate.prototype.getMonth = function () { return this.month; };
  HijriDate.prototype.getDate = function () { return this.day; };

  HijriDate.getMonthName = function (month) { return HIJRI_MONTHS_LONG[month]; };
  HijriDate.getShortMonthName = function (month) { return HIJRI_MONTHS_SHORT[month]; };

  // is the specified Gregorian Date object a Julian date?
  HijriDate.isJulian = function (date) {
    var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    if (y < 1582) return true;
    if (y === 1582) {
      if (m < 9) return true;
      if (m === 9 && d < 5) return true;
    }
    return false;
  };

  // Astronomical Julian Date for the given Gregorian Date object
  HijriDate.gregorianToAJD = function (date) {
    var a, b,
        year = date.getFullYear(),
        month = date.getMonth() + 1,
        day = date.getDate()
            + date.getHours() / 24
            + date.getMinutes() / 1440
            + date.getSeconds() / 86400
            + date.getMilliseconds() / 86400000;
    if (month < 3) {
      year--;
      month += 12;
    }
    if (HijriDate.isJulian(date)) {
      b = 0;
    } else {
      a = Math.floor(year / 100);
      b = 2 - a + Math.floor(a / 4);
    }
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
  };

  // Gregorian Date object (local midnight) for the given Astronomical Julian Date
  HijriDate.ajdToGregorian = function (ajd) {
    var a, b, c, d, e, z, alpha, year, month, day;
    z = Math.floor(ajd + 0.5);
    if (z < 2299161) {
      a = z;
    } else {
      alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(0.25 * alpha);
    }
    b = a + 1524;
    c = Math.floor((b - 122.1) / 365.25);
    d = Math.floor(365.25 * c);
    e = Math.floor((b - d) / 30.6001);
    day = b - d - Math.floor(30.6001 * e);
    month = (e < 14) ? (e - 2) : (e - 14);
    year = (month < 2) ? (c - 4715) : (c - 4716);
    var out = new Date(year, month, day, 0, 0, 0, 0);
    out.setFullYear(year); // guard against the two-digit-year quirk of the Date constructor
    return out;
  };

  HijriDate.isKabisa = function (year) {
    return KABISA_YEAR_REMAINDERS.indexOf(year % 30) !== -1;
  };

  HijriDate.daysInMonth = function (year, month) {
    return ((month === 11 && HijriDate.isKabisa(year)) || (month % 2 === 0)) ? 30 : 29;
  };

  HijriDate.prototype.dayOfYear = function () {
    return (this.month === 0) ? this.day : (DAYS_IN_YEAR[this.month - 1] + this.day);
  };

  HijriDate.fromAJD = function (ajd) {
    var year, month, date,
        i = 0,
        left = Math.floor(ajd - 1948083.5),
        // `left` is a 1-based day count, so the last day of a 30-year cycle (day 10631)
        // must still map to that cycle. (Fixes "0 Moharram" on 30 Zilhaj of years ending in 29.)
        y30 = Math.floor((left - 1) / 10631.0);

    left -= y30 * 10631;
    while (left > DAYS_IN_30_YEARS[i]) i += 1;

    year = Math.round(y30 * 30.0 + i);
    if (i > 0) left -= DAYS_IN_30_YEARS[i - 1];

    i = 0;
    while (left > DAYS_IN_YEAR[i]) i += 1;

    month = Math.round(i);
    date = (i > 0) ? Math.round(left - DAYS_IN_YEAR[i - 1]) : Math.round(left);

    return new HijriDate(year, month, date);
  };

  HijriDate.prototype.toAJD = function () {
    var y30 = Math.floor(this.year / 30.0),
        ajd = 1948083.5 + y30 * 10631 + this.dayOfYear();
    if (this.year % 30 !== 0) {
      ajd += DAYS_IN_30_YEARS[this.year - y30 * 30 - 1];
    }
    return ajd;
  };

  HijriDate.fromGregorian = function (date) {
    return HijriDate.fromAJD(HijriDate.gregorianToAJD(date));
  };

  HijriDate.prototype.toGregorian = function () {
    return HijriDate.ajdToGregorian(this.toAJD());
  };

  HijriDate.prototype.toString = function () {
    return this.day + " " + HIJRI_MONTHS_LONG[this.month] + " " + this.year + "H";
  };

  /* ------------------------------------------------------------------ */
  /*  HijriCalendar (one month view)                                     */
  /* ------------------------------------------------------------------ */

  function HijriCalendar(year, month, iso8601) {
    this.year = year;
    this.month = month;
    this.iso8601 = !!iso8601; // true => weeks start on Monday
  }

  HijriCalendar.getMinYear = function () { return MIN_YEAR; };
  HijriCalendar.getMaxYear = function () { return MAX_YEAR; };

  HijriCalendar.prototype.getYear = function () { return this.year; };
  HijriCalendar.prototype.getMonth = function () { return this.month; };
  HijriCalendar.prototype.isISO = function () { return this.iso8601; };

  // 0..6, where 0 is Sunday (or Monday when iso8601)
  HijriCalendar.prototype.dayOfWeek = function (date) {
    var hijriDate = new HijriDate(this.year, this.month, date),
        offset = this.iso8601 ? 0.5 : 1.5;
    return (hijriDate.toAJD() + offset) % 7;
  };

  HijriCalendar.prototype.days = function () {
    var out = [], n = HijriDate.daysInMonth(this.year, this.month);
    for (var d = 1; d <= n; d++) out.push(dayHash(new HijriDate(this.year, this.month, d), false));
    return out;
  };

  HijriCalendar.prototype.previousDays = function () {
    var out = [],
        prev = this.previousMonth(),
        daysInPrev = HijriDate.daysInMonth(prev.getYear(), prev.getMonth()),
        lead = this.dayOfWeek(1);

    if (this.month === 0 && this.year === MIN_YEAR) {
      for (var k = 0; k < lead; k++) out.push(null);
      return out;
    }
    for (var i = 0; i < lead; i++) {
      out.push(dayHash(new HijriDate(prev.getYear(), prev.getMonth(), daysInPrev - lead + i + 1), true));
    }
    return out;
  };

  HijriCalendar.prototype.nextDays = function () {
    var out = [],
        next = this.nextMonth(),
        daysInMonth = HijriDate.daysInMonth(this.year, this.month),
        trail = 6 - this.dayOfWeek(daysInMonth);

    if (next.getYear() === this.year && next.getMonth() === this.month) {
      for (var k = 0; k < trail; k++) out.push(null);
      return out;
    }
    for (var i = 0; i < trail; i++) {
      out.push(dayHash(new HijriDate(next.getYear(), next.getMonth(), i + 1), true));
    }
    return out;
  };

  HijriCalendar.prototype.weeks = function () {
    var all = this.previousDays().concat(this.days(), this.nextDays()), weeks = [];
    for (var i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  };

  HijriCalendar.prototype.previousMonth = function () {
    var year = (this.month === 0 && this.year > MIN_YEAR) ? (this.year - 1) : this.year, month;
    if (this.month === 0 && this.year === MIN_YEAR) month = this.month;
    else if (this.month === 0) month = 11;
    else month = this.month - 1;
    return new HijriCalendar(year, month, this.iso8601);
  };

  HijriCalendar.prototype.nextMonth = function () {
    var year = (this.month === 11 && this.year < MAX_YEAR) ? (this.year + 1) : this.year, month;
    if (this.month === 11 && this.year === MAX_YEAR) month = this.month;
    else if (this.month === 11) month = 0;
    else month = this.month + 1;
    return new HijriCalendar(year, month, this.iso8601);
  };

  HijriCalendar.prototype.previousYear = function () {
    return new HijriCalendar(Math.max(MIN_YEAR, this.year - 1), this.month, this.iso8601);
  };

  HijriCalendar.prototype.nextYear = function () {
    return new HijriCalendar(Math.min(MAX_YEAR, this.year + 1), this.month, this.iso8601);
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function dayHash(hijriDate, isFiller) {
    var g = hijriDate.toGregorian();
    return {
      hijri: { year: hijriDate.getYear(), month: hijriDate.getMonth(), date: hijriDate.getDate() },
      gregorian: { year: g.getFullYear(), month: g.getMonth(), date: g.getDate() },
      ajd: hijriDate.toAJD(),
      filler: isFiller ? true : undefined
    };
  }

  function dayFromHijri(y, m, d) { return dayHash(new HijriDate(y, m, d), false); }
  function dayFromDate(date) { return dayHash(HijriDate.fromGregorian(date), false); }
  function dayFromAJD(ajd) { return dayHash(HijriDate.fromAJD(ajd), false); }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function toArabicNumerals(x) {
    var s = String(Math.floor(x)), out = "";
    for (var i = 0; i < s.length; i++) out += ARABIC_DIGITS[parseInt(s.charAt(i), 10)];
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var TOKEN_RE = /\[([^\]]*)\]|hMMMM|hMMM|hYYYY|hMM|hM|hDD|hD|MMMM|MMM|YYYY|MM|M|DD|D/g;

  // Format a day hash with a token template.
  //   Gregorian: YYYY MM M DD D MMM MMMM     Hijri: hYYYY hMM hM hDD hD hMMM hMMMM
  //   [literal text] is emitted verbatim.
  function formatDay(day, template) {
    var h = day.hijri, g = day.gregorian;
    template = FORMAT_PRESETS[template] || template || FORMAT_PRESETS.iso;
    return template.replace(TOKEN_RE, function (tok, literal) {
      if (literal !== undefined) return literal;
      switch (tok) {
        case "hMMMM": return HIJRI_MONTHS_LONG[h.month];
        case "hMMM":  return HIJRI_MONTHS_SHORT[h.month];
        case "hYYYY": return String(h.year);
        case "hMM":   return pad2(h.month + 1);
        case "hM":    return String(h.month + 1);
        case "hDD":   return pad2(h.date);
        case "hD":    return String(h.date);
        case "MMMM":  return GREG_MONTHS[g.month];
        case "MMM":   return GREG_MONTHS[g.month].substr(0, 3);
        case "YYYY":  return String(g.year);
        case "MM":    return pad2(g.month + 1);
        case "M":     return String(g.month + 1);
        case "DD":    return pad2(g.date);
        case "D":     return String(g.date);
      }
      return tok;
    });
  }

  function hijriLong(day) { return formatDay(day, "hijri"); }
  function gregorianLong(day) { return formatDay(day, "gregorian"); }

  function findHijriMonth(name) {
    var n = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var i = 0; i < 12; i++) {
      var l = HIJRI_MONTHS_LONG[i].toLowerCase().replace(/[^a-z0-9]/g, ""),
          s = HIJRI_MONTHS_SHORT[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (n === l || n === s || (n.length >= 4 && l.indexOf(n) === 0)) return i;
    }
    return -1;
  }

  // Parse user-supplied value into a day hash (or null).
  // Accepts: Date; "YYYY-MM-DD" (Gregorian); "YYYY-MM-DDH" (Hijri, 1-based month);
  //          "D Monthname YYYYH" (Hijri); anything Date.parse understands.
  function parseValue(input, preferHijri) {
    if (input == null || input === "") return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : dayFromDate(input);
    if (typeof input === "object" && typeof input.year === "number") {
      return validHijri(input.year, input.month, input.date);
    }
    var str = String(input).trim(), m;

    m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s*(H)?$/i.exec(str);
    if (m) {
      var y = +m[1], mo = +m[2] - 1, d = +m[3];
      if (m[4] || preferHijri) return validHijri(y, mo, d);
      var dt = new Date(y, mo, d);
      dt.setFullYear(y);
      if (dt.getMonth() !== mo || dt.getDate() !== d) return null;
      return dayFromDate(dt);
    }

    m = /^(\d{1,2})\s+([A-Za-z][A-Za-z\s\-']*?)\s+(\d{4})\s*H$/i.exec(str);
    if (m) {
      var hm = findHijriMonth(m[2]);
      return hm < 0 ? null : validHijri(+m[3], hm, +m[1]);
    }

    var t = Date.parse(str);
    if (!isNaN(t)) return dayFromDate(new Date(t));
    return null;
  }

  function validHijri(y, m, d) {
    if (!(y >= MIN_YEAR && y <= MAX_YEAR)) return null;
    if (!(m >= 0 && m <= 11)) return null;
    if (!(d >= 1 && d <= HijriDate.daysInMonth(y, m))) return null;
    return dayFromHijri(y, m, d);
  }

  function sameDay(a, b) {
    return !!a && !!b &&
      a.hijri.year === b.hijri.year && a.hijri.month === b.hijri.month && a.hijri.date === b.hijri.date;
  }

  // Original-site label for the small Gregorian text in a cell
  function gregorianCellLabel(day) {
    var g = day.gregorian, s = String(g.date);
    if (!day.filler) {
      if (day.hijri.date === 1 || g.date === 1) s += " " + GREG_MONTHS[g.month].substr(0, 3);
      if (day.hijri.date === 1 || (g.month === 0 && g.date === 1)) s += " " + g.year;
    }
    return s;
  }

  function miqaatsForDay(miqaats, day) {
    var out = [], h = day.hijri;
    for (var i = 0; i < miqaats.length; i++) {
      var entry = miqaats[i];
      if (entry.month !== h.month || entry.date !== h.date || !entry.miqaats) continue;
      for (var j = 0; j < entry.miqaats.length; j++) {
        var m = entry.miqaats[j];
        if (!m.year || m.year <= h.year) out.push(m);
      }
    }
    return out;
  }

  // ---- miqaat badges -------------------------------------------------
  var BADGE_ICONS = {
    crown:   '<svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8zM5 19.5h14v2.2H5z"/></svg>',
    drop:    '<svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c3.6 4.3 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.4-6.3 6-10.6z"/></svg>',
    sparkle: '<svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 4.8 2.2 7.4 10 10-7.8 2.6-9.4 5.2-10 10-.6-4.8-2.2-7.4-10-10 7.8-2.6 9.4-5.2 10-10z"/></svg>',
    moon:    '<svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8z"/></svg>',
    dot:     '<svg class="badge-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>'
  };

  // Which visual treatment a miqaat gets: urus (crown), shahadat (drop), festive (sparkle),
  // night (moon) or minor (dot). Based on the title first, then the data's priority/phase.
  function miqaatKind(m) {
    var title = (m && m.title) || "";
    if (/\b(urus|urs)\b/i.test(title)) return "urus";
    if (/shahadat|shahaadat|ashura|suyum|chehlum|wafat/i.test(title)) return "shahadat";
    if (/\b(eid|milad|wiladat|new year|ghadeer)\b/i.test(title)) return "festive";
    if (m && m.priority === 1 && m.phase === "night") return "night";
    if (m && m.priority === 1) return "festive";
    return "minor";
  }

  var KIND_ICON = { urus: "crown", shahadat: "drop", festive: "sparkle", night: "moon", minor: "dot" };

  // Most important first (priority 1 before 2 before 3), otherwise keep the data's order.
  function sortMiqaats(list) {
    return list
      .map(function (m, i) { return { m: m, i: i }; })
      .sort(function (a, b) { return ((a.m.priority || 9) - (b.m.priority || 9)) || (a.i - b.i); })
      .map(function (x) { return x.m; });
  }

  function badgeHtml(m) {
    var kind = miqaatKind(m), title = escapeHtml(m.title);
    return '<div class="miqaat-badge k-' + kind + '" part="miqaat-badge miqaat-' + kind + '" title="' + title + '">' +
      BADGE_ICONS[KIND_ICON[kind]] + '<span class="label">' + title + "</span></div>";
  }

  // Badge strip for one cell: up to `max` pills plus a "+N more" note.
  function badgesHtml(list, max) {
    if (!list.length) return "";
    var shown = list.slice(0, max), more = list.length - shown.length, html = '<div class="miqaat-badges" part="miqaat-badges">';
    for (var i = 0; i < shown.length; i++) html += badgeHtml(shown[i]);
    if (more > 0) html += '<div class="more" part="miqaat-more"><span class="more-long">+' + more + ' more</span><span class="more-short">+' + more + "</span></div>";
    return html + "</div>";
  }

  // Set an input's value the way React/Vue expect (native setter + events)
  function setNativeValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function fire(el, type, detail) {
    el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable: false, detail: detail }));
  }

  /* ------------------------------------------------------------------ */
  /*  Template                                                           */
  /* ------------------------------------------------------------------ */

  var STYLE = [
    ":host{",
    "  --hc-font:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "  --hc-font-size:16px;",
    "  --hc-bg:#fff;",
    "  --hc-fg:#333;",
    "  --hc-muted:#9a9a9a;",
    "  --hc-border:#ddd;",
    "  --hc-accent:#477dca;",
    "  --hc-accent-fg:#fff;",
    "  --hc-hover-bg:#eef2f8;",
    "  --hc-today-bg:#c3f393;",
    "  --hc-today-fg:#1f3b08;",
    "  --hc-radius:6px;",
    "  --hc-cell-height:4.5em;",
    "  --hc-kind-urus:#d19a00;",
    "  --hc-kind-shahadat:#b83a3a;",
    "  --hc-kind-festive:#2e9b61;",
    "  --hc-kind-night:#4a5bd6;",
    "  --hc-kind-minor:#8a8f98;",
    "  --hc-shadow:0 8px 24px rgba(0,0,0,.18);",
    "  display:block;box-sizing:border-box;",
    "  font:var(--hc-font-size)/1.4 var(--hc-font);color:var(--hc-fg);background:var(--hc-bg);",
    "  border:1px solid var(--hc-border);border-radius:var(--hc-radius);max-width:100%;",
    "  -webkit-user-select:none;user-select:none;",
    "}",
    ":host([hidden]){display:none}",
    ":host([popup]){display:none;position:fixed;z-index:2147483000;width:22em;box-shadow:var(--hc-shadow);--hc-cell-height:3.1em;--hc-font-size:14px}",
    ":host([popup][open]){display:block}",
    ":host([popup]) .hijri{font-size:1.35em}",
    "*,*::before,*::after{box-sizing:inherit}",
    ".frame{padding:.75em;container-type:inline-size}",
    ".year-row{display:flex;align-items:center;justify-content:space-between;gap:.5em}",
    ".year-controls{display:flex;align-items:center;gap:.15em}",
    "h2,h3,h4{margin:0;font-weight:600;line-height:1.2}",
    "h2{font-size:1.25em;min-width:4.2em;text-align:center}",
    "button{font:inherit;color:var(--hc-accent);background:none;border:0;border-radius:var(--hc-radius);cursor:pointer;padding:.2em .45em;line-height:1}",
    "button:hover{background:var(--hc-hover-bg)}",
    "button:focus-visible{outline:2px solid var(--hc-accent);outline-offset:1px}",
    "button[disabled]{opacity:.3;cursor:default;background:none}",
    "button.nav{font-size:1.4em;width:1.5em;height:1.5em;display:inline-flex;align-items:center;justify-content:center;padding:0}",
    "button.today{border:1px solid var(--hc-border);padding:.4em .8em;font-size:.85em;color:var(--hc-fg)}",
    ".month-row{display:flex;align-items:center;justify-content:space-between;margin:.4em 0 .6em}",
    ".month-title{flex:1;text-align:center}",
    "h3{font-size:1.1em}",
    ".greg-range{font-size:.75em;color:var(--hc-muted)}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed}",
    "table:focus-visible{outline:2px solid var(--hc-accent);outline-offset:2px}",
    "th{font-size:.72em;font-weight:600;color:var(--hc-muted);text-transform:uppercase;letter-spacing:.04em;padding:.35em 0}",
    "td{position:relative;height:var(--hc-cell-height);border:1px solid var(--hc-border);padding:0;vertical-align:top;overflow:hidden}",
    "td.day{cursor:pointer}",
    "td.day:hover{background:var(--hc-hover-bg)}",
    "td.filler{color:var(--hc-muted)}",
    ".k-urus{--k:var(--hc-kind-urus)}",
    ".k-shahadat{--k:var(--hc-kind-shahadat)}",
    ".k-festive{--k:var(--hc-kind-festive)}",
    ".k-night{--k:var(--hc-kind-night)}",
    ".k-minor{--k:var(--hc-kind-minor)}",
    "td.has-miqaat{background:color-mix(in srgb,var(--k) 7%,var(--hc-bg));border-color:color-mix(in srgb,var(--k) 30%,var(--hc-border))}",
    "td.today{background:var(--hc-today-bg);color:var(--hc-today-fg)}",
    "td.selected,td.selected:hover{background:var(--hc-accent);color:var(--hc-accent-fg)}",
    "td.selected .badge-icon,td.selected .more{color:var(--hc-accent-fg)}",
    "td.selected .miqaat-badge{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.45);color:var(--hc-accent-fg)}",
    "td.selected .gregorian,td.today .gregorian{color:inherit}",
    "td.disabled{cursor:not-allowed;opacity:.35}",
    "td.disabled:hover{background:none}",
    "td.focus{outline:2px solid var(--hc-accent);outline-offset:-2px}",
    "td.selected.focus{outline-color:var(--hc-accent-fg)}",
    ".hijri{position:absolute;top:0;right:.15em;font-size:1.7em;line-height:1.15}",
    ".gregorian{position:absolute;bottom:0;left:0;padding:.15em .3em;font-size:.68em;line-height:1.2;white-space:nowrap}",
    "/* Miqaat badges. Compact (narrow grid / popup): icon-only markers centred in the cell, like the original site. */",
    ".cell,.cell-head{display:contents}",
    ".miqaat-badges{position:absolute;top:0;right:0;bottom:0;left:0;padding-top:.5em;display:flex;align-items:center;justify-content:center;gap:.15em;pointer-events:none}",
    ".miqaat-badge{display:flex;align-items:center;min-width:0}",
    ".badge-icon{width:1.05em;height:1.05em;flex:none;fill:currentColor;color:var(--k)}",
    ".label,.more-long{display:none}",
    ".more{font-size:.62em;font-weight:700;color:var(--hc-muted)}",
    "/* Wide grid: each miqaat becomes a pill with its icon and a truncated title, below the date numbers. */",
    "@container (min-width:641px){",
    "  td{height:calc(var(--hc-cell-height) + 1.2em)}",
    "  .cell{display:block;padding:.3em .4em .4em}",
    "  .cell-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.3em}",
    "  .hijri{position:static;order:2;flex:none;padding:0;font-size:1.45em;line-height:1.1}",
    "  .gregorian{position:static;order:1;min-width:0;overflow:hidden;text-overflow:ellipsis;padding:.2em 0 0;font-size:.72em;color:var(--hc-muted)}",
    "  .miqaat-badges{position:static;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:.2em;margin-top:.35em;padding:0;pointer-events:auto}",
    "  .miqaat-badge{gap:.3em;padding:.14em .4em;border:1px solid #ddd;border-radius:5px;background:#f4f4f4;color:inherit;font-size:.74em;font-weight:600;line-height:1.3}",
    "  .miqaat-badge{background:color-mix(in srgb,var(--k) 16%,var(--hc-bg));border-color:color-mix(in srgb,var(--k) 45%,var(--hc-bg));color:color-mix(in srgb,var(--k) 52%,var(--hc-fg))}",
    "  .label{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "  .more{padding:0 .2em;font-size:.72em}",
    "  .more-long{display:inline}",
    "  .more-short{display:none}",
    "}",
    ".miqaat-list{margin:.6em 0 0;padding:.6em .2em 0;border-top:1px solid var(--hc-border);font-size:.85em;text-align:left}",
    ".miqaat-list[hidden]{display:none}",
    ".miqaat-list h4{font-size:1em;margin-bottom:.3em}",
    ".miqaat-list ul{margin:0;padding-left:1.2em;list-style:square}",
    ".miqaat-list li{margin:.15em 0}",
    ".miqaat-list .description{display:block;font-style:italic;color:var(--hc-muted);font-size:.9em}",
    ".miqaat-list .none{list-style:none;margin-left:-1.2em;color:var(--hc-muted)}",
    ":host([theme=dark]){--hc-bg:#1c1c1e;--hc-fg:#e6e6e6;--hc-muted:#8e8e93;--hc-border:#3a3a3c;--hc-hover-bg:#2c2c2e;--hc-today-bg:#2d5a1b;--hc-today-fg:#d8f7c4;--hc-kind-urus:#f0b429;--hc-kind-shahadat:#e5706b;--hc-kind-festive:#4cc38a;--hc-kind-night:#8c9bff;--hc-kind-minor:#9a9aa0}",
    "@media (prefers-color-scheme:dark){",
    "  :host(:not([theme=light])){--hc-bg:#1c1c1e;--hc-fg:#e6e6e6;--hc-muted:#8e8e93;--hc-border:#3a3a3c;--hc-hover-bg:#2c2c2e;--hc-today-bg:#2d5a1b;--hc-today-fg:#d8f7c4;--hc-kind-urus:#f0b429;--hc-kind-shahadat:#e5706b;--hc-kind-festive:#4cc38a;--hc-kind-night:#8c9bff;--hc-kind-minor:#9a9aa0}",
    "}"
  ].join("\n");

  var TEMPLATE =
    "<style>" + STYLE + "</style>" +
    '<div class="frame" part="frame">' +
    '  <div class="year-row" part="header">' +
    '    <div class="year-controls">' +
    '      <button type="button" class="nav" part="button nav" data-action="prev-year" aria-label="Previous year" title="Previous year">−</button>' +
    '      <h2 class="year" part="year" aria-live="polite"></h2>' +
    '      <button type="button" class="nav" part="button nav" data-action="next-year" aria-label="Next year" title="Next year">+</button>' +
    "    </div>" +
    '    <button type="button" class="today" part="button today" data-action="today">Today</button>' +
    "  </div>" +
    '  <div class="month-row" part="month-row">' +
    '    <button type="button" class="nav" part="button nav" data-action="prev-month" aria-label="Previous month" title="Previous month">‹</button>' +
    '    <div class="month-title"><h3 class="month" part="month" aria-live="polite"></h3><div class="greg-range" part="gregorian-range"></div></div>' +
    '    <button type="button" class="nav" part="button nav" data-action="next-month" aria-label="Next month" title="Next month">›</button>' +
    "  </div>" +
    '  <table role="grid" part="grid" aria-label="Hijri calendar" tabindex="0"><thead><tr></tr></thead><tbody></tbody></table>' +
    '  <div class="miqaat-list" part="miqaats" hidden></div>' +
    "</div>";

  /* ------------------------------------------------------------------ */
  /*  <hijri-calendar>                                                    */
  /* ------------------------------------------------------------------ */

  var HijriCalendarElement = /** @class */ (function (_super) {
    function HijriCalendarElement() {
      var self = Reflect.construct(_super, [], new.target || HijriCalendarElement);
      var root = self.attachShadow({ mode: "open" });
      root.innerHTML = TEMPLATE;

      self._root = root;
      self._today = dayFromDate(new Date());
      self._view = new HijriCalendar(self._today.hijri.year, self._today.hijri.month, false);
      self._selected = null;
      self._cursorAjd = null;
      self._miqaats = [];
      self._target = null;
      self._targetHijri = null;
      self._writing = false;
      self._connected = false;

      self._els = {
        year: root.querySelector(".year"),
        month: root.querySelector(".month"),
        range: root.querySelector(".greg-range"),
        table: root.querySelector("table"),
        thead: root.querySelector("thead tr"),
        tbody: root.querySelector("tbody"),
        miqaats: root.querySelector(".miqaat-list"),
        buttons: {}
      };
      var btns = root.querySelectorAll("[data-action]");
      for (var i = 0; i < btns.length; i++) self._els.buttons[btns[i].getAttribute("data-action")] = btns[i];

      self._onRootClick = self._onRootClick.bind(self);
      self._onGridKeydown = self._onGridKeydown.bind(self);
      self._onTargetFocus = self._onTargetFocus.bind(self);
      self._onTargetChange = self._onTargetChange.bind(self);
      self._onTargetKeydown = self._onTargetKeydown.bind(self);
      self._onDocPointerDown = self._onDocPointerDown.bind(self);
      self._onDocKeydown = self._onDocKeydown.bind(self);
      self._onReposition = self._onReposition.bind(self);
      self._onDomReady = self._onDomReady.bind(self);
      return self;
    }

    HijriCalendarElement.prototype = Object.create(_super.prototype, {
      constructor: { value: HijriCalendarElement, writable: true, configurable: true }
    });
    Object.setPrototypeOf(HijriCalendarElement, _super);

    Object.defineProperty(HijriCalendarElement, "observedAttributes", {
      get: function () {
        return ["target", "target-hijri", "value", "week-start", "numerals", "min", "max", "miqaats-url", "popup", "format", "hijri-format", "hide-miqaats", "max-badges"];
      }
    });

    var P = HijriCalendarElement.prototype;

    /* ---- lifecycle ---- */

    P.connectedCallback = function () {
      this._connected = true;
      this._root.addEventListener("click", this._onRootClick);
      this._els.table.addEventListener("keydown", this._onGridKeydown);

      this._applyWeekStart();
      this._bindTargets();

      if (!this._selected) {
        var fromAttr = parseValue(this.getAttribute("value"), this._prefersHijriInput());
        if (fromAttr) {
          this._select(fromAttr, { write: true, emit: false });
        } else if (this._target && this._target.value) {
          var fromTarget = parseValue(this._target.value, this._prefersHijriInput());
          if (fromTarget) this._select(fromTarget, { write: false, emit: false });
        }
      }

      if (this.hasAttribute("miqaats-url")) this._loadMiqaats(this.getAttribute("miqaats-url"));
      this._render();
    };

    P.disconnectedCallback = function () {
      this._connected = false;
      this._root.removeEventListener("click", this._onRootClick);
      this._els.table.removeEventListener("keydown", this._onGridKeydown);
      this._unbindTargets();
      this._teardownPopupListeners();
      document.removeEventListener("DOMContentLoaded", this._onDomReady);
    };

    P.attributeChangedCallback = function (name, oldVal, newVal) {
      if (!this._connected || oldVal === newVal) return;
      switch (name) {
        case "target":
        case "target-hijri":
          this._bindTargets();
          break;
        case "value":
          this._select(parseValue(newVal, this._prefersHijriInput()), { write: true, emit: false });
          break;
        case "week-start":
          this._applyWeekStart();
          this._render();
          break;
        case "miqaats-url":
          if (newVal) this._loadMiqaats(newVal); else this.miqaats = [];
          break;
        case "popup":
          if (newVal === null) this.close();
          break;
        case "format":
        case "hijri-format":
          if (this._selected) this._writeTargets(this._selected);
          break;
        default:
          this._render();
      }
    };

    /* ---- public API ---- */

    Object.defineProperties(P, {
      // Selected Gregorian Date (local midnight) or null
      value: {
        get: function () {
          if (!this._selected) return null;
          var g = this._selected.gregorian, d = new Date(g.year, g.month, g.date);
          d.setFullYear(g.year);
          return d;
        },
        set: function (v) {
          this._select(parseValue(v, this._prefersHijriInput()), { write: true, emit: false });
        }
      },
      // Selected Hijri date as {year, month (0-based), date} or null
      hijriValue: {
        get: function () {
          if (!this._selected) return null;
          var h = this._selected.hijri;
          return { year: h.year, month: h.month, date: h.date };
        },
        set: function (v) {
          this._select(v ? validHijri(v.year, v.month, v.date) : null, { write: true, emit: false });
        }
      },
      // Full detail object for the selected day (same shape as the hijri-change event detail)
      selected: {
        get: function () { return this._selected ? this._detail(this._selected) : null; }
      },
      // Miqaat data (same JSON shape as mumineen_calendar_js/source/data/miqaats.json)
      miqaats: {
        get: function () { return this._miqaats; },
        set: function (list) {
          this._miqaats = Array.isArray(list) ? list : [];
          if (this._connected) this._render();
        }
      },
      // Explicitly set the target input element instead of using the `target` attribute
      targetElement: {
        get: function () { return this._target; },
        set: function (el) {
          this._unbindTargets();
          this._target = el || null;
          this._targetHijri = this._resolve(this.getAttribute("target-hijri"));
          this._attachTargetListeners();
        }
      },
      isOpen: {
        get: function () { return this.hasAttribute("open"); }
      }
    });

    P.open = function () {
      if (!this.hasAttribute("popup") || this.hasAttribute("open")) return;
      this.setAttribute("open", "");
      this._setupPopupListeners();
      this._position();
      fire(this, "hijri-open", {});
    };

    P.close = function () {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this._teardownPopupListeners();
      fire(this, "hijri-close", {});
    };

    P.toggle = function () { this.isOpen ? this.close() : this.open(); };

    P.goToToday = function () {
      this._today = dayFromDate(new Date());
      this._cursorAjd = this._today.ajd;
      this._setView(this._today.hijri.year, this._today.hijri.month);
    };

    // Navigate the view to a Hijri year/month (0-based month) without changing the selection
    P.goTo = function (year, month) {
      this._setView(Math.min(MAX_YEAR, Math.max(MIN_YEAR, year | 0)), Math.min(11, Math.max(0, month | 0)));
    };

    P.clear = function () { this._select(null, { write: true, emit: true }); };

    // Format any Date / Hijri {year,month,date} / parseable string with a template or preset
    P.format = function (value, template) {
      var day = parseValue(value, false);
      return day ? formatDay(day, template || this.getAttribute("format") || "iso") : "";
    };

    /* ---- internals: targets ---- */

    P._resolve = function (selector) {
      if (!selector) return null;
      var scope = this.getRootNode && this.getRootNode();
      var el = null;
      try {
        if (scope && scope.querySelector && scope !== document) el = scope.querySelector(selector);
        if (!el) el = document.querySelector(selector);
      } catch (e) { el = null; }
      return el;
    };

    P._bindTargets = function () {
      this._unbindTargets();
      this._target = this._resolve(this.getAttribute("target"));
      this._targetHijri = this._resolve(this.getAttribute("target-hijri"));
      if (!this._target && this.getAttribute("target") && document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", this._onDomReady);
      }
      this._attachTargetListeners();
    };

    P._onDomReady = function () {
      document.removeEventListener("DOMContentLoaded", this._onDomReady);
      this._bindTargets();
      if (this._target && !this._selected && this._target.value) {
        var d = parseValue(this._target.value, this._prefersHijriInput());
        if (d) this._select(d, { write: false, emit: false });
      }
    };

    P._attachTargetListeners = function () {
      var t = this._target;
      if (!t) return;
      t.addEventListener("focus", this._onTargetFocus);
      t.addEventListener("click", this._onTargetFocus);
      t.addEventListener("change", this._onTargetChange);
      t.addEventListener("keydown", this._onTargetKeydown);
      if (this.hasAttribute("popup") && !t.getAttribute("aria-haspopup")) t.setAttribute("aria-haspopup", "dialog");
      if (this.hasAttribute("popup") && !t.getAttribute("autocomplete")) t.setAttribute("autocomplete", "off");
    };

    P._unbindTargets = function () {
      var t = this._target;
      if (t) {
        t.removeEventListener("focus", this._onTargetFocus);
        t.removeEventListener("click", this._onTargetFocus);
        t.removeEventListener("change", this._onTargetChange);
        t.removeEventListener("keydown", this._onTargetKeydown);
      }
      this._target = null;
      this._targetHijri = null;
    };

    P._prefersHijriInput = function () {
      var f = this.getAttribute("format");
      return f === "hijri-iso";
    };

    P._onTargetFocus = function () {
      if (this.hasAttribute("popup")) this.open();
    };

    P._onTargetKeydown = function (e) {
      if (!this.hasAttribute("popup")) return;
      if (e.key === "ArrowDown" || (e.key === "Enter" && !this.isOpen)) {
        e.preventDefault();
        this.open();
        if (e.key === "ArrowDown") this._els.table.focus();
      } else if (e.key === "Escape" && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    };

    P._onTargetChange = function () {
      if (this._writing || !this._target) return;
      var raw = this._target.value;
      if (raw === "") { this._select(null, { write: false, emit: true }); return; }
      var day = parseValue(raw, this._prefersHijriInput());
      if (day && !this._isDisabled(day)) this._select(day, { write: true, emit: true });
    };

    P._writeTargets = function (day) {
      this._writing = true;
      try {
        if (this._target) {
          this._writeOne(this._target, day ? formatDay(day, this.getAttribute("format") || "iso") : "", day);
        }
        if (this._targetHijri) {
          this._writeOne(this._targetHijri, day ? formatDay(day, this.getAttribute("hijri-format") || "hijri") : "", day);
        }
      } finally {
        this._writing = false;
      }
    };

    P._writeOne = function (el, text, day) {
      setNativeValue(el, text);
      if (el.dataset) {
        if (day) {
          el.dataset.iso = formatDay(day, "iso");
          el.dataset.hijri = formatDay(day, "hijri-iso");
          el.dataset.hijriText = hijriLong(day);
          el.dataset.ajd = String(day.ajd);
        } else {
          delete el.dataset.iso; delete el.dataset.hijri; delete el.dataset.hijriText; delete el.dataset.ajd;
        }
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    /* ---- internals: popup ---- */

    P._setupPopupListeners = function () {
      document.addEventListener("pointerdown", this._onDocPointerDown, true);
      document.addEventListener("keydown", this._onDocKeydown, true);
      window.addEventListener("scroll", this._onReposition, true);
      window.addEventListener("resize", this._onReposition);
    };

    P._teardownPopupListeners = function () {
      document.removeEventListener("pointerdown", this._onDocPointerDown, true);
      document.removeEventListener("keydown", this._onDocKeydown, true);
      window.removeEventListener("scroll", this._onReposition, true);
      window.removeEventListener("resize", this._onReposition);
    };

    P._onDocPointerDown = function (e) {
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) !== -1 || (this._target && path.indexOf(this._target) !== -1)) return;
      if (!path.length && (this.contains(e.target) || e.target === this._target)) return;
      this.close();
    };

    P._onDocKeydown = function (e) {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
        if (this._target && typeof this._target.focus === "function") this._target.focus();
      }
    };

    P._onReposition = function () { if (this.isOpen) this._position(); };

    P._position = function () {
      if (!this._target || !this.hasAttribute("popup")) return;
      var r = this._target.getBoundingClientRect(),
          w = this.offsetWidth, h = this.offsetHeight,
          vw = window.innerWidth, vh = window.innerHeight,
          gap = 4,
          top = r.bottom + gap,
          left = r.left;
      if (top + h > vh && r.top - h - gap >= 0) top = r.top - h - gap;
      if (left + w > vw) left = Math.max(0, vw - w - 8);
      if (top < 0) top = 8;
      this.style.top = Math.round(top) + "px";
      this.style.left = Math.round(left) + "px";
    };

    /* ---- internals: state ---- */

    P._applyWeekStart = function () {
      var iso = (this.getAttribute("week-start") || "").toLowerCase() === "monday";
      this._view = new HijriCalendar(this._view.getYear(), this._view.getMonth(), iso);
    };

    P._setView = function (year, month) {
      var changed = year !== this._view.getYear() || month !== this._view.getMonth();
      this._view = new HijriCalendar(year, month, this._view.isISO());
      this._render();
      if (changed) fire(this, "hijri-navigate", { year: year, month: month, monthName: HIJRI_MONTHS_LONG[month] });
    };

    P._limits = function () {
      var min = parseValue(this.getAttribute("min"), this._prefersHijriInput()),
          max = parseValue(this.getAttribute("max"), this._prefersHijriInput());
      return { min: min ? min.ajd : -Infinity, max: max ? max.ajd : Infinity };
    };

    P._isDisabled = function (day) {
      var l = this._limits();
      return day.ajd < l.min || day.ajd > l.max;
    };

    P._detail = function (day) {
      var g = day.gregorian, date = new Date(g.year, g.month, g.date);
      date.setFullYear(g.year);
      return {
        hijri: { year: day.hijri.year, month: day.hijri.month, date: day.hijri.date, monthName: HIJRI_MONTHS_LONG[day.hijri.month] },
        gregorian: date,
        iso: formatDay(day, "iso"),
        hijriIso: formatDay(day, "hijri-iso"),
        hijriText: hijriLong(day),
        gregorianText: gregorianLong(day),
        value: formatDay(day, this.getAttribute("format") || "iso"),
        ajd: day.ajd,
        miqaats: miqaatsForDay(this._miqaats, day)
      };
    };

    P._select = function (day, opts) {
      opts = opts || {};
      if (day && this._isDisabled(day)) return;
      var changed = !sameDay(day, this._selected) || (!day && !!this._selected);
      this._selected = day ? dayFromAJD(day.ajd) : null;
      if (day) {
        this._cursorAjd = day.ajd;
        if (day.hijri.year !== this._view.getYear() || day.hijri.month !== this._view.getMonth()) {
          this._view = new HijriCalendar(day.hijri.year, day.hijri.month, this._view.isISO());
        }
      }
      if (this._connected) this._render();
      if (opts.write !== false) this._writeTargets(this._selected);
      if (opts.emit !== false && changed) fire(this, "hijri-change", this._selected ? this._detail(this._selected) : null);
      if (opts.close) this.close();
    };

    P._loadMiqaats = function (url) {
      var self = this;
      if (!window.fetch) return;
      window.fetch(url, { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (data) { self.miqaats = data; fire(self, "hijri-miqaats-loaded", { count: self._miqaats.length }); })
        .catch(function (err) {
          if (window.console) console.warn("<hijri-calendar>: could not load miqaats from " + url, err);
          fire(self, "hijri-error", { url: url, error: err });
        });
    };

    /* ---- internals: events ---- */

    P._onRootClick = function (e) {
      var btn = e.target.closest ? e.target.closest("[data-action]") : null;
      if (btn && this._root.contains(btn)) {
        e.preventDefault();
        switch (btn.getAttribute("data-action")) {
          case "prev-year":  var py = this._view.previousYear(); this._setView(py.getYear(), py.getMonth()); break;
          case "next-year":  var ny = this._view.nextYear();     this._setView(ny.getYear(), ny.getMonth()); break;
          case "prev-month": var pm = this._view.previousMonth(); this._setView(pm.getYear(), pm.getMonth()); break;
          case "next-month": var nm = this._view.nextMonth();     this._setView(nm.getYear(), nm.getMonth()); break;
          case "today":      this.goToToday(); break;
        }
        return;
      }
      var td = e.target.closest ? e.target.closest("td.day") : null;
      if (td && !td.classList.contains("disabled")) {
        var day = dayFromAJD(parseFloat(td.getAttribute("data-ajd")));
        this._select(day, { write: true, emit: true, close: true });
        if (!this.hasAttribute("popup")) this._els.table.focus();
      }
    };

    P._onGridKeydown = function (e) {
      var deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      var cursor = this._cursorAjd != null ? this._cursorAjd
                 : this._selected ? this._selected.ajd
                 : new HijriDate(this._view.getYear(), this._view.getMonth(), 1).toAJD();
      var hd, key = e.key;

      if (deltas.hasOwnProperty(key)) {
        this._moveCursor(cursor + deltas[key]);
      } else if (key === "PageUp" || key === "PageDown") {
        hd = HijriDate.fromAJD(cursor);
        var y = hd.getYear(), m = hd.getMonth(), dir = key === "PageUp" ? -1 : 1;
        if (e.shiftKey) y += dir; else { m += dir; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } }
        y = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
        this._moveCursor(new HijriDate(y, m, Math.min(hd.getDate(), HijriDate.daysInMonth(y, m))).toAJD());
      } else if (key === "Home" || key === "End") {
        hd = HijriDate.fromAJD(cursor);
        var last = HijriDate.daysInMonth(hd.getYear(), hd.getMonth());
        this._moveCursor(new HijriDate(hd.getYear(), hd.getMonth(), key === "Home" ? 1 : last).toAJD());
      } else if (key === "Enter" || key === " ") {
        var day = dayFromAJD(cursor);
        if (!this._isDisabled(day)) this._select(day, { write: true, emit: true, close: true });
      } else if (key === "Escape") {
        this.close();
        if (this._target) this._target.focus();
      } else {
        return;
      }
      e.preventDefault();
    };

    P._moveCursor = function (ajd) {
      var hd = HijriDate.fromAJD(ajd);
      if (hd.getYear() < MIN_YEAR || hd.getYear() > MAX_YEAR) return;
      this._cursorAjd = hd.toAJD();
      if (hd.getYear() !== this._view.getYear() || hd.getMonth() !== this._view.getMonth()) {
        this._setView(hd.getYear(), hd.getMonth());
      } else {
        this._render();
      }
    };

    /* ---- internals: render ---- */

    P._render = function () {
      var cal = this._view, year = cal.getYear(), month = cal.getMonth(), els = this._els;

      els.year.textContent = year + "H";
      els.month.textContent = HIJRI_MONTHS_LONG[month];

      var days = cal.days(), f = days[0].gregorian, l = days[days.length - 1].gregorian;
      els.range.textContent =
        (f.year === l.year && f.month === l.month) ? GREG_MONTHS[f.month] + " " + f.year :
        (f.year === l.year) ? GREG_MONTHS[f.month].substr(0, 3) + " – " + GREG_MONTHS[l.month].substr(0, 3) + " " + f.year :
        GREG_MONTHS[f.month].substr(0, 3) + " " + f.year + " – " + GREG_MONTHS[l.month].substr(0, 3) + " " + l.year;

      var labels = cal.isISO() ? WEEKDAYS.slice(1).concat(WEEKDAYS[0]) : WEEKDAYS, th = "";
      for (var i = 0; i < 7; i++) th += '<th scope="col">' + labels[i] + "</th>";
      els.thead.innerHTML = th;

      var weeks = cal.weeks(), html = "", focusId = null;
      for (var w = 0; w < weeks.length; w++) {
        html += "<tr>";
        for (var d = 0; d < weeks[w].length; d++) {
          var cell = this._renderDay(weeks[w][d]);
          html += cell.html;
          if (cell.focused) focusId = cell.id;
        }
        html += "</tr>";
      }
      els.tbody.innerHTML = html;
      if (focusId) els.table.setAttribute("aria-activedescendant", focusId);
      else els.table.removeAttribute("aria-activedescendant");

      els.buttons["prev-year"].disabled = year <= MIN_YEAR;
      els.buttons["next-year"].disabled = year >= MAX_YEAR;
      els.buttons["prev-month"].disabled = year <= MIN_YEAR && month === 0;
      els.buttons["next-month"].disabled = year >= MAX_YEAR && month === 11;

      this._renderMiqaatList();
      if (this.isOpen) this._position();
    };

    P._renderDay = function (day) {
      if (!day) return { html: '<td class="empty" aria-hidden="true"></td>', focused: false };

      var h = day.hijri, cls = ["day"], isToday = sameDay(day, this._today), isSel = sameDay(day, this._selected),
          disabled = this._isDisabled(day), focused = this._cursorAjd === day.ajd,
          id = "d" + String(day.ajd).replace(".", "_");

      if (day.filler) cls.push("filler");
      if (isToday) cls.push("today");
      if (isSel) cls.push("selected");
      if (disabled) cls.push("disabled");
      if (focused) cls.push("focus");

      // miqaats for this exact day, most important first (filler days from other months get none)
      var list = day.filler ? [] : sortMiqaats(miqaatsForDay(this._miqaats, day));
      var maxBadges = parseInt(this.getAttribute("max-badges"), 10);
      if (!(maxBadges >= 1)) maxBadges = 2;
      if (list.length) cls.push("has-miqaat", "k-" + miqaatKind(list[0]));

      var hijriText = (this.getAttribute("numerals") || "arabic").toLowerCase() === "latin" ? String(h.date) : toArabicNumerals(h.date);
      var label = hijriLong(day) + ", " + gregorianLong(day) + (isToday ? ", today" : "");
      var title = gregorianLong(day);
      for (var i = 0; i < list.length; i++) {
        title += "\n• " + list[i].title;
        label += (i === 0 ? ". Miqaats: " : "; ") + list[i].title;
      }

      return {
        id: id,
        focused: focused,
        html:
          '<td id="' + id + '" class="' + cls.join(" ") + '" part="day' + (isToday ? " today" : "") + (isSel ? " selected" : "") + '"' +
          ' role="gridcell" data-ajd="' + day.ajd + '" aria-label="' + escapeHtml(label) + '"' +
          ' aria-selected="' + (isSel ? "true" : "false") + '"' + (disabled ? ' aria-disabled="true"' : "") +
          ' title="' + escapeHtml(title) + '">' +
            '<div class="cell">' +
              '<div class="cell-head">' +
                '<div class="hijri" part="hijri-date">' + hijriText + "</div>" +
                '<div class="gregorian" part="gregorian-date">' + escapeHtml(gregorianCellLabel(day)) + "</div>" +
              "</div>" +
              badgesHtml(list, maxBadges) +
            "</div>" +
          "</td>"
      };
    };

    P._renderMiqaatList = function () {
      var el = this._els.miqaats;
      if (!this._miqaats.length || this.hasAttribute("hide-miqaats") || !this._selected) {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      var list = miqaatsForDay(this._miqaats, this._selected), items = "";
      for (var i = 0; i < list.length; i++) {
        items += "<li>" + escapeHtml(list[i].title) +
          (list[i].description ? '<span class="description">' + escapeHtml(list[i].description) + "</span>" : "") + "</li>";
      }
      if (!items) items = '<li class="none">There are no miqaats on this day.</li>';
      el.hidden = false;
      el.innerHTML = "<h4>" + escapeHtml(hijriLong(this._selected)) + "</h4><ul>" + items + "</ul>";
    };

    return HijriCalendarElement;
  })(HTMLElement);

  /* ------------------------------------------------------------------ */
  /*  Static helpers & registration                                      */
  /* ------------------------------------------------------------------ */

  HijriCalendarElement.HijriDate = HijriDate;
  HijriCalendarElement.HijriCalendar = HijriCalendar;
  HijriCalendarElement.MIN_YEAR = MIN_YEAR;
  HijriCalendarElement.MAX_YEAR = MAX_YEAR;
  HijriCalendarElement.MONTH_NAMES = HIJRI_MONTHS_LONG.slice();
  HijriCalendarElement.SHORT_MONTH_NAMES = HIJRI_MONTHS_SHORT.slice();

  // HijriCalendarElement.format(new Date(), "hD hMMMM hYYYYH") -> "12 Rabi al-Aakhar 1448H"
  HijriCalendarElement.format = function (value, template) {
    var day = parseValue(value, false);
    return day ? formatDay(day, template) : "";
  };
  // Parse "YYYY-MM-DD", "YYYY-MM-DDH", "12 Rabi al-Aakhar 1448H" or a Date -> detail-like object
  HijriCalendarElement.parse = function (value) {
    var day = parseValue(value, false);
    if (!day) return null;
    var g = day.gregorian, date = new Date(g.year, g.month, g.date);
    date.setFullYear(g.year);
    return { hijri: day.hijri, gregorian: date, iso: formatDay(day, "iso"), hijriIso: formatDay(day, "hijri-iso"), hijriText: hijriLong(day), ajd: day.ajd };
  };
  HijriCalendarElement.toHijri = function (date) { return HijriDate.fromGregorian(date); };
  HijriCalendarElement.toGregorian = function (year, month, date) { return new HijriDate(year, month, date).toGregorian(); };

  window.customElements.define("hijri-calendar", HijriCalendarElement);
  if (!window.HijriCalendarElement) window.HijriCalendarElement = HijriCalendarElement;

  autoInit();
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
