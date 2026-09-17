# Train domain — DEEP parity audit (four-layer method)

Collected 2026-09-17 on branch `feat/train-parity-p2`, read-only.
Prototype: `http://localhost:5190/nap.html?r=122#train/*` (source `docs/design_2.0/prototypes/companion-titanium/`).
Production: `http://localhost:5183/train/*`, started for this audit and killed afterwards.

**Method.** For every screen, four layers were captured live from the DOM in both apps:

1. **Interactive elements** — every `button / a / input / select / textarea / [role=button] / summary`
   inside the screen root, with its accessible name (`aria-label` else text). The prototype root is
   `.demo-pages` (or `.day-swipe-page` on Mai); the production root is `.mz-page` (or `.mz-play`).
   This is the layer the 2026-09-16 text-diff matrix could not see.
2. **Surfaces** — for every distinct class in the screen, `getComputedStyle` of the FIRST instance:
   `background-color` (+ whether a `background-image` paints), `border-top-width`,
   `border-top-color`, `border-radius`, `box-shadow`, `padding`.
3. **Text and copy**, section by section.
4. **Section order.**

Plus a browser-free static diff of the prototype's own stylesheets
(`load.css / session.css / gyak.css / train-pages.css / plan.css / sport.css`) against the ported
blocks in `frontend/src/styles/prototype.css`, looking for declarations that changed **meaning**.

**Out of scope by owner decision:** the global shell (the `boop` header and its round icon
buttons). The **seven-day strip** IS reported — it is a Train component, not shell.

**Counts: 19 BLOCKER · 32 MAJOR · 27 MINOR.**

---

## 0. The two findings that drove this audit — root cause, measured

### 0.1 The missing ⓘ buttons — a whole explain-layer that was never ported

The prototype has a shared helper `info(title, copy, art)` rendering
`<button class="pl-info" data-detail … aria-label="<title> — mit jelent?">`, defined three times
(`plan-pages.js:131`, `load-pages.js:12`, `gyak-pages.js:12`) and called **13 times** across Train.
Tapping one opens a `dialog()` sheet with the explanatory copy.

`pl-info` does not exist in production **at all**: zero rules in `frontend/src/styles/prototype.css`,
zero occurrences anywhere under `frontend/src`. All 13 are missing. Each is listed against its
screen below and in the closing table.

### 0.2 The bordered record cards — measured, with the mechanism

Prototype `.gy-rec` on `train/3/{key}`, computed live:

```
backgroundImage : none
borderTopWidth  : 0px
```

Production `.gy-rec` on `/train/exercises/exl-1`, computed live:

```
backgroundImage : linear-gradient(150deg, color(srgb 0.1336 0.1569 0.1995), rgb(26, 28, 36))
borderTopColor  : color(srgb 0.6329 0.7661 0.8908 / 0.2358)
borderTopWidth  : 1px
```

Canvas is `rgb(11, 13, 18)`. The production fill is fully **opaque** and measurably lighter than the
canvas — a lifted, bordered box. The prototype's is nothing at all.

**Why.** The prototype's rule is

```css
.gy-rec { border: 1px solid color-mix(in srgb, var(--mus-color) 16%, #ffffff10);
          background: linear-gradient(150deg, color-mix(in srgb, var(--mus-color) 8%, transparent), #ffffff03); }
```

`--mus-color` is set on `.gy-hero` only — measured: `.gy-hero` carries `"#e08a7c"`, `.gy-rec`
carries `""`. With the custom property unset, both `color-mix()` calls are **invalid at computed-value
time**, so the whole `border` and `background` shorthands drop to their initial values → no border,
no background. The port added a fallback (`var(--mus-color, var(--tag-gym))`) and swapped the
near-transparent literals for house tokens, which **validates** the declarations and makes them paint.

So the port simultaneously (a) fixed a latent bug and (b) changed the visual the owner compares
against. Whichever way it is resolved, the two do not match today. The same
`var(--mus-color, var(--tag-gym))` fallback was added on `.gy-card`, `.gy-curve-box`, `.pl-ex`,
`.pl-mrow`, `.pl-dest`, `.mm-region`, `.ld-group`, `.ld-wait-row` — see §19 for which of those
actually change what is painted.

---

## 1. `train/0` Mai → `/train/mai` (`TrainTodayPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.tr-start` — „Kezdjük az edzést / A mai tervezett edzésed →" | present, label **„Indítsuk"** |
| `button.tr-quick-tile` — „Egyedi edzés / Terv nélkül, most ＋" | present as a bare `button` (the `.tr-quick-tile` family is not rendered); sub-line dropped |
| `button.tr-quick-tile` — „Sport naplózása / Röplabda · futás · más ＋" | as above |
| **`button.tr-card.is-tappable` — „A mai kereted a Fuelben"** | **MISSING — BLOCKER** |
| **`button.tr-block.is-ahead` — „HOLNAP 18:00 · SPORT / Röplabda / A vállad és a lábad is kap belőle ›"** | **MISSING — BLOCKER** |
| **`summary` — „További részletek / TERHELÉS · REGENERÁCIÓ · TERV" + 3 `button.fuel-secondary` inside** | **MISSING — BLOCKER (4 controls)** |
| — | production-only: 7× `button.daychip`, 2× `button.card.mesorow`, `button.mtr-cta`, `button.mtr-quiet` |

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.tr-day` | `btw 1px rgba(255,255,255,.08)`, `r 26px`, `sh none`, `p 20px 20px 18px` — a floating rounded poster | `btw 0`, **`r 0px`**, `border-bottom` added, **`sh var(--shadow-sm)`**, `p 20px calc(var(--screen-gutter)+6px) 18px` — a full-bleed band | **MAJOR** — the poster card became a header band |
| `.tr-start` | `r 22px`, shadow tinted with `--domain-color` | `r 20px`, shadow tinted sage; `small` opacity .72→.82 | MINOR |
| `.tr-card` (the box around the kcal + muscle sections) | `btw 1px`, `r 22px`, `p 16px 18px`, fill transparent | **family not rendered**; the box moved onto `.tr-energy` / `.tr-mus`, which are **`bg rgb(26,28,36)` opaque** | MAJOR — those sections became filled cards |
| `.tr-pills span` | `bg #ffffff08`, `border #ffffff17` | `bg var(--surface-card)` (opaque), `border var(--border-subtle)` | MINOR |
| `.tr-quick-tile`, `.tr-block` | bordered rounded tiles | families absent | MAJOR (see layer 1) |

