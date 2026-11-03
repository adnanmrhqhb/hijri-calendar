# `<hijri-calendar>` — embeddable Hijri date picker

A standalone, dependency-free **Web Component** that renders the Mumineen (Misri / Dawoodi Bohra)
Hijri calendar and works as a date picker for any input on the host page. Styles live in a
Shadow DOM, so the host page's CSS cannot break the widget and the widget cannot leak styles out.

One file, one script tag:

```html
<script src="hijri-calendar.js"></script>

<input id="dob" type="text">
<hijri-calendar target="#dob" popup></hijri-calendar>
```

Clicking the input opens the calendar underneath it. Picking a day writes `2026-10-20` (Gregorian
ISO by default) into `#dob`, fires native `input`/`change` events on it, and closes the popup.

Open `demo.html` for live examples (`node serve.js` then <http://localhost:8765/>; a plain
file:// open also works except for loading `miqaats.json`).

## Files

| File                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `hijri-calendar.js` | The widget. The only file a host page needs.                      |
| `miqaats.json`      | Optional miqaat data (copied from the original site). Load it with `miqaats-url`. |
| `demo.html`         | Examples: popup, inline, theming, min/max, auto-init.             |
| `serve.js`          | Tiny static server for the demo (`node serve.js [port]`).         |

## Attributes

| Attribute       | Default    | Description |
| --------------- | ---------- | ----------- |
| `target`        | –          | CSS selector of the input that receives the selected date. Resolved against the element's own shadow root first, then `document`. |
| `target-hijri`  | –          | Optional second input that receives the Hijri rendering (`hijri-format`). |
| `popup`         | off        | Hide the calendar and show it anchored under `target` when the input is focused/clicked. Without it the calendar renders inline. |
| `format`        | `iso`      | What gets written to `target`. A preset name or a token template (see below). |
| `hijri-format`  | `hijri`    | Same, for `target-hijri`. |
| `value`         | –          | Initial selection: `2026-10-20` (Gregorian), `1448-05-10H` (Hijri, 1-based month) or `10 Jumada al-Ula 1448H`. If omitted, an existing value in `target` is parsed instead. |
| `min` / `max`   | –          | Earliest / latest selectable day, same syntaxes as `value`. Days outside are greyed out and refused. |
| `week-start`    | `sunday`   | `monday` starts rows on Monday (ISO 8601). |
| `numerals`      | `arabic`   | `latin` shows the big Hijri day number as `12` instead of `١٢`. |
| `miqaats-url`   | –          | URL of a JSON file in the `miqaats.json` shape. Enables the in-cell miqaat badges and the list under the grid (see "Miqaat badges"). |
| `max-badges`    | `2`        | How many miqaat pills to show per day before collapsing the rest into "+N more". |
| `hide-miqaats`  | off        | Keep the badges but hide the list panel under the grid. |
| `theme`         | auto       | `light` or `dark` to override `prefers-color-scheme`. |

### Format presets and tokens

| Preset      | Template                            | Example                                   |
| ----------- | ----------------------------------- | ----------------------------------------- |
| `iso`       | `YYYY-MM-DD`                        | `2026-10-20`                              |
| `gregorian` | `D MMMM YYYY`                       | `20 October 2026`                         |
| `hijri`     | `hD hMMMM hYYYYH`                   | `10 Jumada al-Ula 1448H`                  |
| `hijri-iso` | `hYYYY-hMM-hDD`                     | `1448-05-10`                              |
| `both`      | `hD hMMMM hYYYYH (D MMMM YYYY)`     | `10 Jumada al-Ula 1448H (20 October 2026)`|

Tokens: Gregorian `YYYY MM M DD D MMM MMMM`; Hijri `hYYYY hMM hM hDD hD hMMM hMMMM`.
Wrap literal text in square brackets: `"[Due] D MMM YYYY"`.

## Properties, methods, events

```js
const el = document.querySelector("hijri-calendar");

el.value;            // Date (local midnight) or null  — settable with a Date or string
el.hijriValue;       // { year, month (0-based), date } or null — settable
el.selected;         // full detail object (see event detail) or null
el.miqaats = [...];  // set miqaat data directly instead of miqaats-url
el.targetElement;    // bind an input element directly instead of a selector
el.isOpen;           // popup state

el.open(); el.close(); el.toggle();
el.goToToday();      // move the view to the current month
el.goTo(1448, 4);    // move the view to a Hijri year/month (0-based month)
el.clear();          // clear the selection and the target input
el.format(date, "hD hMMM hYYYYH");
```

Events bubble and cross the shadow boundary (`composed`), so `document.addEventListener` works.

| Event                   | `detail` |
| ----------------------- | -------- |
| `hijri-change`          | `{ hijri:{year,month,date,monthName}, gregorian: Date, iso, hijriIso, hijriText, gregorianText, value, ajd, miqaats:[…] }` or `null` when cleared |
| `hijri-navigate`        | `{ year, month, monthName }` whenever the visible month changes |
| `hijri-open` / `hijri-close` | popup opened / closed |
| `hijri-miqaats-loaded`  | `{ count }` |
| `hijri-error`           | `{ url, error }` if `miqaats-url` fails |

The target input additionally gets `data-iso`, `data-hijri` (`1448-05-10`), `data-hijri-text`
and `data-ajd` attributes, and native `input` + `change` events (dispatched via the native value
setter so React/Vue controlled inputs notice the change).

Typing into the target input also works: on `change` the widget parses `2026-12-25`,
`1448-05-10H`, `10 Jumada I 1448H` or anything `Date.parse` accepts and updates the selection.

### Static helpers

```js
HijriCalendarElement.format(new Date(), "hijri");          // "24 Jumada al-Ula 1448H"
HijriCalendarElement.parse("1448-05-10H").iso;             // "2026-10-20"
HijriCalendarElement.toHijri(new Date(2011, 2, 25));       // HijriDate {year:1432, month:3, day:20}
HijriCalendarElement.toGregorian(1432, 3, 20);             // Date 2011-03-25
HijriCalendarElement.HijriDate / .HijriCalendar            // the ported classes
```

## Auto-init without markup

If the script tag carries `data-target`, the element is created for you (the same script may be
included more than once; later copies only perform this step):

```html
<input id="pickup">
<script src="hijri-calendar.js" data-target="#pickup" data-popup data-format="hijri"></script>
```

Every `data-*` attribute becomes an element attribute (`data-week-start="monday"` → `week-start`).

## Theming

All colours and sizes are CSS custom properties on the element, so the host page can restyle it
without touching the shadow DOM:

```css
hijri-calendar {
  --hc-accent: #0b7a4b;      /* selected day, buttons, focus ring */
  --hc-accent-fg: #fff;
  --hc-today-bg: #ffe9a8;
  --hc-today-fg: #5a3e00;
  --hc-bg: #fff;  --hc-fg: #333;  --hc-muted: #999;  --hc-border: #ddd;  --hc-hover-bg: #eef2f8;
  /* miqaat badge colours, one per kind (cell tint, pill background, border and text are derived from these) */
  --hc-kind-urus: #d19a00;  --hc-kind-shahadat: #b83a3a;  --hc-kind-festive: #2e9b61;
  --hc-kind-night: #4a5bd6; --hc-kind-minor: #8a8f98;
  --hc-font: system-ui, sans-serif;  --hc-font-size: 16px;  --hc-radius: 6px;  --hc-cell-height: 4.5em;
  --hc-shadow: 0 8px 24px rgba(0,0,0,.18);   /* popup only */
  width: 420px;                               /* inline: just size the element */
}
```

Dark mode follows `prefers-color-scheme` automatically; force it with `theme="dark"` / `theme="light"`.
For deeper changes the inner pieces are exposed as `::part()`s: `frame`, `header`, `year`,
`month-row`, `month`, `gregorian-range`, `button`, `nav`, `today`, `grid`, `day` (plus `today` /
`selected` on those cells), `hijri-date`, `gregorian-date`, `miqaat-badges`, `miqaat-badge`
(plus `miqaat-urus` / `miqaat-shahadat` / `miqaat-festive` / `miqaat-night` / `miqaat-minor`),
`miqaat-more`, `miqaats` (the list under the grid).

## Miqaat badges

When miqaat data is loaded, each day cell shows its miqaats directly under the date numbers and
the cell gets a faint tint of the first miqaat's colour:

| Kind       | Icon    | Matches                                                             |
| ---------- | ------- | ------------------------------------------------------------------- |
| `urus`     | crown   | titles containing "Urus" / "Urs"                                    |
| `shahadat` | drop    | Shahadat, Ashura, Suyum, Chehlum, Wafat                             |
| `festive`  | sparkle | Eid, Milad, Wiladat, New Year, Ghadeer, and any other priority-1 day miqaat |
| `night`    | moon    | priority-1 miqaats with `"phase": "night"`                          |
| `minor`    | dot     | everything else                                                     |

Within a day, priority 1 comes before 2 before 3. Only `max-badges` pills are shown; the rest
collapse into "+N more" (the full list is in the cell tooltip, the screen-reader label and the list
under the grid once the day is selected).

The layout adapts to the width of the widget through a container query. Above roughly 640px of
grid width each miqaat is a pill with its icon and an ellipsised title. Below that, and always in
`popup` mode, the pills collapse to icon-only markers (with a short "+N") so small cells stay clean.
Restyle the pills with `hijri-calendar::part(miqaat-badge)` or the `--hc-kind-*` variables.

## Keyboard

The grid is focusable (Tab to it; in popup mode press **↓** in the input to open and focus it).

| Key | Action |
| --- | ------ |
| ← → ↑ ↓ | move by day / week (crosses months) |
| PageUp / PageDown | previous / next month, **Shift** for year |
| Home / End | first / last day of the month |
| Enter / Space | select |
| Escape | close the popup and return focus to the input |

## Notes

* Supported range is 1000H–3000H, as in the original site.
* The popup uses `position: fixed`. If you place the element inside an ancestor with a CSS
  `transform`/`filter`, the browser will position it relative to that ancestor; put the element
  elsewhere in the DOM (e.g. just before `</body>`) in that case.
* Port notes: the calendar arithmetic is a line-for-line port of `_lib/hijri_date.js` and
  `_lib/hijri_calendar.js` from `mumineen_calendar_js`, verified against its Jasmine specs and a
  full day-by-day round-trip from 1000H to 3000H. One upstream bug was fixed along the way:
  `fromAJD` returned "0 Moharram" for the last day of each 30-year cycle (30 Zilhaj of years
  ending in 29, e.g. 10 Sep 2018 = 30 Zilhaj 1439H).
* License: MIT, like the original.
