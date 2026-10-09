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

Numbered rules appended by each build slice (F1, F2, …). Empty until F1 lands.