**3 · Text and copy** — eyebrow `SZERDA 17:00 · GYM` → `MA 07:30 · MAV · GYM`; title `Felsőtest A` →
`Pull Day` (repeated a second time under the pills); pills `~45 perc · felsőtest · 3. hét / 6` →
`5 gyakorlat · 22 szett · ~67 perc`; the kcal tap-chip „Megnézem a mai keretem ›" replaced by a static
note „Becslés, nem mérés." (**MAJOR** — a door became a caption); muscle words
`tervben erős` → `erős`; heading „Bármi más, ami ma mozgás" absent, each tile carries its own
`GYORS INDÍTÁS` eyebrow instead.

**4 · Section order** — prototype: poster → CTA → quick tiles → kcal → muscles → ahead → details.
Production: **daystrip** → poster → CTA → a logged sport card → kcal → muscles → quick tiles →
2 mesorows → `REGGELI EDZÉS` nudge. The quick tiles moved from 3rd to 7th (**MINOR**), and three
production-only blocks were appended (**MAJOR**).

**Seven-day strip (Train component, in scope):** production renders `.daystrip` with 7
`button.daychip` (`HÉT 14 — / KEDD 15 ✓ / SZE 16 — / MA 17 ✓ / PÉN 18 — / SZO 19 — / VAS 20 pihenő`).
The prototype has a single date row `‹ MA · September 9., Szerda ›` plus the footer hint
`← Húzd oldalra a napváltáshoz →`. **MAJOR** — a different navigation model, 7 production-only controls.

---

## 2. `train/1` Terv → `/train/mesocycles` (`MesoTervPage`)

**1 · Interactive elements** — no prototype control is missing. Production makes the poster itself a
button (`button.pl-poster :: „Aktív mezociklus megnyitása"`) — production-only, **MINOR**.
Day rows, both destination cards and the closing quiet row are all present.

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.pl-dest` | `bg transparent` + a ~4 % gradient | **`bg rgb(26,28,36)`** opaque | **MAJOR** — flat → boxed |
| the closing „Edzésterv lezárása" row | `.pl-row` `bg rgba(255,255,255,.02)` — a *quiet* row | rendered as `.pl-item` `bg rgb(26,28,36)` — a solid card | **MAJOR** — „quiet" is gone |
| `.pl-poster` | `sh none` | `sh var(--shadow-sm)` added | MINOR |
| `.pl-day` | `sh none` | `sh var(--shadow-sm)` added | MINOR |
| `.pl-days` | `p 0 20px` | `p 0 12px` | MINOR |
| heading | `h3.pl-h3` „A heted" sentence case | `.tr-eyebrow` „A HETED" uppercase | MINOR |
| — | — | production-only `.pl-phase` chip („Emelkedés") | MINOR |

**3 · Copy** — prose merged from two sentences into one; title carries a season suffix. **MINOR.**
**4 · Order** — identical.

---

## 3. `train/1/day/{nap}` → `/train/mesocycles/:id/days/:day` (`MesoDayPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` „‹ Vissza" (docked inside the hero) | `button.mz-backbtn` „Vissza", in a separate head row above the hero |
| **`button.pl-info` — „Miért nyolcnál a jelölés?"** (on „Mit terhel ez a nap") | **MISSING — BLOCKER** |
| **`button.pl-info` — „Mikortól él a változtatás?"** (on „A nap gyakorlatai") | **MISSING — BLOCKER** |
| **6× `button` „Előrébb" / „Hátrébb"** (the ↑ ↓ reorder arrows, `.pl-ex-move`) | **MISSING — BLOCKER** (`pl-ex-move` has no CSS and no renderer in production) |
| `button.pl-add` „＋ Gyakorlat hozzáadása" | present |
| — | production-only: `button.pl-editlink` „A nap szerkesztése", `.pl-share` chip |

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.pl-mrow` (muscle chips) | `btw 1px`, `r 14px`, `p 9px 12px`, tinted gradient | **`btw 0`, `r 0px`, `p 6px 2px`, no background** | **MAJOR** — the chips lost their card (the opposite direction from everything else) |
| `.pl-ex` | `bg transparent` + ~3 % gradient | **`bg rgb(26,28,36)`** opaque | **MAJOR** |
| `.pl-dhero` | `p 58px 20px 26px` (space for the docked back pill), `sh none` | `p 20px 18px 24px`, `sh var(--shadow-sm)` | MINOR |
| `.pl-add` | `bg rgba(255,255,255,.016)`, dashed `rgba(255,255,255,.125)` | `bg rgba(234,232,238,.05)`, dashed `rgba(234,232,238,.09)` — fainter outline | MINOR |

**3 · Copy** — eyebrow, stat row and exercise grid all match in shape. Starting weights render `—`
in production where the prototype shows kg (data, not parity).
**4 · Order** — identical up to the add-CTA; production appends the quiet editor link. **MAJOR**
(the editor lives one route down at `…/edit`, a pre-Titanium screen with English band words).

---

## 4. `train/1/week` → `/train/mesocycles/:id/week` (`MesoWeekPage`)

