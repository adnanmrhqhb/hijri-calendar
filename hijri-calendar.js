/*!
 * <hijri-calendar> — standalone Gregorian/Hijri calendar & date picker
 * Vanilla JavaScript Web Component with custom scrollable 5-year year dropdown, min/max bounds, step validation, and Miqaats.
 */
(function (window, document) {
  "use strict";

  if (!window || !document || !window.customElements) return;
  if (window.customElements.get("hijri-calendar")) return;

  var MIN_YEAR = 1000;
  var MAX_YEAR = 3000;

  var KABISA_YEAR_REMAINDERS = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];
  var DAYS_IN_YEAR = [30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];
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

  var WEEKDAYS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  var FORMAT_PRESETS = {
    "iso":        "YYYY-MM-DD",
    "gregorian":  "D MMMM YYYY",
    "hijri":      "hD hMMMM hYYYYH",
    "hijri-iso":  "hYYYY-hMM-hDD",
    "both":       "hD hMMMM hYYYYH (D MMMM YYYY)"
  };

  function HijriDate(year, month, day) {
    this.year = year;
    this.month = month;
    this.day = day;
  }
  HijriDate.prototype.getYear = function () { return this.year; };
  HijriDate.prototype.getMonth = function () { return this.month; };
  HijriDate.prototype.getDate = function () { return this.day; };

  HijriDate.isJulian = function (date) {
    var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    if (y < 1582) return true;
    if (y === 1582) { if (m < 9) return true; if (m === 9 && d < 5) return true; }
    return false;
  };

  HijriDate.gregorianToAJD = function (date) {
    var a, b, year = date.getFullYear(), month = date.getMonth() + 1,
        day = date.getDate() + date.getHours() / 24 + date.getMinutes() / 1440 + date.getSeconds() / 86400;
    if (month < 3) { year--; month += 12; }
    if (HijriDate.isJulian(date)) { b = 0; } else { a = Math.floor(year / 100); b = 2 - a + Math.floor(a / 4); }
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
  };

  HijriDate.ajdToGregorian = function (ajd) {
    var a, b, c, d, e, z, alpha, year, month, day;
    z = Math.floor(ajd + 0.5);
    if (z < 2299161) { a = z; } else { alpha = Math.floor((z - 1867216.25) / 36524.25); a = z + 1 + alpha - Math.floor(0.25 * alpha); }
    b = a + 1524; c = Math.floor((b - 122.1) / 365.25); d = Math.floor(365.25 * c);
    e = Math.floor((b - d) / 30.6001); day = b - d - Math.floor(30.6001 * e);
    month = (e < 14) ? (e - 2) : (e - 14); year = (month < 2) ? (c - 4715) : (c - 4716);
    var out = new Date(year, month, day, 0, 0, 0, 0);
    out.setFullYear(year);
    return out;
  };

  HijriDate.isKabisa = function (year) { return KABISA_YEAR_REMAINDERS.indexOf(year % 30) !== -1; };
  HijriDate.daysInMonth = function (year, month) { return ((month === 11 && HijriDate.isKabisa(year)) || (month % 2 === 0)) ? 30 : 29; };
  HijriDate.prototype.dayOfYear = function () { return (this.month === 0) ? this.day : (DAYS_IN_YEAR[this.month - 1] + this.day); };

  HijriDate.fromAJD = function (ajd) {
    var year, month, date, i = 0, left = Math.floor(ajd - 1948083.5), y30 = Math.floor(left / 10631.0);
    left -= y30 * 10631;
    while (left > DAYS_IN_30_YEARS[i]) i += 1;
    year = Math.round(y30 * 30.0 + i);
    if (i > 0) left -= DAYS_IN_30_YEARS[i - 1];
    i = 0;
    while (left > DAYS_IN_YEAR[i]) i += 1;
    month = Math.round(i);
    date = (i > 0) ? Math.round(left - DAYS_IN_YEAR[i - 1]) : Math.round(left);
    if (month > 11) { month = 11; date = HijriDate.daysInMonth(year, 11); }
    return new HijriDate(year, month, date);
  };

  HijriDate.prototype.toAJD = function () {
    var y30 = Math.floor(this.year / 30.0), ajd = 1948083.5 + y30 * 10631 + this.dayOfYear();
    if (this.year % 30 !== 0) { ajd += DAYS_IN_30_YEARS[this.year - y30 * 30 - 1]; }
    return ajd;
  };

  HijriDate.fromGregorian = function (date) { return HijriDate.fromAJD(HijriDate.gregorianToAJD(date)); };
  HijriDate.prototype.toGregorian = function () { return HijriDate.ajdToGregorian(this.toAJD()); };

  function GregorianCalendar(year, month, iso8601) {
    this.year = year;
    this.month = month;
    this.iso8601 = !!iso8601;
  }
  GregorianCalendar.prototype.getYear = function () { return this.year; };
  GregorianCalendar.prototype.getMonth = function () { return this.month; };

  GregorianCalendar.prototype.days = function () {
    var out = [], daysCount = new Date(this.year, this.month + 1, 0).getDate();
    for (var d = 1; d <= daysCount; d++) {
      out.push(dayHash(HijriDate.fromGregorian(new Date(this.year, this.month, d)), false));
    }
    return out;
  };

  GregorianCalendar.prototype.previousDays = function () {
    var out = [], firstDt = new Date(this.year, this.month, 1), wDay = firstDt.getDay();
    if (this.iso8601) wDay = (wDay === 0) ? 6 : wDay - 1;
    var prevMonthLast = new Date(this.year, this.month, 0), daysInPrev = prevMonthLast.getDate();
    for (var i = 0; i < wDay; i++) {
      out.push(dayHash(HijriDate.fromGregorian(new Date(this.year, this.month - 1, daysInPrev - wDay + i + 1)), true));
    }
    return out;
  };

  GregorianCalendar.prototype.nextDays = function () {
    var out = [], lastDt = new Date(this.year, this.month + 1, 0), wDay = lastDt.getDay();
    var trail = this.iso8601 ? (wDay === 0 ? 0 : 6 - wDay) : (6 - wDay);
    for (var i = 0; i < trail; i++) {
      out.push(dayHash(HijriDate.fromGregorian(new Date(this.year, this.month + 1, i + 1)), true));
    }
    return out;
  };

  GregorianCalendar.prototype.weeks = function () {
    var all = this.previousDays().concat(this.days(), this.nextDays()), weeks = [];
    for (var i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  };

  GregorianCalendar.prototype.previousMonth = function () {
    var m = this.month - 1, y = this.year;
    if (m < 0) { m = 11; y--; }
    return new GregorianCalendar(y, m, this.iso8601);
  };

  GregorianCalendar.prototype.nextMonth = function () {
    var m = this.month + 1, y = this.year;
    if (m > 11) { m = 0; y++; }
    return new GregorianCalendar(y, m, this.iso8601);
  };

  function HijriCalendar(year, month, iso8601) {
    this.year = year;
    this.month = month;
    this.iso8601 = !!iso8601;
  }
  HijriCalendar.prototype.getYear = function () { return this.year; };
  HijriCalendar.prototype.getMonth = function () { return this.month; };
  HijriCalendar.prototype.dayOfWeek = function (date) {
    var hd = new HijriDate(this.year, this.month, date), offset = this.iso8601 ? 0.5 : 1.5;
    return (hd.toAJD() + offset) % 7;
  };
  HijriCalendar.prototype.days = function () {
    var out = [], n = HijriDate.daysInMonth(this.year, this.month);
    for (var d = 1; d <= n; d++) out.push(dayHash(new HijriDate(this.year, this.month, d), false));
    return out;
  };
  HijriCalendar.prototype.previousDays = function () {
    var out = [], prev = this.previousMonth(), daysInPrev = HijriDate.daysInMonth(prev.getYear(), prev.getMonth()), lead = this.dayOfWeek(1);
    for (var i = 0; i < lead; i++) out.push(dayHash(new HijriDate(prev.getYear(), prev.getMonth(), daysInPrev - lead + i + 1), true));
    return out;
  };
  HijriCalendar.prototype.nextDays = function () {
    var out = [], next = this.nextMonth(), daysInMonth = HijriDate.daysInMonth(this.year, this.month), trail = 6 - this.dayOfWeek(daysInMonth);
    for (var i = 0; i < trail; i++) out.push(dayHash(new HijriDate(next.getYear(), next.getMonth(), i + 1), true));
    return out;
  };
  HijriCalendar.prototype.weeks = function () {
    var all = this.previousDays().concat(this.days(), this.nextDays()), weeks = [];
    for (var i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  };
  HijriCalendar.prototype.previousMonth = function () {
    var y = (this.month === 0 && this.year > MIN_YEAR) ? (this.year - 1) : this.year, m = (this.month === 0) ? 11 : (this.month - 1);
    return new HijriCalendar(y, m, this.iso8601);
  };
  HijriCalendar.prototype.nextMonth = function () {
    var y = (this.month === 11 && this.year < MAX_YEAR) ? (this.year + 1) : this.year, m = (this.month === 11) ? 0 : (this.month + 1);
    return new HijriCalendar(y, m, this.iso8601);
  };

  function dayHash(hijriDate, isFiller) {
    var g = hijriDate.toGregorian();
    return {
      hijri: { year: hijriDate.getYear(), month: hijriDate.getMonth(), date: hijriDate.getDate() },
      gregorian: { year: g.getFullYear(), month: g.getMonth(), date: g.getDate() },
      ajd: hijriDate.toAJD(),
      filler: isFiller ? true : undefined
    };
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function toArabicNumerals(x) {
    var s = String(Math.floor(x)), out = "";
    for (var i = 0; i < s.length; i++) { var d = parseInt(s.charAt(i), 10); out += isNaN(d) ? s.charAt(i) : ARABIC_DIGITS[d]; }
    return out;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var TOKEN_RE = /\[([^\]]*)\]|hMMMM|hMMM|hYYYY|hMM|hM|hDD|hD|MMMM|MMM|YYYY|MM|M|DD|D/g;
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

  function findHijriMonth(name) {
    var n = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var i = 0; i < 12; i++) {
      var l = HIJRI_MONTHS_LONG[i].toLowerCase().replace(/[^a-z0-9]/g, ""),
          s = HIJRI_MONTHS_SHORT[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (n === l || n === s || (n.length >= 4 && l.indexOf(n) === 0)) return i;
    }
    return -1;
  }

  function parseValue(input, preferHijri) {
    if (input == null || input === "") return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : dayHash(HijriDate.fromGregorian(input), false);
    if (typeof input === "object" && typeof input.year === "number") return validHijri(input.year, input.month, input.date);
    var str = String(input).trim(), m;
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s*(H)?$/i.exec(str);
    if (m) {
      var y = +m[1], mo = +m[2] - 1, d = +m[3];
      if (m[4] || preferHijri) return validHijri(y, mo, d);
      var dt = new Date(y, mo, d); dt.setFullYear(y);
      if (dt.getMonth() !== mo || dt.getDate() !== d) return null;
      return dayHash(HijriDate.fromGregorian(dt), false);
    }
    m = /^(\d{1,2})\s+([A-Za-z][A-Za-z\s\-']*?)\s+(\d{4})\s*H$/i.exec(str);
    if (m) { var hm = findHijriMonth(m[2]); return hm < 0 ? null : validHijri(+m[3], hm, +m[1]); }
    var t = Date.parse(str);
    if (!isNaN(t)) return dayHash(HijriDate.fromGregorian(new Date(t)), false);
    return null;
  }

  function validHijri(y, m, d) {
    if (!(y >= MIN_YEAR && y <= MAX_YEAR) || !(m >= 0 && m <= 11) || !(d >= 1 && d <= HijriDate.daysInMonth(y, m))) return null;
    return dayHash(new HijriDate(y, m, d), false);
  }

  function sameDay(a, b) {
    return !!a && !!b && a.hijri.year === b.hijri.year && a.hijri.month === b.hijri.month && a.hijri.date === b.hijri.date;
  }

  function isValidStep(day, minDay, stepAttr) {
    if (!stepAttr || stepAttr === "any") return true;
    var step = parseFloat(stepAttr);
    if (isNaN(step) || step <= 0) step = 1;
    var baseAjd = minDay ? minDay.ajd : 0;
    return Math.round(Math.abs(day.ajd - baseAjd)) % step === 0;
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
    out.sort(function (a, b) { return (a.priority || 3) - (b.priority || 3); });
    return out;
  }

  function classifyMiqaat(m) {
    var t = (m.title || "").toLowerCase();
    if (t.indexOf("urus") !== -1 || t.indexOf("urs") !== -1) return "urus";
    if (t.indexOf("shahadat") !== -1 || t.indexOf("ashura") !== -1 || t.indexOf("suyum") !== -1 || t.indexOf("chehlum") !== -1 || t.indexOf("wafat") !== -1) return "shahadat";
    if (m.priority === 1 && m.phase === "night") return "night";
    if (m.priority === 1 || t.indexOf("eid") !== -1 || t.indexOf("milad") !== -1 || t.indexOf("wiladat") !== -1) return "festive";
    return "minor";
  }

  var ICONS = {
    crown: '<svg class="icon icon-crown" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1h14v1z"/></svg>',
    drop: '<svg class="icon icon-drop" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    sparkle: '<svg class="icon icon-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0l3.09 8.26L23.35 11l-8.26 3.09L12 22.35 8.91 14.09 0.65 11l8.26-2.74z"/></svg>',
    moon: '<svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8z"/></svg>',
    circle: '<svg class="icon icon-circle" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>'
  };

  function iconForKind(kind) {
    switch (kind) {
      case "urus": return ICONS.crown;
      case "shahadat": return ICONS.drop;
      case "festive": return ICONS.sparkle;
      case "night": return ICONS.moon;
      default: return ICONS.circle;
    }
  }

  function setNativeValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }

  function fire(el, type, detail) {
    el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable: false, detail: detail }));
  }

  var STYLE = [
    ":host{",
    "  --hc-font:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "  --hc-font-size:16px;--hc-bg:#fff;--hc-fg:#333;--hc-muted:#9a9a9a;--hc-border:#ddd;",
    "  --hc-accent:#0b7a4b;--hc-accent-fg:#fff;--hc-hover-bg:#eef2f8;",
    "  --hc-today-bg:#ffe9a8;--hc-today-fg:#5a3e00;--hc-radius:6px;--hc-cell-height:4.5em;",
    "  --hc-kind-urus:#d19a00;--hc-kind-shahadat:#b83a3a;--hc-kind-festive:#2e9b61;--hc-kind-night:#4a5bd6;--hc-kind-minor:#8a8f98;",
    "  --hc-shadow:0 8px 24px rgba(0,0,0,.18);",
    "  display:block;box-sizing:border-box;font:var(--hc-font-size)/1.4 var(--hc-font);color:var(--hc-fg);background:var(--hc-bg);border:1px solid var(--hc-border);border-radius:var(--hc-radius);max-width:100%;user-select:none;",
    "}",
    ":host([hidden]){display:none}",
    ":host([popup]){display:none;position:absolute;z-index:2147483000;width:24em;box-shadow:var(--hc-shadow);--hc-cell-height:3.6em;--hc-font-size:14px}",
    ":host([popup][open]){display:block !important;}",
    "*,*::before,*::after{box-sizing:inherit}",
    ".frame{padding:.75em}",
    ".year-row{display:flex;align-items:center;justify-content:space-between;gap:.5em}",
    // Custom Year Picker Styles
    ".year-picker{position:relative;display:inline-block}",
    ".year-btn{font:inherit;font-weight:600;font-size:1.1em;padding:.25em .6em;border:1px solid var(--hc-border);border-radius:var(--hc-radius);background:var(--hc-bg);color:var(--hc-fg);cursor:pointer;display:inline-flex;align-items:center;gap:6px;outline:none}",
    ".year-btn:focus,.year-btn:hover{border-color:var(--hc-accent);background:var(--hc-hover-bg)}",
    ".year-dropdown{position:absolute;top:100%;left:0;margin-top:4px;background:var(--hc-bg);border:1px solid var(--hc-border);border-radius:var(--hc-radius);box-shadow:var(--hc-shadow);max-height:140px;overflow-y:auto;z-index:20;width:100%;min-width:90px}",
    ".year-dropdown[hidden]{display:none}",
    ".year-item{padding:6px 10px;text-align:center;cursor:pointer;font-size:1em;font-weight:500}",
    ".year-item:hover{background:var(--hc-hover-bg)}",
    ".year-item.selected{background:var(--hc-accent);color:var(--hc-accent-fg)}",
    "button{font:inherit;color:var(--hc-accent);background:none;border:0;border-radius:var(--hc-radius);cursor:pointer;padding:.2em .45em;line-height:1}",
    "button:hover{background:var(--hc-hover-bg)}",
    "button:focus-visible{outline:2px solid var(--hc-accent);outline-offset:1px}",
    "button.today{border:1px solid var(--hc-border);padding:.4em .8em;font-size:.85em;color:var(--hc-fg)}",
    ".month-row{display:flex;align-items:center;justify-content:space-between;margin:.4em 0 .6em}",
    ".month-title{flex:1;text-align:center}",
    "h3{font-size:1.1em;margin:0}",
    ".greg-range{font-size:.75em;color:var(--hc-muted)}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed}",
    "th{font-size:.72em;font-weight:600;color:var(--hc-muted);text-transform:uppercase;letter-spacing:.04em;padding:.35em 0;text-align:center}",
    "td{position:relative;height:var(--hc-cell-height);border:1px solid var(--hc-border);padding:2px;vertical-align:top;overflow:hidden}",
    "td.day{cursor:pointer}",
    "td.day:hover{background:var(--hc-hover-bg)}",
    "td.filler{color:var(--hc-muted);opacity:.5}",
    "td.today{background:var(--hc-today-bg);color:var(--hc-today-fg)}",
    "td.selected,td.selected:hover{background:var(--hc-accent);color:var(--hc-accent-fg)}",
    "td.disabled{cursor:not-allowed;opacity:.35}",
    ".hijri-date{font-size:1.1em;font-weight:600;line-height:1.1;text-align:right;padding:2px}",
    ".gregorian-date{font-size:.65em;line-height:1;color:var(--hc-muted);position:absolute;bottom:2px;left:2px}",
    "td.selected .gregorian-date{color:var(--hc-accent-fg)}",
    ".miqaat-badges{display:flex;flex-direction:column;gap:1px;margin-top:2px;overflow:hidden}",
    ".miqaat-badge{font-size:.62em;padding:1px 3px;border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-flex;align-items:center;gap:2px}",
    ".miqaat-badge .icon{width:.9em;height:.9em;flex-shrink:0}",
    ".miqaat-urus{background:rgba(209,154,0,.15);color:var(--hc-kind-urus)}",
    ".miqaat-shahadat{background:rgba(184,58,58,.15);color:var(--hc-kind-shahadat)}",
    ".miqaat-festive{background:rgba(46,155,97,.15);color:var(--hc-kind-festive)}",
    ".miqaat-night{background:rgba(74,91,214,.15);color:var(--hc-kind-night)}",
    ".miqaat-minor{background:rgba(138,143,152,.15);color:var(--hc-kind-minor)}",
    ".miqaat-more{font-size:.6em;color:var(--hc-muted);text-align:right;padding-right:2px}",
    ".miqaats{margin:.6em 0 0;padding:.6em .4em 0;border-top:1px solid var(--hc-border);font-size:.85em}",
    ".miqaats[hidden]{display:none}",
    ".miqaats h4{font-size:.95em;margin-bottom:.2em}",
    ".miqaats ul{margin:0;padding-left:1.2em}",
    ":host([theme=dark]){--hc-bg:#1c1c1e;--hc-fg:#e6e6e6;--hc-muted:#8e8e93;--hc-border:#3a3a3c;--hc-hover-bg:#2c2c2e;--hc-today-bg:#2d5a1b;--hc-today-fg:#d8f7c4}",
    "@media (prefers-color-scheme:dark){:host(:not([theme=light])){--hc-bg:#1c1c1e;--hc-fg:#e6e6e6;--hc-muted:#8e8e93;--hc-border:#3a3a3c;--hc-hover-bg:#2c2c2e;--hc-today-bg:#2d5a1b;--hc-today-fg:#d8f7c4}}"
  ].join("\n");

  var TEMPLATE =
    "<style>" + STYLE + "</style>" +
    '<div class="frame" part="frame">' +
    '  <div class="year-row" part="header">' +
    '    <div class="year-picker">' +
    '      <button type="button" class="year-btn" part="year-btn" aria-haspopup="true"><span></span> ▾</button>' +
    '      <div class="year-dropdown" part="year-dropdown" hidden></div>' +
    '    </div>' +
    '    <button type="button" class="today" part="button today" data-action="today">Today</button>' +
    '  </div>' +
    '  <div class="month-row" part="month-row">' +
    '    <button type="button" class="nav" part="button nav" data-action="prev-month" aria-label="Previous month">‹</button>' +
    '    <div class="month-title"><h3 class="month" part="month"></h3><div class="greg-range" part="gregorian-range"></div></div>' +
    '    <button type="button" class="nav" part="button nav" data-action="next-month" aria-label="Next month">›</button>' +
    '  </div>' +
    '  <table role="grid" part="grid" tabindex="0"><thead><tr></tr></thead><tbody></tbody></table>' +
    '  <div class="miqaats" part="miqaats" hidden></div>' +
    '</div>';

  var HijriCalendarElement = /** @class */ (function (_super) {
    function HijriCalendarElement() {
      var self = Reflect.construct(_super, [], new.target || HijriCalendarElement);
      var root = self.attachShadow({ mode: "open" });
      root.innerHTML = TEMPLATE;

      self._root = root;
      self._today = dayHash(HijriDate.fromGregorian(new Date()), false);
      
      self._isGregorianBase = true;
      var now = new Date();
      self._view = new GregorianCalendar(now.getFullYear(), now.getMonth(), false);
      
      self._selected = null;
      self._miqaats = [];
      self._target = null;
      self._targetHijri = null;
      self._connected = false;

      self._els = {
        yearBtn: root.querySelector(".year-btn span"),
        yearBtnContainer: root.querySelector(".year-btn"),
        yearDropdown: root.querySelector(".year-dropdown"),
        month: root.querySelector(".month"),
        range: root.querySelector(".greg-range"),
        table: root.querySelector("table"),
        thead: root.querySelector("thead tr"),
        tbody: root.querySelector("tbody"),
        miqaats: root.querySelector(".miqaats")
      };

      self._onRootClick = self._onRootClick.bind(self);
      self._onGridKeydown = self._onGridKeydown.bind(self);
      self._onTargetFocus = self._onTargetFocus.bind(self);
      self._onTargetClick = self._onTargetClick.bind(self);
      self._onTargetChange = self._onTargetChange.bind(self);
      self._onDocPointerDown = self._onDocPointerDown.bind(self);
      return self;
    }

    HijriCalendarElement.prototype = Object.create(_super.prototype, {
      constructor: { value: HijriCalendarElement, writable: true, configurable: true }
    });
    Object.setPrototypeOf(HijriCalendarElement, _super);

    Object.defineProperty(HijriCalendarElement, "observedAttributes", {
      get: function () {
        return ["target", "target-hijri", "value", "week-start", "numerals", "min", "max", "step", "miqaats-url", "popup", "format", "hijri-format", "max-badges", "hide-miqaats", "theme", "base"];
      }
    });

    var P = HijriCalendarElement.prototype;

    P.connectedCallback = function () {
      this._connected = true;
      this._updateBaseMode();
      this._populateYearDropdown();
      this._root.addEventListener("click", this._onRootClick);
      this._els.table.addEventListener("keydown", this._onGridKeydown);
      this._bindTargets();

      if (!this._selected) {
        var fromAttr = parseValue(this.getAttribute("value"), true);
        if (fromAttr) {
          this._select(fromAttr, { write: true, emit: false });
        } else if (this._target && this._target.value) {
          var fromTarget = parseValue(this._target.value, true);
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
    };

    P.attributeChangedCallback = function (name, oldVal, newVal) {
      if (!this._connected || oldVal === newVal) return;
      if (name === "base") {
        this._updateBaseMode();
        this._populateYearDropdown();
      } else if (name === "target" || name === "target-hijri") {
        this._bindTargets();
      } else if (name === "value") {
        this._select(parseValue(newVal, true), { write: true, emit: false });
      } else if (name === "miqaats-url") {
        if (newVal) this._loadMiqaats(newVal); else this.miqaats = [];
      } else if (name === "popup" && newVal === null) {
        this.close();
      } else {
        this._populateYearDropdown();
        this._render();
      }
    };

    P._updateBaseMode = function () {
      var baseAttr = this.getAttribute("base") || "gregorian";
      this._isGregorianBase = (baseAttr !== "hijri");
      var now = new Date();
      if (this._isGregorianBase) {
        this._view = new GregorianCalendar(now.getFullYear(), now.getMonth(), this.getAttribute("week-start") === "monday");
      } else {
        var hd = HijriDate.fromGregorian(now);
        this._view = new HijriCalendar(hd.getYear(), hd.getMonth(), this.getAttribute("week-start") === "monday");
      }
    };

    P._populateYearDropdown = function () {
      var currentYear = this._view.getYear();
      var arabic = this.getAttribute("numerals") !== "latin";
      
      this._els.yearBtn.textContent = (this._isGregorianBase || !arabic) ? (currentYear + (this._isGregorianBase ? "" : "H")) : (toArabicNumerals(currentYear) + "H");

      // Generate scrollable year list spanning a wide range (e.g., current year +/- 50 years, fully scrollable showing ~5 items at once)
      var startY = currentYear - 50;
      var endY = currentYear + 50;
      var html = "";

      for (var y = startY; y <= endY; y++) {
        var label = (this._isGregorianBase || !arabic) ? (y + (this._isGregorianBase ? "" : "H")) : (toArabicNumerals(y) + "H");
        html += '<div class="year-item' + (y === currentYear ? ' selected' : '') + '" data-year="' + y + '">' + label + '</div>';
      }
      this._els.yearDropdown.innerHTML = html;
    };

    Object.defineProperties(P, {
      value: {
        get: function () {
          if (!this._selected) return null;
          var g = this._selected.gregorian, d = new Date(g.year, g.month, g.date);
          d.setFullYear(g.year);
          return d;
        },
        set: function (v) { this._select(parseValue(v, true), { write: true, emit: false }); }
      },
      hijriValue: {
        get: function () {
          if (!this._selected) return null;
          var h = this._selected.hijri;
          return { year: h.year, month: h.month, date: h.date };
        },
        set: function (v) { this._select(v ? validHijri(v.year, v.month, v.date) : null, { write: true, emit: false }); }
      },
      selected: { get: function () { return this._selected ? this._detail(this._selected) : null; } },
      miqaats: {
        get: function () { return this._miqaats; },
        set: function (list) { this._miqaats = Array.isArray(list) ? list : []; if (this._connected) this._render(); }
      },
      isOpen: { get: function () { return this.hasAttribute("open"); } }
    });

    P.open = function () {
      if (!this.hasAttribute("popup") || this.hasAttribute("open")) return;
      this.setAttribute("open", "");
      this._positionPopup();
      this._setupPopupListeners();
      fire(this, "hijri-open", {});
    };

    P.close = function () {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this._els.yearDropdown.setAttribute("hidden", "");
      this._teardownPopupListeners();
      fire(this, "hijri-close", {});
    };

    P._positionPopup = function () {
      if (!this._target) return;
      var rect = this._target.getBoundingClientRect();
      this.style.top = (window.scrollY + rect.bottom + 6) + "px";
      this.style.left = (window.scrollX + rect.left) + "px";
    };

    P.toggle = function () { this.isOpen ? this.close() : this.open(); };
    
    P.goToToday = function () {
      var now = new Date();
      this._today = dayHash(HijriDate.fromGregorian(now), false);
      if (this._isGregorianBase) {
        this._view = new GregorianCalendar(now.getFullYear(), now.getMonth(), this.getAttribute("week-start") === "monday");
      } else {
        this._view = new HijriCalendar(this._today.hijri.year, this._today.hijri.month, this.getAttribute("week-start") === "monday");
      }
      this._els.yearDropdown.setAttribute("hidden", "");
      this._populateYearDropdown();
      this._render();
    };

    P.goTo = function (year, month) {
      if (this._isGregorianBase) {
        this._view = new GregorianCalendar(year, month, this.getAttribute("week-start") === "monday");
      } else {
        this._view = new HijriCalendar(Math.min(MAX_YEAR, Math.max(MIN_YEAR, year | 0)), Math.min(11, Math.max(0, month | 0)), this.getAttribute("week-start") === "monday");
      }
      this._populateYearDropdown();
      this._render();
    };

    P.clear = function () { this._select(null, { write: true, emit: true }); };

    P._render = function () {
      if (!this._connected) return;
      this._populateYearDropdown();

      if (this._isGregorianBase) {
        var gYear = this._view.getYear(), gMonth = this._view.getMonth();
        this._els.month.textContent = GREG_MONTHS[gMonth];
        var firstHijri = HijriDate.fromGregorian(new Date(gYear, gMonth, 1));
        var lastHijri = HijriDate.fromGregorian(new Date(gYear, gMonth + 1, 0));
        this._els.range.textContent = HIJRI_MONTHS_SHORT[firstHijri.getMonth()] + " " + firstHijri.getDate() + " – " + HIJRI_MONTHS_SHORT[lastHijri.getMonth()] + " " + lastHijri.getDate() + ", " + lastHijri.getYear() + "H";
      } else {
        var hYear = this._view.getYear(), hMonth = this._view.getMonth();
        this._els.month.textContent = HIJRI_MONTHS_LONG[hMonth];
        var firstDay = new HijriDate(hYear, hMonth, 1).toGregorian();
        var lastDay = new HijriDate(hYear, hMonth, HijriDate.daysInMonth(hYear, hMonth)).toGregorian();
        this._els.range.textContent = GREG_MONTHS[firstDay.getMonth()].substr(0, 3) + " " + firstDay.getDate() + " – " + GREG_MONTHS[lastDay.getMonth()].substr(0, 3) + " " + lastDay.getDate() + ", " + lastDay.getFullYear();
      }

      var isMon = this.getAttribute("week-start") === "monday";
      var wHeadings = isMon ? WEEKDAYS_MON : WEEKDAYS_SUN;
      var thHtml = "";
      for (var i = 0; i < 7; i++) thHtml += "<th>" + wHeadings[i] + "</th>";
      this._els.thead.innerHTML = thHtml;

      var weeks = this._view.weeks();
      var tbodyHtml = "";
      var maxBadges = parseInt(this.getAttribute("max-badges") || "2", 10);
      var minDay = parseValue(this.getAttribute("min"), true);
      var maxDay = parseValue(this.getAttribute("max"), true);
      var stepAttr = this.getAttribute("step") || "1";

      for (var w = 0; w < weeks.length; w++) {
        tbodyHtml += "<tr>";
        var week = weeks[w];
        for (var d = 0; d < week.length; d++) {
          var day = week[d];
          if (!day) { tbodyHtml += '<td class="filler"></td>'; continue; }
          
          var isBeyondMin = minDay && day.ajd < minDay.ajd;
          var isBeyondMax = maxDay && day.ajd > maxDay.ajd;
          var violatesStep = !isValidStep(day, minDay, stepAttr);
          var isDisabled = isBeyondMin || isBeyondMax || violatesStep;

          var isToday = sameDay(day, this._today);
          var isSelected = sameDay(day, this._selected);

          var cls = ["day"];
          if (day.filler) cls.push("filler");
          if (isToday) cls.push("today");
          if (isSelected) cls.push("selected");
          if (isDisabled) cls.push("disabled");

          var arabic = this.getAttribute("numerals") !== "latin";
          var primaryNum = this._isGregorianBase ? day.gregorian.date : (arabic ? toArabicNumerals(day.hijri.date) : day.hijri.date);
          var secondaryText = this._isGregorianBase ? 
            ((arabic ? toArabicNumerals(day.hijri.date) : day.hijri.date) + " " + HIJRI_MONTHS_SHORT[day.hijri.month].substr(0, 3)) : 
            (day.gregorian.date + " " + GREG_MONTHS[day.gregorian.month].substr(0, 3));

          var badgesHtml = "";
          if (!this.hasAttribute("hide-miqaats") && this._miqaats.length > 0) {
            var mList = miqaatsForDay(this._miqaats, day);
            if (mList.length > 0) {
              badgesHtml += '<div class="miqaat-badges">';
              var showCount = Math.min(mList.length, maxBadges);
              for (var mb = 0; mb < showCount; mb++) {
                var mItem = mList[mb];
                var kind = classifyMiqaat(mItem);
                badgesHtml += '<span class="miqaat-badge miqaat-' + kind + '" title="' + escapeHtml(mItem.title) + '">' + iconForKind(kind) + '<span>' + escapeHtml(mItem.title) + '</span></span>';
              }
              if (mList.length > showCount) badgesHtml += '<span class="miqaat-more">+' + (mList.length - showCount) + ' more</span>';
              badgesHtml += '</div>';
            }
          }

          tbodyHtml += '<td class="' + cls.join(" ") + '" data-ajd="' + day.ajd + '">' +
            '<div class="hijri-date">' + primaryNum + '</div>' +
            '<div class="gregorian-date">' + secondaryText + '</div>' +
            badgesHtml +
            '</td>';
        }
        tbodyHtml += "</tr>";
      }
      this._els.tbody.innerHTML = tbodyHtml;
      this._renderMiqaatsList();
    };

    P._renderMiqaatsList = function () {
      var container = this._els.miqaats;
      if (this.hasAttribute("hide-miqaats") || !this._selected || this._miqaats.length === 0) {
        container.setAttribute("hidden", ""); return;
      }
      var list = miqaatsForDay(this._miqaats, this._selected);
      if (list.length === 0) { container.setAttribute("hidden", ""); return; }
      var html = '<h4>Miqaats for this day:</h4><ul>';
      for (var i = 0; i < list.length; i++) {
        html += '<li><strong>' + escapeHtml(list[i].title) + '</strong>' + (list[i].description ? ' — ' + escapeHtml(list[i].description) : '') + '</li>';
      }
      html += '</ul>';
      container.innerHTML = html;
      container.removeAttribute("hidden");
    };

    P._onRootClick = function (e) {
      var yearBtn = e.target.closest(".year-btn");
      if (yearBtn) {
        var dd = this._els.yearDropdown;
        if (dd.hasAttribute("hidden")) {
          dd.removeAttribute("hidden");
          // Scroll to selected/current year item inside dropdown
          var selectedEl = dd.querySelector(".year-item.selected");
          if (selectedEl) selectedEl.scrollIntoView({ block: "center" });
        } else {
          dd.setAttribute("hidden", "");
        }
        return;
      }

      var yearItem = e.target.closest(".year-item");
      if (yearItem) {
        var y = parseInt(yearItem.getAttribute("data-year"), 10);
        this.goTo(y, this._view.getMonth());
        this._els.yearDropdown.setAttribute("hidden", "");
        return;
      }

      var btn = e.target.closest("button");
      if (btn) {
        var action = btn.getAttribute("data-action");
        if (action === "prev-month") { var prev = this._view.previousMonth(); this.goTo(prev.getYear(), prev.getMonth()); }
        if (action === "next-month") { var nxt = this._view.nextMonth(); this.goTo(nxt.getYear(), nxt.getMonth()); }
        if (action === "today") this.goToToday();
        return;
      }

      var td = e.target.closest("td.day");
      if (td && !td.classList.contains("disabled")) {
        var ajd = parseFloat(td.getAttribute("data-ajd"));
        var day = dayHash(HijriDate.fromAJD(ajd), false);
        this._select(day, { write: true, emit: true });
        if (this.hasAttribute("popup")) this.close();
      }
    };

    P._onGridKeydown = function (e) {
      if (!this._selected) return;
      var curAjd = this._selected.ajd, nextAjd = curAjd;
      if (e.key === "ArrowLeft") nextAjd -= 1;
      else if (e.key === "ArrowRight") nextAjd += 1;
      else if (e.key === "ArrowUp") nextAjd -= 7;
      else if (e.key === "ArrowDown") nextAjd += 7;
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (this.hasAttribute("popup")) this.close(); return; }
      else if (e.key === "Escape") { this.close(); if (this._target) this._target.focus(); return; }
      else return;

      e.preventDefault();
      var day = dayHash(HijriDate.fromAJD(nextAjd), false);
      this._select(day, { write: true, emit: true });
      this.goTo(this._isGregorianBase ? day.gregorian.year : day.hijri.year, this._isGregorianBase ? day.gregorian.month : day.hijri.month);
    };

    P._select = function (day, opts) {
      this._selected = day;
      if (opts && opts.write) this._writeTargets(day);
      this._render();
      if (opts && opts.emit) fire(this, "hijri-change", this.selected);
    };

    P._writeTargets = function (day) {
      if (!day) return;
      var format = this.getAttribute("format") || "iso";
      var text = formatDay(day, format);
      if (this._target) {
        setNativeValue(this._target, text);
        this._target.setAttribute("data-iso", formatDay(day, "iso"));
        this._target.setAttribute("data-hijri", formatDay(day, "hijri-iso"));
        this._target.setAttribute("data-hijri-text", formatDay(day, "hijri"));
        this._target.setAttribute("data-ajd", day.ajd);
        fire(this._target, "input", {});
        fire(this._target, "change", {});
      }
    };

    P._detail = function (day) {
      var h = day.hijri, g = day.gregorian;
      return {
        hijri: { year: h.year, month: h.month, date: h.date, monthName: HIJRI_MONTHS_LONG[h.month] },
        gregorian: new Date(g.year, g.month, g.date),
        iso: formatDay(day, "iso"),
        hijriIso: formatDay(day, "hijri-iso"),
        hijriText: formatDay(day, "hijri"),
        gregorianText: formatDay(day, "gregorian"),
        value: formatDay(day, this.getAttribute("format") || "iso"),
        ajd: day.ajd,
        miqaats: miqaatsForDay(this._miqaats, day)
      };
    };

    P._loadMiqaats = function (url) {
      var self = this;
      fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          self._miqaats = Array.isArray(data) ? data : (data.miqaats || []);
          self._render();
          fire(self, "hijri-miqaats-loaded", { count: self._miqaats.length });
        })
        .catch(function (err) { fire(self, "hijri-error", { url: url, error: err }); });
    };

    P._bindTargets = function () {
      this._unbindTargets();
      var sel = this.getAttribute("target");
      if (sel) {
        var scope = this.getRootNode && this.getRootNode();
        if (scope && scope.querySelector && scope !== document) this._target = scope.querySelector(sel);
        if (!this._target) this._target = document.querySelector(sel);
      }
      this._attachTargetListeners();
    };

    P._unbindTargets = function () {
      if (this._target) {
        this._target.removeEventListener("focus", this._onTargetFocus);
        this._target.removeEventListener("click", this._onTargetClick);
        this._target.removeEventListener("change", this._onTargetChange);
      }
    };

    P._attachTargetListeners = function () {
      if (this._target) {
        this._target.addEventListener("focus", this._onTargetFocus);
        this._target.addEventListener("click", this._onTargetClick);
        this._target.addEventListener("change", this._onTargetChange);
      }
    };

    P._onTargetFocus = function () { if (this.hasAttribute("popup")) this.open(); };
    P._onTargetClick = function () { if (this.hasAttribute("popup")) this.toggle(); };
    P._onTargetChange = function () {
      if (this._target) {
        var parsed = parseValue(this._target.value, true);
        if (parsed) this._select(parsed, { write: false, emit: true });
      }
    };

    P._setupPopupListeners = function () {
      this._onDocPointerDown = this._onDocPointerDown.bind(this);
      document.addEventListener("pointerdown", this._onDocPointerDown, true);
    };

    P._teardownPopupListeners = function () {
      document.removeEventListener("pointerdown", this._onDocPointerDown, true);
    };

    P._onDocPointerDown = function (e) {
      if (!this.isOpen) return;
      var path = e.composedPath();
      if (path.indexOf(this) === -1 && (!this._target || path.indexOf(this._target) === -1)) this.close();
      // Also close year dropdown if clicked outside inside shadow dom
      if (!e.composedPath().includes(this._els.yearBtnContainer)) {
        this._els.yearDropdown.setAttribute("hidden", "");
      }
    };

    HijriCalendarElement.format = function (val, tpl) { var d = parseValue(val, true); return d ? formatDay(d, tpl || "iso") : ""; };
    HijriCalendarElement.parse = function (str) { var d = parseValue(str, true); return d ? { iso: formatDay(d, "iso"), hijri: formatDay(d, "hijri"), ajd: d.ajd } : null; };
    HijriCalendarElement.toHijri = function (date) { var hd = HijriDate.fromGregorian(date); return new HijriDate(hd.getYear(), hd.getMonth(), hd.getDate()); };
    HijriCalendarElement.toGregorian = function (y, m, d) { return new HijriDate(y, m, d).toGregorian(); };
    HijriCalendarElement.HijriDate = HijriDate;
    HijriCalendarElement.GregorianCalendar = GregorianCalendar;
    HijriCalendarElement.HijriCalendar = HijriCalendar;

    return HijriCalendarElement;
  })(HTMLElement);

  window.customElements.define("hijri-calendar", HijriCalendarElement);

})(window, document);
