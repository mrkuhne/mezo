# Folyadék — style bible

> Owner-approved 2026-10-08/09 after nine prototype rounds. **Folyadék** replaces Üveg as the
> app's visual identity. This file is the styling reference of the build programme
> (epic `mezo-n4wf5`, driver skill `/folyadek`). The approved look in executable form is the
> prototype: `prototypes/klinikai-iranyok.html` + `prototypes/vilagos/*.js`
> (Artifact https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M). When this text and the prototype
> disagree, the prototype wins and this file gets fixed. The journey and what was rejected:
> `prototypes/vilagos/HANDOFF.md`.

## 0. The idea in one sentence

**Everything is a level that fills.** The app measures a life in amounts (sleep, food, load,
habits, knowledge about you); every amount is shown as liquid in a vessel. One idea carries the
identity; nothing else decorates.

Two things are separate and both are fixed: the **structure** (§2, approved first, as "clear,
I know where to look") and the **look** (§3–§7, the liquid). Never trade one for the other.

## 1. Ground rules

1. **Light only.** No dark theme. (Én · night mode is the one dark screen — open question.)
2. **One strong graphic per screen**, drawn from that screen's own data. The rest is quiet.
3. **Colour = meaning.** Domain colour on hero / primary action / active state; state colours
   (ok, warn, bad) only for state; stable category colours for macros and muscle regions.
4. **No progress rings.** A circle is only a real clock or timer. Amounts are levels.
5. **Averages never stand alone.** A comparison shows its averages *and* the days behind them.
6. **Content richness is the floor.** A screen thinner than today's app is a regression.
7. **Behaviour is frozen** (controls, states, sheets, data) except the two approved
   navigation changes in §2.4.

## 2. Structure — the page skeleton (every screen)

### 2.1 Order
1. **Title bar:** small eyebrow (domain dot + context/date) and the page title; on the right
   search, notifications, settings. Sub-pages: a back button on the left, notifications only.
2. **The domain's pages as top tabs** (pill tabs; the active one filled with the domain liquid).
   Not on sub-pages.
3. **One hero** (a vessel): eyebrow label, **a verdict sentence**, one or two lines of
   support, the screen's signature graphic, and at the bottom **the liquid action row** with
   one primary button and at most one text link.
4. **3–5 numbered sections**, each a white card, ordered
   *do now → today's numbers → insight → log*. The number sits in a small drop badge.
5. Deeper things live behind rows (sub-page or sheet).
6. **Bottom bar: the five domains, always** (five liquid drops; the active one fuller).

### 2.2 Text roles
Title/numeral: **Bricolage Grotesque** 700–800, tight tracking. Text: **Geist**. Mono only for
tiny axis/time labels. Sizes in the prototype kit (`vilagos/kit.js`); at ≤360 px the page title
drops to 25 px (21 px on sub-pages) and hero verdicts hyphenate.

### 2.3 Copy
- The hero says a **verdict**, not a description ("Ma jó nap egy közepes edzéshez.").
- A field name (Alvás, Mozgás…) is a **label**. In a sentence it takes an article ("az Alvás
  szerint") or the sentence turns to "we" ("este megnézzük"). Never a bare field name acting as
  a person.
- Upright text only. No italic paragraphs.

### 2.4 Navigation (the only behaviour changes, both owner-approved)
- **Bottom bar = domains; the domain's pages = top tabs.** No hidden domain switcher.
- **Back returns to where the user came from** (history), never to a fixed "parent". A fixed
  route is only the fallback for a direct link.

## 3. Tokens

| Token | Value | Use |
|---|---|---|
| page ground | `#EEF5F9`, screens: vertical gradient of white tinted 5→12% with the domain colour | behind cards |
| card | `#fff`, radius 22–28, soft blue-grey shadow | sections |
| `--ink` / `--sub` / `--faint` | `#0A2A3C` / `#4E6B7A` / `#8AA0AC` | text, labels, empty |
| Nap | `--dom #1877F2` · `--dom2 #19C7C0` | blue → teal |
| Edzés | `#F2683A` · `#F7B23B` | orange → amber |
| Fuel | `#149E6E` · `#8FD14F` | green → lime |
| Mezo | `#6B4FE0` · `#E06BB5` | violet → pink |
| Én | `#0E94B8` · `#46D3B3` | teal → mint |
| liquid | `--liq1: var(--dom2)` → `--liq2: var(--dom)` (top → bottom) | every fill |
| state | ok / warn / bad from the kit | state only |
| macros, muscle regions | their existing category colours | unchanged |

Exact shadows, radii and gradients: `vilagos/foly.js` (`Q` scope) is the source.

## 4. The liquid primitives

Prototype names (`window.F`), to be built once as the shared React kit and reused — never a
second recipe for the same thing.

| Primitive | What it is | Use when |
|---|---|---|
| `wave` | the wave strip on top of any liquid | every liquid surface |
| hero vessel | the hero card: content above, waving liquid action row below | every screen's hero |
| `tank` | one large vessel with a big numeral in the liquid, scale marks, CTA | one score of the day |
| `vial` / `vials` | upright tubes, level + value + label, optional glyph and target mark | 3–6 parallel amounts |
| `mini` | a capsule a few px tall/wide | amounts inside a row |
| `level` | a horizontal level (the bar's replacement) | a single ratio in a row |
| `fill` | any silhouette filled with liquid (bowl, pot, body, glass, jar) | the thing has a shape |
| `area` | a time series as a liquid surface with a target waterline and points | trends |
| `linked` / `chain` | communicating vessels joined by a pipe (width = strength, dashed = not yet said) | things that move together |
| `stream` | time-ordered items along a flow line | schedules, timelines |
| `perday` | every day as a small vessel: level = value, colour = group, dashed = against | under every comparison of averages |
| `bub` | an icon in a flat tinted chip | icons in rows/steps |
| `badge` | a team member's face (§6) | wherever a member speaks or is listed |
| drop | the five domain drops | bottom bar only |

Choosing a page's graphic: ask what the page *measures*, pick the vessel whose shape says it
(day score → tank; macros → vials; a meal → bowl; kitchen → pot; weight → a draining surface
with a target waterline; muscle load → the body silhouette / MuscleChip), draw it from real
fields of that screen. Muscle-map graphics are kept as they are — the owner's explicit keep.

Motion: waves drift and levels rise once on entry, only inside
`@media (prefers-reduced-motion: no-preference)`. Reduced motion shows the final level, still.

## 5. Icons — the Folyadék-jel family

- One family: an **outlined glyph in the domain colour, half-filled with the domain liquid**
  (wave edge). 150 glyphs are drawn (`vilagos/ikon.js`, `GLY`); they cover every icon id the
  app uses. The dark Titanium 3D sprite and the clay icons are retired.
- 64×64 box, 5 px clear; outline stroke 4, detail strokes 3.6; closed shapes hold the liquid.
  Fill modes: half (default), full, left half (rating), none.
- Colours come from the instance: `--ic` (line, default `--dom`), `--ic2` (liquid, default
  `--dom2`). **On a liquid or coloured ground the glyph is white.**
- In rows the glyph sits in a flat tinted chip (8% domain tint, 1.5 px inner line), 62% of it.
- A glyph standing in a vial is drawn twice: in the vial's colour, and in white clipped to the
  liquid — readable at any level. The small mark at the top of a vial turns white when the
  liquid covers it.
- New icon: draw it in this recipe, show it on the prototype's icon sheet (`#w-nap-ikonok`)
  for the owner's OK, then add it to the shared sprite. Never an emoji, never a near miss.

## 6. The team

- Members are named by their field: **Alvás** (pihenés), **Mozgás** (terhelés), **Étkezés**
  (étrend), **Közérzet** (hangulat), **Mezo** (a csapat), and the **Szkeptikus**. The nicknames
  Szunya / Mocor / Falat / Derű and every Boop creature are gone. Internal keys may stay.
- A member's face is the **field glyph badge**: round chip, the field's glyph in the field's
  colour (sleep, dumbbell, bowl, heart, orb, lens). Optional level behind the glyph, a small
  number chip, or number + caption inside when large.
- "Szobája" is "oldala"; a team member is a "terület", not a "karakter".
- The liquid sibling forms (pebble, bean, drop…) exist only as the five domain drops in the
  bottom bar.

## 7. Kept from before

MuscleChip / BodyMap graphics · the Fuel · Mai content (calorie vessel with eaten/remaining,
five macros, per-meal blocks with macros, glucose and score) · the in-workout layout (one
exercise as the hero with Rekordok · Technika · Műveletek on top, the rest as rows, floating
rest timer) · the ceremony *pattern* (its material becomes liquid).

## 8. Traps (paid for in the prototype)

1. A gradient that reads `var(--c)` inside a shared SVG `<defs>` does not resolve per instance —
   fill directly with `fill: var(--c)`.
2. Clip-path / gradient ids must be unique per instance.
3. A CSS `:has()` argument adds its own specificity; an "undo" rule needs the same shape.
4. Hard-coded dark fills inside old icons stay black holes on white — one more reason the old
   sprite is retired, not re-tinted.
5. Buttons never wrap at 390 px; at ≤360 px long labels in footers and sheets may wrap to two
   lines instead of running out.
6. A flex child holding a glyph collapses in a tight chip — give the glyph a min size.
7. A level drawn with an inner element needs clipping to the vessel; a background gradient with
   a hard stop at `--p` does not.
8. Text placed at the top of a vessel must change colour when the liquid reaches it.
9. A summary graphic that replaces a chart loses the days — add `perday`.
10. Renaming a persona changes every sentence it stood in; re-read the sentences, do not
    trust a search-and-replace.

## Appendix — slice lessons

Numbered rules appended by each build slice (F1, F2, …). Each was paid for in the build.

**F1 — foundation, frame, kit (`mezo-n4wf5.1`, 2026-10-09)**

- **F1.1 — The ground rule must out-specify the `[data-day]` tints and hide `.sky`.** The circadian
  `.phone-screen[data-day]` washes (specificity 0,2,0) painted over a plain `.phone-screen[data-domain]`
  ground; the ground is `:root:not([data-theme="dark"]) .phone-screen[data-domain]` (0,4,0) and the
  `.sky` band is `display: none` under it. Verify by reading the computed background at all three day parts.
- **F1.2 — A `var()` chain declared only on `:root` resolves on `:root`.** `--liq1: var(--dom2)` on `:root`
  gave Nap blue in every domain. Redeclare `--liq1/--liq2` in each domain scope
  (`.phone-screen[data-domain] { --liq1: var(--dom2); --liq2: var(--dom) }`), and test one non-Nap domain.
- **F1.3 — Page rules are shared with the dark pockets; re-tint through theme-aware channel tokens, never
  fixed ink literals.** About a thousand un-scoped rules carry light-on-dark literals and `/ritual` and
  the night page read the same rules. Replace the colour value with a channel (`rgba(var(--fo-film), α)`,
  `--fo-body`, `--fo-ground`, `--fo-shade`, `--fo-pastel`) whose dark value is the old literal; delete the
  channels together with the pockets, not before.
- **F1.4 — A registered back handler outranks the frame default.** Pure navigations must not register one:
  pass `history` + `fallback` (`FrameBack`, `PageHead`) so back means „vissza oda, ahonnan jöttél". Only
  stateful backs (wizard steps, replace/state navigations, inline closers) register `useFrameBack`.
  A bare `navigate(-1)` or a hard-coded route in a page defeats the rule.
- **F1.5 — „Has history" is `history.state.idx > 0`, not `location.key !== 'default'`.** On a first entry
  reached through a `replace` redirect the key is non-default while `idx` is 0, so back popped out of the app. One
  shared `canGoBack()` (`shared/lib/backNav.ts`) serves the title bar, the kit and the back hooks (a memory
  router has no `idx` and falls back to the key). Test it with a real router (`idx` 0 and 2 asserted in the Playwright navigation spec), not a stub.
- **F1.6 — The notification scrim is `position: fixed`.** An absolute 130vh scrim added scrollable
  overflow on short pages (+119 px at 390). A `backdrop-filter` on the sticky bar captures fixed
  descendants, so the bar's blur and tint live on `::before` (`inset: 0; z-index: -1`).
- **F1.7 — The splash drops reuse the bottom bar's own markup and constants.** `navDropSpec` / `REST_FILL`
  feed both, the timing constants are written to the CSS as `--sp-*`, and base rules are the final frame so
  reduced motion is just „no animation". Assert the hand-off (drop boxes within 2 px) under reduced motion;
  the live bar's active drop breathes, so motion mode differs by about 1 px.
- **F1.8 — A clay alias symbol needs its own `viewBox="0 0 64 64"`.** `<symbol id="i-…"><use href="#t-…"/></symbol>`
  without a `viewBox` renders the glyph at the wrong scale; the clay ids that mean something no glyph
  says (`i-mezo i-sport i-growth i-lombik i-retegek i-termes`) stay clay art rather than aliasing a near-miss.
- **F1.9 — Re-tint in loops: route list × contrast script.** Measure 35 routes at 390 and 320 px
  (text luminance against the effective background, missing `<use>` targets, overflow, console errors), fix a
  class of literal, re-measure; 18/35 → 28 → 32 → 34 clean. Known false-positive classes: the script
  must parse `color(srgb …)` (a `color-mix()` gradient ground is reported that way, not as `rgb()`), text
  absolutely positioned outside its coloured parent (`/train/mesocycles` `b.<is-now`), and
  `background-clip: text` gradient numerals. Also look at tall screenshots: a translucent dark
  `rgba(25,22,20,.82)` sticky bar was invisible to the detector.
- **F1.10 — Kalauz copy that describes chrome must change with the chrome.** The welcome step and the train
  tab-row card still said „bal lent a Boop" / „lent a négy fül" after the frame moved; greps for the
  component names miss copy. Grep the registry for the old words when a frame changes.
- **F1.11 — A global lock hides who relied on it.** The dark lock was what kept the night page dark; lifting it
  turned the page light until `NightPage` got its own `useForceTheme('dark')`. List every surface that
  depends on a lock before you move it, and give each pocket an explicit claim.
- **F1.12 — Port the prototype's light values, not just its markup.** The kit's `Drop` came out with the
  prototype's dark base (`.csepp` white .04 shell); the light layer sits in a separate part of `kit.js`.
  Compare computed styles per element against the prototype, not screenshots.
- **F1.13 — Delete dead chrome with proof.** About 570 lines of the old chrome CSS went with a brace-aware
  script that removed a rule only when every selector named a dead class (zero usage in `src` and `tests`),
  logged each rule, and ran the CSS structure test and the build afterwards.
- **F1.14 — Flip a global default, then run the layout specs.** Forty-odd Playwright specs asserted
  `html[data-theme=dark]` and went red with the light lock; they are part of the change, not noise.

**F2 — Nap (`mezo-n4wf5.2`, 2026-10-10)**

- **F2.1 — Reality pass before the OK: every graphic names the real field that feeds it.** The approved
  Mai hero showed „72 of 100", and nothing in the app produces that number during the day (the day score
  exists only after the overnight close). Walk the prototype screen by screen and write the hook and field
  beside every number, level and sentence; where there is none, ask the owner what the number should mean
  (here: the average of the six életjel) — never keep an invented one, and never pick a stand-in yourself.
- **F2.2 — A prototype-only demo gets built unless it leaves the build target.** The „Mit táplál?" page, the
  check-in slot tester and a „Próbáld ki: írj be valamit" field existed to show the idea to the owner. Remove
  them (or mark them unmistakably) before the OK; a builder reads a route in the prototype as a screen to ship.
  The same pass removed what was simply invented: a „Heti egyeztetés" entry, per-weekday macro vessels, a
  28-day grid on Rutin, quest progress percentages, linked vessels on observations.
- **F2.3 — Parallel builders: one stylesheet per area, with its own class prefix, planted before dispatch.**
  Six areas were built at once (`folyadek-nap-{mai,napom,beszelgetes,rutin,rogzites,epites}.css`, prefixes
  `.nm- .nn- .nb- .nr2-/.nck2- .nqk-/.nrz- .rb-`). The empty files and their imports were committed first;
  a builder never touches `prototype.css`, the kit or the shell. The controller deletes the old CSS
  afterwards, rule by rule, with the zero-usage proof of F1.13.
- **F2.4 — Extend the kit BEFORE the parallel builders, with the generic pieces.** Buttons, pills, the
  sheet head, a text field, a big numeral, a hero left slot: whatever the kit lacked was re-invented in each
  area and had to be consolidated at the end (`.nck2-in` / `.rb-in` / `.nqk-in` / `.nrz-in` → one `.fo-in`;
  three copies of a big numeral → `Big`; four hero-left layout hacks → `Hero left`). List the prototype's
  repeating pieces first; anything that appears on two screens is a kit piece.
- **F2.5 — The kit owns the hit area.** A kit button drawn under 44 px made every page add its own hit-area
  rule (`::after` insets, `min-height` overrides per area). Give the kit piece the 44 px target once — the
  drawn pill may stay smaller — and delete the per-page hacks.
- **F2.6 — A shared sheet's title is asserted far from the sheet.** The check-in sheet opens from six places;
  changing its title from „Hogy vagyunk?" to „Hogy vagy?" broke suites of pages that had not been touched.
  When a shared sheet's copy changes, grep the old words across `src` and `tests` first.
- **F2.7 — A legacy class kept „for the layout spec" needs an interim override, and both go together.** The
  quick-log root keeps `.quicklog` because `tests/layout/quicklog.spec.ts` keys on it, so the old
  `.quicklog` padding and heading rules still matched the new markup; `.quicklog.nqk` switches them off.
  Write next to the override which old rule it neutralises, and delete the pair in one change.
- **F2.8 — A hub page with a parameterised child needs an explicit frame rule, in one place.** `/nap/napom/:date`
  is the same hub page showing another day, but the frame read it as a sub-page: back button, no top tabs.
  The title bar and the top tabs each had their own copy of „is this a hub"; the rule is now one function
  (`isHubPath`, with `NavTab.hubChild`) that both read.
- **F2.9 — Removing a dark lock is a decision, not a refactor.** `/ritual` forced the dark theme and a
  regression test pinned it. The owner decided that Napzárás is light (the evening is the dusk liquid);
  the test was then rewritten to pin the new truth, not deleted and not left red. A guard that protects a
  decision changes only with the decision.
- **F2.10 — A level is not always proportional.** On A napom the tank's liquid has to leave room for the
  verdict sentence above it; a level proportional to the score collided with the text at high values. Band
  the level (44–66 % for the live day, 56–66 % for a score) and let the numeral carry the value. A vessel
  that holds text is a stage first and a gauge second.
- **F2.11 — The field-name copy rule reaches the nudges and the sender badges.** Nudges and labels that said
  „ring" now say „szint" or „jel". A message that carries no character is signed by a rule, not by a
  default face: a nudge by the need that raised it, a feed row by its kind, everything else Mezo.
- **F2.12 — Another domain's shared piece stays in its old look until its own slice.** A converted page
  opens sheets and embeds components that belong elsewhere (`JournalSheet`, `SleepLogSheet`, `WeightLogSheet`,
  `WaterLogSheet`, `LogFlowPage`, `SportLogSheet`, `WelcomeBackSheet`, `RecoveryDurationRow`, `GratitudeRows`,
  `FeedbackChips`, `RefChips`, `AskTeamRow`, `EvidenceList`, the `VoiceField` mic tile). Record the list in
  the hand-off and leave them: converting one ad hoc changes every other page that uses it, outside the
  slice's prototype and its tests.