**1 · Interactive elements** — nothing missing. Production's rows carry an overriding
`aria-label` („Hát részletek") that hides the row's own numbers and verdict from a screen reader,
where the prototype exposes the full row text. **MINOR (a11y).**

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.pl-item` | `bg rgba(255,255,255,.02)` — near-invisible | **`bg rgb(26,28,36)`** opaque | **MAJOR** |
| `.pl-whero`, `.pl-whero-art` | the week hero + its art | **not ported** (1 stray CSS rule, no renderer); replaced by a `.pl-dhero` poster with a `88 szett` numeral and `var(--shadow-sm)` | **MAJOR** |
| `.pl-scale-bar` | `bg rgba(255,255,255,.063)` | `bg rgba(234,232,238,.05)` | MINOR |

**3 · Copy** — production adds a band word prefix on every row (`Építés ·` / `Tartás ·`), a
`14 szettel több a múlt héthez képest.` line, a live-system line
(`Élő rendszer · a következő görgetés hétfő hajnal`), a summary chip row and a **second** closing
footnote. **MAJOR** (production is a superset; the prototype's screen says less).
**4 · Order** — prototype: head → prose → rows → note. Production: poster+numeral → prose → extra
lines → chip row → rows → note → second note. **MINOR.**

---

## 5. `train/1/muscle/{key}` → `/train/mesocycles/:id/week/:muscle` (`MesoMusclePage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back` „‹ Vissza" | `button.mz-backbtn` „‹ Heti vizsgálat" |
| **`button.pl-info` — „Mit jelentenek a jelölések?"** (on „Hol tartasz") | **MISSING — BLOCKER** |
| `button.pl-ex.is-link` (the „Hol edzed" day row) | present |
| — | production-only `button.chip` „Felülír" |

**2 · Surfaces** — `.pl-ex` transparent → **`bg rgb(26,28,36)` opaque** (**MAJOR**).
`.pl-mhero` / `.pl-mhero-art` **not ported** — replaced by the `.pl-dhero` poster with a numeral and
a shadow (**MAJOR**). `.pl-scale-wrap` padding 22→20px (MINOR).

**3 · Copy** — production adds an explanatory paragraph under the gauge and an entire
`Honnan jön ez a szám` provenance block (`BASELINE · RP TÁBLA`, `FÓKUSZ-SÁV`, `RÁD SZABVA`,
`EREDŐ · A BLOKKBAN`, `Mennyire biztos a sáv · 85%`) that has no prototype counterpart. **MAJOR.**
**4 · Order** — matches through „Hol edzed"; the provenance block is inserted before the versus block. **MINOR.**

---

## 6. `train/1/library` → `/train/mesocycles/konyvtar` (`MesoKonyvtarPage`)

**1 · Interactive elements** — full parity (running card, queued card, „Új terv összeállítása",
both destination cards).

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.pl-arc` (the 1…6 week dots on the running card) | rendered | **absent** — replaced by a text line `Pull / Push / Legs · 5×/hét` | **MAJOR** — a graphic replaced by text |
| `.pl-dest` | `bg transparent` | **`bg rgb(26,28,36)`** | **MAJOR** |
| `.pl-dhero` / `.pl-lhero` | `sh none` | `sh var(--shadow-sm)` | MINOR |

**3 · Copy** — lead reworded (`Ami most fut…` → `Itt élnek a terveid…`), heading pluralised
(`Következik` → `Következnek`). **MINOR.**
**4 · Order** — identical.

---

## 7. `train/1/library/templates` → `/train/templates` (`MesoTemplatesPage`)

**1 · Interactive elements** — full parity.
**2 · Surfaces** — `.pl-lib-card` matches (transparent + hairline). `.pl-dhero`/`.pl-lhero` gained
`var(--shadow-sm)` (MINOR). `.pl-lib` padding `0 20px 18px` → `2px 17px 19px` (MINOR).
**3 · Copy** — head and lead **verbatim**; production adds a stat strip
`2 sablon · 2 futam indult belőlük` (MINOR).
**4 · Order** — identical apart from the inserted stat strip.

---

## 8. `train/1/library/template/{key}` → `/train/templates/:id` (`MesoTemplateStoryPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` „‹ Sablonjaid" | present (`mz-backbtn`) |
| **`button.pl-info` — „Mit jelent a szám?"** (on „Heti szettek izmonként") | **MISSING — BLOCKER** — production instead prints the same copy as a static paragraph, so the sentence survives but the control does not |
| 3× `button.pl-row` (runs from this template) | present (2, data) |
| `button.pl-lib-new.is-start` „Futam indítása ebből" | present |
| — | production-only: `Szerkesztés`, `Másolat készítése`, `Sablon törlése` rows |

**2 · Surfaces** — `.pl-row` `bg rgba(255,255,255,.02)` → `rgba(234,232,238,.05)` (MINOR);
`.pl-tpl-exs` top rule `#ffffff0d` → `var(--border-subtle)` (MINOR); hero shadow added (MINOR).
**3 · Copy** — eyebrow carries the split; lead shortened. **MINOR.**
**4 · Order** — matches; production appends the three management rows. **MINOR.**

---

## 9. `train/1/library/closed` → `/train/mesocycles/futamok` (`MesoFutamokPage`)

**1 · Interactive elements** — nothing missing; production adds 7 controls
(`Összevetés` inside the stat strip, plus `Sablonná` + `Újrafuttatás` per row).
**2 · Surfaces** — `.pl-stars` present in both CSS but production renders a numeric verdict line
instead of the star row on the list (**MAJOR** — a graphic replaced by free text).
`.pl-lib-foot` production-only divider (MINOR).
**3 · Copy** — title `Amit végigvittél` → `Amit lezártál`; lead reworded; stat strip
`37 edzés · 10 rekord` → `3 lezárt futam · 20 hét összesen · Összevetés`; each row gains a free-text
verdict (`8/10 — Chest Row +12.5kg…`). **MAJOR.**
**4 · Order** — identical.

---

## 10. `train/1/library/closed/{key}` → `/train/mesocycles/:id/report` (`MesoReportPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` „‹ Lezárt futamaid" | `button.mz-backbtn` „Vissza" — no chevron, no destination name (MINOR) |
| **`button.pl-info` — „Mit mutat a sáv?"** (on „Izmaid ebben a futamban") | **MISSING — BLOCKER** |
| — | production-only: `summary` „Mit olvas ki ebből a gép?", 3× `button.cta-ghost`, `button.chip` „Riport újragenerálása" |
| — | one production control has **no accessible name** (`button.cta-ghost :: (no name)`) — MINOR (a11y) |

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.pl-lib-muslist` / `.pl-lib-musrow` / `.pl-lib-musbar` — the bordered muscle rows with a start→peak bar | rendered | **CSS ported but nothing renders it** (grep: no consumer under `frontend/src`); the section is plain text rows `IZMONKÉNT · INDULÁS → ELÉRT CSÚCS / PLAFON` | **BLOCKER** — a whole graphic section missing |
| `.pl-day-facts` / `.pl-lib-facts` (the three facts) | rendered | replaced by an `ld-hero-pct` **`88 %`** gauge; `.pl-lib-facts` has no CSS and no renderer | **MAJOR** |
| `.pl-versus*` | matches | matches | — |

**3 · Copy** — lead differs; the plain-word muscle verdicts (`végig bírta az emelést`,
`a negyedik héten állt meg`) are **absent** (**MAJOR**); production adds `ERŐ · 6 GYAKORLAT`,
`REKORDOK · 7 MEDÁL`, `SAJÁT ÉRTÉKELÉS` and a collapsed AI block. **MAJOR.**
**4 · Order** — prototype ends on the versus block; production ends on the versus block too, then
the collapsed AI details and the three actions. **MINOR.**

---

## 11. `train/1/new` (wizard) → `/train/mesocycles/new` (`MesocyclePlannerPage`)

**Known whole-screen gap — noted and not re-measured.** The prototype's six steps
(`new` source pick → `new/basics` → `new/days` → `new/day/{nap}` → `new/focus` → `new/review`) with a
persistent `Alapok · Napok · Izmok · Indítás` step bar are replaced by one pre-Titanium „interview"
page. The source step, the per-day editor step and the review/start-date step have no counterpart.
The `wz-` family is essentially unported: **3** `wz-` occurrences in `prototype.css` against **~40**
rules in the prototype's `plan.css`, and `wz-chip` (the prototype's toggle chip, also used on
`train/2/map` and `train/3`) has **zero** rules and zero renderers in production.
**BLOCKER** (one finding, counted once).

---

## 12. `train/2` Terhelés → `/train/week` (`TrainWeekPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| **`button.pl-info` — „Miből áll össze a szám?"** (hero) | **MISSING — BLOCKER** |
| `button.ld-map-card` „Elöl és hátul, ami már dolgozott" | present |
| **`button.pl-info` — „Mit mutat a sáv?"** (on „Izomcsoportok ezen a héten") | **MISSING — BLOCKER** |
| 6× `button.ld-group` | present (9, data) |
| **`button.pl-info` — „A sport és a szettek"** (sport card) | **MISSING — BLOCKER** |
| `button.ld-move-card` „Minden mozgásod a héten" | present |
| — | production-only: `button.mz-pgact` „Időpontok", `button.mz-pgact` „Mezociklus áttekintő · W3/6", `button.card.dashedcta` „+ Saját edzés" |

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.ld-hero` | `p 24px 20px 26px`, no bottom rule | `p 18px 18px 20px`, **`border-bottom: 1px solid color-mix(--ld-accent 18%)` added** | MINOR |
| `.ld-group`, `.ld-map-card`, `.ld-move-card` | fills are ~1–7 % white gradients over the canvas | fills are `var(--surface-card)` gradients — **opaque** | **MAJOR** (one finding, three families) |
| `.ld-sport` accent | sky `#78cfe7` | rose `≈#e9a3ae` (`--tag-sport`) | MINOR — the sport accent was re-mapped |
| `.ld-note` | — | production-only opaque card `bg rgb(26,28,36)`, `btw 1px`, `r 18px` | **MAJOR** (see copy) |
| `.ld-hero-chips` / `.ld-hero-medal` | — | production-only | MINOR |

**3 · Copy** — hero eyebrow `RÁMPA` → `MAV`; every muscle row's verdict collapses to
`erre a hét második fele épül`; the sport card loses the named session
(`Röplabda / 95 perc · 610 kcal`) for generic totals (**MAJOR**); production closes with an
English-jargon paragraph (`recurring · független`, `pacing`, `alvás-onsetet`) that the prototype
does not have (**MAJOR**).
**4 · Order** — matches; production appends `+ Saját edzés` and the jargon note. **MINOR.**

---

## 13. `train/2/map` → `/train/week/terkep` (`TrainWeekMapPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` „‹ Terhelés" | `button.mz-backbtn.ld-back` „‹ Terhelés" — matches |
| **`button.pl-info` — „Miből rajzoljuk?"** | **MISSING — BLOCKER** |
| 2× `button.wz-chip` („Eddig megvolt" / „A heti terv") | present as `button.segtab` — different chrome, same copy (MINOR) |
| `button.pl-row.is-quiet` „Minden izomjel" | present, copy verbatim, below the footnote — matches |

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.ld-sport-note` | `bg #78cfe70d`, `border 1px #78cfe72b`, `r 15px`, `p 12px 13px` — a tinted note card | **all four declarations dropped**: `bg transparent`, `btw 0`, `r 0`, `p 0` — plain text | **MAJOR** — the footnote lost its card |
| `.ld-wait-row` | `r 15px`, `p 10px 12px`, `bg #ffffff04` | `r 14px`, `p 9px 12px`, `var(--surface-card)` gradient | MINOR |
| `.ld-map-stage` | `p 6px 4px 0` | `p 4px 0 0` | MINOR |
| `.ld-map-big` | `display: flex` | `display: block` | MINOR |
| `.pl-row` | `bg rgba(255,255,255,.02)` | `bg rgba(234,232,238,.05)` | MINOR |
| hero | `.pl-dhero.pl-lhero` | `.ld-hero` + `.ld-back` (a shadowed pill) | MINOR |

**3 · Copy** — head, lead, toggle, legend and the quiet doorway are **verbatim**;
„A röplabda ezeken is dolgozott" → „A sport ezeket is dolgoztatta" (MINOR).
**4 · Order** — identical.

---

## 14. `train/2/mozgas` → `/train/week/mozgas` (`TrainWeekMozgasPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` | present |
| **`button.pl-info` — „Miért becslés?"** | **MISSING — BLOCKER** |
| **`button.pl-info` — „Hogyan olvasd?"** (on „Izomcsoportok, sporttal együtt") | **MISSING — BLOCKER** |

Production has **one** control on the whole screen (the back pill) where the prototype has three.

**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.ld-sport-chip` | `bg rgba(120,207,231,.07)`, **`btw 1px`**, `p 4px 10px 4px 6px` — an outlined pill | **`btw 0`**, `bg rgba(226,122,139,.16)`, `p 3px 8px` — a filled pill | MINOR |
| `.ld-move-box` | `p 13px 14px`, ~1 % gradient | `p 14px 13px`, `var(--surface-card)` gradient — opaque | **MAJOR** |
| `.ld-event*` | — | a whole production-only section (7 scheduled sessions with `▲▲▲` glyphs) | **MAJOR** |

**3 · Copy** — eyebrow `MINDEN MOZGÁSOD` → `MINDEN MOZGÁSOD EDDIG A HÉTEN`; the hero is split into a
numeral + unit; **the `~1002 kcal a mozgásból` total line is absent** (**MAJOR**).
**4 · Order** — matches; production appends the scheduled-sessions section + its note. **MINOR.**

---

## 15. `train/2/jelek` → `/train/week/jelek` (`TrainWeekJelekPage`)

**1 · Interactive elements** — exactly one in each (`‹ Izomtérkép`). Parity.
**2 · Surfaces**

| Family | Prototype | Production | Verdict |
|---|---|---|---|
| `.mm-region` | `bg rgba(255,255,255,.016)` | **`bg rgb(26,28,36)`** opaque | **MAJOR** |
| `.mm-cell` | base rule `#ffffff04` / `#ffffff0d` | `rgba(234,232,238,.05)` / `rgba(234,232,238,.09)` — equivalent | — |
| `.mm-head` | `p 58px 0 0` | `p 0` (the back pill moved into `.ld-hero`) | MINOR |

Caveat: the prototype's first cell was measured **lit** (region-tinted) because its fixture lights it;
production's is unlit because mock has no logged week. Not a port difference.

**3 · Copy** — head and lead **verbatim**, all six region blocks and counts match. Production adds one
honest empty-state line. **MINOR.**
**4 · Order** — identical.

---

## 16. `train/3` Gyakorlatok → `/train/exercises` (`ExercisesPage`)

**1 · Interactive elements** — search field + `Mind` + region chips + one card per exercise, all
present. Prototype 27 controls / production 30. Production-only:
`button.pl-poster-foot-link` („8 medál · a medálvitrinbe") and `button.pl-add`.
The `Core` chip is absent because mock has no Core exercise (data, not parity).
The chips are `button.chip.tapchip` in production vs `button.wz-chip` in the prototype — MINOR.

**2 · Surfaces** — `.gy-card` fill: ~1 % white gradient → `var(--surface-card)` gradient, **opaque**
(**MAJOR**, same substitution as everywhere). `.pl-dhero`/`.pl-lhero` gained `var(--shadow-sm)` (MINOR).
`.gy-card-empty` colour `rgba(255,255,255,.267)` → `rgb(110,104,121)` (MINOR).

**3 · Copy** — poster, lead and stat-strip shape **verbatim**; the search placeholder changes from
„Keresés névre vagy izomra…" to „Keresés a gyakorlatok között" (**MINOR**).
**4 · Order** — identical; production appends the `.pl-add` authoring row. **MINOR.**

---

## 17. `train/3/{key}` exercise story → `/train/exercises/:key` (`ExerciseStoryPage`)

**1 · Interactive elements**

| Prototype | Production |
|---|---|
| `button.pl-back.is-inhero` „‹ Gyakorlatok" | `button.mz-backbtn` (text „‹ Gyakorlatok") |
| **`button.pl-info` — „Mi számít rekordnak?"** (on „Rekordjaid") | **MISSING — BLOCKER** |
| **`button.pl-info` — „Mit mutat a vonal?"** (on „Az erőd íve") | **MISSING — BLOCKER** |
| 2× `button.pl-row` („Hol szerepel") | present |

These are **the two ⓘ buttons the owner spotted.**

**2 · Surfaces**

| Family | Prototype (measured) | Production (measured) | Verdict |
|---|---|---|---|
| `.gy-rec` | `bgImage none`, `btw 0px` — **no border, no fill** | `bgImage linear-gradient(150deg, rgb(34,40,51), rgb(26,28,36))` (opaque), `btw 1px` | **MAJOR** — the owner's finding, confirmed |
| `.gy-curve-box` | `btw 1px`, ~1 % fill | `btw 1px`, opaque `var(--surface-card)` fill | **MAJOR** |
| `.gy-medal` | amber literals `#ffd88a10/24` | `color-mix(--amber …)` — equivalent | — |
| `.gy-next` | `#ffd88a14/05` + `#ffd88a2e` | `color-mix(--amber …)` — equivalent | — |
| `.gy-rec-bar` | `bg #ffffff10` | `bg var(--surface-recess)` = `rgba(234,232,238,.05)` — equivalent | — |
| `.pl-row` | `bg rgba(255,255,255,.02)` | `bg rgba(234,232,238,.05)` | MINOR |
| `.gy-hero` | `p 58px 20px 26px` (docked back pill) | `p 20px 18px 24px` + `var(--shadow-sm)` | MINOR |

**3 · Copy**

- the hero **cue prose** („Talpak lent. Stabil lapockák…") is **absent** — **MAJOR**;
- the 1RM delta wording differs („+2,5 kg a múltkori óta" → „+2,1 kg a korábbi csúcsod óta") — MINOR;
- the record cards gain a „Becslés, nem mérés" caption line — MINOR;
- the „Következő cél" line is present but reworded — MINOR;
- the curve caption „eddig · a terv várakozása" → „ami eddig megtörtént · <dátum> óta / becslés, nem
  mérés", and the **dashed projected branch is not drawn** — **MAJOR** (a graphic element missing);
- the middle hero fact becomes „ebből az utolsó 52 látszik" instead of a date — MINOR.

**4 · Order** — identical (hero → facts → Rekordjaid → next target → curve → Medáljaid → Hol szerepel).

---

## 18. Active-workout overlay → `/train/session` (`ActiveWorkoutPage`)

**1 · Interactive elements** — the prototype's whole control set is present: per-exercise
`wo-card-log` + `wo-card-menu`, the kg/rep/RIR inputs, `wo-check` per set, `wo-finish.is-skip`
(„Edzés kihagyása") and the dock's `wo-dock-finish` („Lezárás →", portaled outside `.screen-content`,
verified present). **Nothing missing.**
Production-only: a `?` Kalauz round button, a `⋯` „Gyakorlat műveletek" button, and 3× `wo-check`
„Oldal L / B / R" per unilateral exercise.

**2 · Surfaces** — the `wo-` family is the **best-ported** family in the domain: `.wo-card`,
`.wo-card-art`, `.wo-cue`, `.wo-row`, `.wo-rows-head`, `.wo-finish`, `.wo-dock`, `.wo-dock-finish`
all match to the pixel, literals included. The only CSS meaning-change in the whole family is
`.wo-verdict { display: grid → flex }` (MINOR). `.wo-head` is not rendered in production (a
different head markup) — MINOR.

**3 · Copy** — production adds a niggle warning banner, a `Túlterhelés · 2× +súly · 1× +rep · 1× −súly`
`.wo-overload` block and a `⚡ PROGRESSZIÓ / MÚLT HÉT / MA A CÉL` block per card. **MAJOR**
(production-only sections).
**4 · Order** — head → banner → overload → cards → skip → dock, against the prototype's
head → cards → skip → dock. **MINOR.**

**Rest state (not compared):** the prototype's dock swaps to a rest timer with `+30s` / `Kész`
(`.wo-dock-acts`). Production's rest state could not be reached (see §20).

---

## 19. The ceremony, both steps → `WorkoutCeremony`

**Could not be driven in the browser** — see §20. What follows is a source-level comparison only
(`frontend/src/features/train/components/WorkoutCeremony.tsx` against `session.js:290–390`), and it
is **not** a four-layer measurement.

**Step 1 (`cer-screen`).** Prototype controls: one — `button.wo-close-cta` „Részletek / Izomcsoportok
és a nyert kalória". Production renders the same CTA with the **same copy verbatim**
(`WorkoutCeremony.tsx:350–357`). All step-1 classes are ported: `cer-sky`, `cer-stars`, `cer-aura`,
`cer-bar`, `cer-fill`, `cer-comet`, `cer-counters`, `cer-result`, `cer-stats`, `cer-record`, `cer-foot`.

**Step 2 (`cer-details-screen`).** Prototype controls: `button.cer-kcal` („+ 260 kcal / Ennyit nyertél
a mai mozgással ›"), `button.wo-close-cta` („Edzés lezárása / Mind a 9 szetted megvan"),
`button.wo-secondary` („Vissza az értékeléshez"). Production has all three, but:

- the closing CTA reads **„Vissza a mai napra / Az edzés lezárva és elmentve"** instead of
  „Edzés lezárása / Mind a N szetted megvan" — **MAJOR** (it says a different thing: the prototype's
  button *performs* the close, production's is post-save navigation);
- production adds a **free-text note field** („Hogy ment?" + „Nem kötelező — később is hozzáírhatod.")
  between the kcal card and the CTAs — **MAJOR**, a production-only section;
- `cer-kcal` gains a `cer-recap-note` „Becslés, nem mérés" line — MINOR;
- the muscle rows are `cer-mstar*` in production vs `wo-mstar*` in the prototype — the CSS is ported
  under both names; MINOR.
- CSS: `.cer-cta` gains `display: grid` in production (the prototype leaves it unset) — MINOR.

Production-only ceremony classes with no prototype counterpart: `cer-breathe`, `cer-chal`, `cer-chals`,
`cer-eyebrow`, `cer-glu`, `cer-pop`, `cer-section`, `cer-starrow`, `cer-supplied`.

---

## 20. CSS meaning-changes (browser-free static diff)

Two passes were run over the prototype's own stylesheets against `frontend/src/styles/prototype.css`,
restricted to selectors that exist **verbatim in both**.

### 20.1 The systemic one — translucent literal → opaque house token

The port's stated rule is that it "tinted dark-only literals against house tokens so the light theme
survives". Measured token values in production's dark theme:

| token | computed |
|---|---|
| `--canvas` | `rgb(11, 13, 18)` |
| `--surface-card` | `rgb(26, 28, 36)` — **opaque, lighter than the canvas** |
| `--surface-recess` | `rgba(234, 232, 238, 0.05)` — translucent |
| `--border-subtle` | `rgba(234, 232, 238, 0.09)` — translucent |

So the substitution is **harmless** wherever the literal became `--surface-recess` or
`--border-subtle` (those stay translucent and are within a couple of percent of the originals), and
**changes what is painted** wherever a ~1–4 % white literal became `--surface-card`. The latter turns
a family that was effectively invisible against the canvas into a lifted, filled card.

**Families where a transparent/near-transparent fill became an opaque `--surface-card` fill
(21 declarations, the list the owner's record-card finding belongs to):**

| selector | prototype | production |
|---|---|---|
| `.ld-group` | `linear-gradient(150deg, color-mix(--mus-color 7%, transparent), #ffffff03)` | `linear-gradient(150deg, color-mix(--mus-color 10%, var(--surface-card)), var(--surface-card) 72%)` |
| `.ld-sport` | `linear-gradient(120deg, #78cfe714, #78cfe705)` | `linear-gradient(120deg, color-mix(--tag-sport 10%, var(--surface-card)), var(--surface-card) 72%)` |
| `.ld-map-card` | `linear-gradient(150deg, color-mix(--domain-color 8%, transparent), #ffffff03)` | `…, var(--surface-card)), var(--surface-card) 70%` |
| `.ld-move-card` | `linear-gradient(120deg, #78cfe712, #78cfe704)` | `…, var(--surface-card)), var(--surface-card) 70%` |
| `.ld-move-box` | `linear-gradient(150deg, color-mix(--mus-color 10%, transparent), #ffffff03)` | `…, var(--surface-card)), var(--surface-card) 72%` |
| `.ld-wait-row` | `#ffffff04` | `linear-gradient(150deg, color-mix(--mus-color 8%, var(--surface-card)), var(--surface-card) 72%)` |
| `.gy-card` | `linear-gradient(150deg, color-mix(--mus-color 6%, transparent), #ffffff03)` | `…, var(--surface-card)), var(--surface-card)` |
| **`.gy-rec`** | `linear-gradient(150deg, color-mix(--mus-color 8%, transparent), #ffffff03)` | `…, var(--surface-card)), var(--surface-card)` |
| `.gy-curve-box` | `linear-gradient(150deg, color-mix(--mus-color 6%, transparent), #ffffff03)` | `…, var(--surface-card)), var(--surface-card)` |
| `.mm-region` | `radial-gradient(…), #ffffff04` | `radial-gradient(…), var(--surface-card)` |
| `.pl-item` | `#ffffff05` | `var(--surface-card)` |
| `.pl-day` | `linear-gradient(150deg, #ffffff08, #ffffff03)` | `linear-gradient(150deg, var(--surface-card), color-mix(--surface-card 60%, var(--surface-recess)))` |
| `.pl-day.is-now` | `radial-gradient(…), linear-gradient(150deg, #ffffff0a, #ffffff03)` | `radial-gradient(…), linear-gradient(150deg, var(--surface-card), …)` |
| `.pl-dest` | `radial-gradient(…), linear-gradient(155deg, #ffffff0a, #ffffff03)` | `radial-gradient(…), var(--surface-card)` |
| `.pl-ex` | `radial-gradient(…), linear-gradient(155deg, #ffffff08, #ffffff03)` | `radial-gradient(…), var(--surface-card)` |
| `.pl-lib-card` | `linear-gradient(150deg, #ffffff09, #ffffff03)` | `linear-gradient(150deg, var(--surface-card), …)` |
| `.pl-lib-card.is-now` | `linear-gradient(150deg, color-mix(--domain-color 13%, transparent), #ffffff03)` | `radial-gradient(…), linear-gradient(150deg, var(--surface-card), …)` |
| `.tr-day` | `radial-gradient(…), linear-gradient(155deg, #ffffff0f, #ffffff05)` | `radial-gradient(…), linear-gradient(155deg, var(--tr-wash), var(--surface-card) 68%)` |
| `.tr-day.is-done` | `linear-gradient(155deg, color-mix(--domain-color 16%, transparent), #ffffff05)` | `radial-gradient(…), linear-gradient(155deg, …, var(--surface-card) 68%)` |
| `.tr-pills span` | `#ffffff08` | `var(--surface-card)` |
| `.pl-poster-foot span` / `.pl-dhero-pills span` | `#ffffff08` | `var(--surface-card)` |

Borders that took the same treatment but stayed translucent — `#ffffff10` → `var(--border-subtle)` on
`.ld-group`, `.ld-map-card`, `.ld-move-card`, `.ld-wait-row`, `.gy-card`, `.gy-curve-box`, `.mm-cell`,
`.pl-item`, `.pl-row`, `.pl-day`, `.pl-day-tag`, `.pl-day-facts i`, `.pl-ex-grid span`, `.pl-add`,
`.pl-mstats span`, `.pl-lib-card`, `.pl-lib-musrow`, `.pl-tpl-exs`, `.tr-pills span`,
`.pl-poster-foot span`, `.pl-dhero-pills span` — and the mix-target swaps
`color-mix(… , #ffffff10)` → `color-mix(… , var(--border-subtle))` on `.gy-rec`, `.pl-ex`, `.pl-dest`.
Measured delta ≈ 2–3 % alpha. **MINOR, one finding for the whole set.**

### 20.2 Discrete meaning-changes (declaration added, dropped, or flipped)

| selector | property | prototype → production | meaning |
|---|---|---|---|
| `.tr-day` | `border` | `1px solid #ffffff14` → *(dropped)* | the card's outline is gone |
| `.tr-day` | `border-radius` | `26px` → *(dropped)* | rounded poster → square band |
| `.tr-day` | `border-bottom` | *(absent)* → `1px solid color-mix(--tr-accent 18%)` | a band rule appears |
| `.tr-day` | `box-shadow` | *(absent)* → `var(--shadow-sm)` | a shadow appears |
| `.tr-day` | `display` | `block` → *(dropped)* | — |
| `.tr-day.is-live` | `border-color` → `box-shadow` | `color-mix(--domain-color 40%)` → `var(--shadow-sm), inset 0 0 0 1px color-mix(--tr-accent 42%)` | the live ring became an inset shadow |
| `.tr-start` | `background` | domain-gradient → *(dropped, tokenised elsewhere)* | — |
| `.tr-start` | `box-shadow` | `0 14px 30px -16px …, 0 2px 0 #ffffff40 inset` → *(dropped)* | the inner top highlight is gone |
| `.tr-start` | `border-radius` | `22px` → `20px` | — |
| `.tr-energy` | `background`/`border`/`border-radius`/`box-shadow`/`padding` | *(all absent)* → `var(--surface-card)` / `1px solid var(--border-subtle)` / `22px` / `var(--shadow-sm)` / `16px 18px` | a transparent section became a filled card (it inherited `.tr-card`'s box, which is unported) |
| `.tr-mus` | same five | *(all absent)* → same values | as above |
| `.ld-hero` | `border-bottom` | *(absent)* → `1px solid color-mix(--ld-accent 18%)` | a rule appears |
| `.ld-hero` | `padding` | `24px 20px 26px` → `18px calc(var(--screen-gutter)+6px) 20px` | — |
| **`.ld-sport-note`** | `background` | `#78cfe70d` → *(dropped)* | **the note card lost its fill** |
| **`.ld-sport-note`** | `border` | `1px solid #78cfe72b` → *(dropped)* | **lost its border** |
| **`.ld-sport-note`** | `border-radius` | `15px` → *(dropped)* | **lost its radius** |
| **`.ld-sport-note`** | `padding` | `12px 13px` → *(dropped)* | **lost its padding** — a card became plain text |
| `.ld-sport-chip` | `border` | `1px solid #78cfe733` → *(dropped)* | outlined pill → filled pill |
| `.ld-sport-chip` | `padding` | `4px 10px 4px 6px` → `3px 8px` | — |
| `.ld-map-big` | `display` | `flex` → `block` | layout model changed |
| `.ld-map-stage` | `padding` | `6px 4px 0` → `4px 0 0` | — |
| `.ld-wait-row` | `border-radius` / `padding` | `15px` → `14px` / `10px 12px` → `9px 12px` | — |
| `.ld-move-box` | `padding` | `13px 14px` → `14px 13px` | axes swapped |
| `.ld-glass-name small`, `.ld-sport-copy small` | `display` | *(absent)* → `block` | — |
| **`.pl-mrow`** | `background` | `linear-gradient(150deg, color-mix(--mus-color 8%, #ffffff05), #ffffff03)` → *(dropped)* | **the muscle chip lost its fill** |
| **`.pl-mrow`** | `border` | `1px solid color-mix(--mus-color 16%, #ffffff0c)` → *(dropped)* | **lost its border** |
| **`.pl-mrow`** | `border-radius` | `14px` → *(dropped)* | **lost its radius** |
| **`.pl-mrow`** | `padding` | `9px 12px` → `6px 2px` | **a chip became a bare row** |
| `.pl-dhero` | `box-shadow` | *(absent)* → `var(--shadow-sm)` | a shadow appears |
| `.pl-dhero` | `border-bottom` | *(absent)* → `1px solid color-mix(--mus-color 18%)` | a rule appears |
| `.pl-dhero` | `padding` | `22px 20px 26px` → `20px calc(var(--screen-gutter)+6px) 24px` | — |
| `.pl-poster` | `box-shadow` | *(absent)* → `var(--shadow-sm)` | a shadow appears |
| `.pl-poster` | `border-bottom` | *(absent)* → `1px solid color-mix(--tr-accent 18%)` | a rule appears |
| `.pl-poster` | `padding` | `22px 20px 26px` → `20px calc(var(--screen-gutter)+6px) 24px` | — |
| `.pl-day` | `box-shadow` | *(absent)* → `var(--shadow-sm)` | a shadow appears |
| `.pl-day.is-rest` | `opacity` | `.45` → `.55` | rest days read louder |
| `.pl-days` / `.pl-dests` | `padding` | `0 20px` / `22px 20px 10px` → `0 var(--screen-gutter)` / `18px var(--screen-gutter) 4px` | narrower gutter |
| `.pl-dhero-number strong` | `background` | `linear-gradient(#fff, color-mix(--mus-color 80%, #fff))` → *(dropped)* | the numeral lost its gradient clip |
| `.wo-verdict` | `display` | `grid` → `flex` | — |
| `.cer-cta` | `display` | *(absent)* → `grid` | — |

### 20.3 Families present in the prototype's CSS and never rendered in production

`pl-info` (no CSS **and** no renderer — §0.1) · `pl-whero` / `pl-whero-art` · `pl-mhero` /
`pl-mhero-art` · `pl-lib-muslist` / `pl-lib-musrow` / `pl-lib-musbar` (CSS ported, no renderer) ·
`pl-lib-facts` · `pl-ex-move` · `tr-card` / `tr-card-head` / `tr-card-note` · `tr-block` ·
`tr-quick` / `tr-quick-tile` · `wz-chip` (and the `wz-` family generally) · `ld-body` · `wo-head`.

---

## 21. What could not be reached

1. **The ceremony's two steps, in the browser.** The production dev server has no persistence for
   this flow: logging a set does not stick (`0/15 SZETT` after 15 successful `wo-check` clicks) and
   `Lezárás →` never leaves `/train/session`. Console shows a repeating
   `[["train","weekWorkouts","2026-09-14"]]: No queryFn was passed as an option` error, so the
   week-workouts query is unwired in this mode. `/train/review/:workoutId` therefore has no reachable
   id — mock's only completed session this week is a **running** block, not a gym workout.
   §19 is a source-level comparison, not a measurement.
2. **The rest-timer state of the workout dock** in production (same cause).
3. **`train/1/new`** was noted, not measured, per the brief.
4. **Light theme.** Everything above was measured in the dark theme only.

---

## 22. Closing table — every missing interactive control across the Train domain

| # | Screen (production route) | Missing control | Severity |
|---|---|---|---|
| 1 | Mai `/train/mai` | `button.tr-card.is-tappable` — „A mai kereted a Fuelben" (the kcal card's door into Fuel) | BLOCKER |
| 2 | Mai `/train/mai` | `button.tr-block.is-ahead` — „HOLNAP 18:00 · SPORT / Röplabda / A vállad és a lábad is kap belőle ›" | BLOCKER |
| 3 | Mai `/train/mai` | `summary` — „További részletek / TERHELÉS · REGENERÁCIÓ · TERV" | BLOCKER |
| 4 | Mai `/train/mai` | `button.fuel-secondary` — „A heti terhelésed ↗" (inside the accordion) | BLOCKER |
| 5 | Mai `/train/mai` | `button.fuel-secondary` — „A futó terved ↗" (inside the accordion) | BLOCKER |
| 6 | Mai `/train/mai` | `button.fuel-secondary` — third accordion row | BLOCKER |
| 7 | Plan day `/train/mesocycles/:id/days/:day` | ⓘ `pl-info` — „Miért nyolcnál a jelölés?" | BLOCKER |
| 8 | Plan day `/train/mesocycles/:id/days/:day` | ⓘ `pl-info` — „Mikortól él a változtatás?" | BLOCKER |
| 9 | Plan day `/train/mesocycles/:id/days/:day` | `.pl-ex-move` — „Előrébb" ↑ (one per exercise, 3–6 buttons) | BLOCKER |
| 10 | Plan day `/train/mesocycles/:id/days/:day` | `.pl-ex-move` — „Hátrébb" ↓ (one per exercise, 3–6 buttons) | BLOCKER |
| 11 | Muscle `/train/mesocycles/:id/week/:muscle` | ⓘ `pl-info` — „Mit jelentenek a jelölések?" | BLOCKER |
| 12 | Template `/train/templates/:id` | ⓘ `pl-info` — „Mit jelent a szám?" | BLOCKER |
| 13 | Closed run `/train/mesocycles/:id/report` | ⓘ `pl-info` — „Mit mutat a sáv?" | BLOCKER |
| 14 | Terhelés `/train/week` | ⓘ `pl-info` — „Miből áll össze a szám?" | BLOCKER |
| 15 | Terhelés `/train/week` | ⓘ `pl-info` — „Mit mutat a sáv?" | BLOCKER |
| 16 | Terhelés `/train/week` | ⓘ `pl-info` — „A sport és a szettek" | BLOCKER |
| 17 | Izomtérkép `/train/week/terkep` | ⓘ `pl-info` — „Miből rajzoljuk?" | BLOCKER |
| 18 | Minden mozgásod `/train/week/mozgas` | ⓘ `pl-info` — „Miért becslés?" | BLOCKER |
| 19 | Minden mozgásod `/train/week/mozgas` | ⓘ `pl-info` — „Hogyan olvasd?" | BLOCKER |
| 20 | Exercise story `/train/exercises/:key` | ⓘ `pl-info` — „Mi számít rekordnak?" | BLOCKER |
| 21 | Exercise story `/train/exercises/:key` | ⓘ `pl-info` — „Mit mutat a vonal?" | BLOCKER |
| 22 | Wizard `/train/mesocycles/new` | the whole 6-step flow: source pick, step bar, per-day editor step, review/start-date step | BLOCKER |

Screens with **no** missing control: `train/1` Terv, `train/1/week`, `train/1/library`,
`train/1/library/templates`, `train/1/library/closed`, `train/2/jelek`, `train/3`, the
active-workout overlay, and (source-level) both ceremony steps.
