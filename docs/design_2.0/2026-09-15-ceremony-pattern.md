# Mezo Titanium — the ceremony (reward screen) pattern

Driver: `mezo-6z0ai` (fuel ceremonies) building on `mezo-titanium-redesign` commit `a72cb5962`
(the workout star ceremony). This document is the single reference for every reward screen in
the Titanium direction, so the pattern never has to be re-explained from scratch. Prototype
source: [companion-titanium](prototypes/companion-titanium/) — `food.js` (meal ceremony),
`fuel-pages.js` (`showStackCeremony`), `session.js` on the redesign branch (workout close),
shared styles in `food.css` (`fcer-`/`scx-` blocks) and `session.css` (`cer-` block).

## What a ceremony is

A ceremony is the full-screen celebratory moment that OWNS the screen right after the user
completes something whole. It is not a toast and not a sheet: navigation hides, one choreography
plays exactly once, and the way onward is a single clear CTA. The owner-approved dramaturgy is
always the same **two-act structure**:

1. **Act one — the ignition.** Sky wash warms up, the gold-stone bar runs, counters count up,
   the centerpiece ignites (stars, or the block's clay icon with an aura pop).
2. **Act two — the reading.** Verdict sentence and details fade in (`.is-told`), with the
   single CTA pinned near the thumb. Optionally a second step ("Részletek") opens a deeper
   panel (e.g. the glucose insight) before returning to the day.

## Where it fires (trigger rules)

| Surface | Trigger | Never on |
| --- | --- | --- |
| Train — workout close | Closing the session (complete or confirmed-partial) | mid-workout |
| Fuel — meal logging | Saving a meal from the pontosítás screen | editing an existing meal |
| Fuel — supplements | The tick that completes a WHOLE block (Reggel/Délben/Este); a one-item block completes on its single tick | partial ticks (quiet toast), un-ticks |

The general rule for new surfaces: **a ceremony celebrates a completed whole, never progress.**
Partial progress gets the quiet toast/react pair. Undo never triggers or replays a ceremony.

## Anatomy (the fcer scene)

- **Sky** — a radial warm glow whose intensity is driven by the shared `--p` custom property.
- **Centerpiece** — meal: five stars igniting left to right; supplements: the zone's clay icon
  popping with an aura burst; train: five stars. Stars and icons come from the shared sprite
  (`i-star`, clay icons); NEVER emojis.
- **Gold-stone bar** — the fill is cut from the Ritmus swatch material (see Materials), with a
  comet head at the fill edge. Meal: fills to `score/10`. Completion ceremonies: fills to 1.
- **Counters** — up to three warm tiles whose numbers count up with the same pass
  (meal: kcal / fehérje / szénhidrát; supplements: block items / taken today of total).
- **Verdict** — one short sentence (see Copy), then context line (meal name · time, item names).
- **Score card** (meal only) — the product's own AI-score mark + flat gold numeral `x,y / 10`.
  The owner explicitly rejected a stone box here: the AI score keeps its existing logo.
- **CTA** — one primary button; meal: "Részletek" into the glucose step, supplements/train:
  the way back to the day.

## Star mapping (meal)

House score is 0–10 with one decimal. Stars are whole, 1–5, **rounded up**:
`stars = clamp(1, 5, ceil(score / 2))` — 8,3 → 5 csillag, 7,4 → 4, 5,2 → 3.
A missing score never fabricates stars: the scoreless fallback screen shows no ceremony
(honest-null, same rule as the `folyamatban` chip).

## Motion spec

One rAF-driven pass, cubic ease-out (`1-(1-t)^3`), drives EVERYTHING from a single progress
value: `--p`, counter numbers, star/aura ignition thresholds. Durations: 2400 ms (meal, train),
1600 ms (supplement block). Act two reveals via `.is-told` (opacity + translate, .5 s).
`prefers-reduced-motion: reduce` paints the final state instantly — no pass, no pops.
**Implementation note:** fills and counters must be frame-driven (rAF), not CSS width
transitions — a throttled/hidden webview freezes a just-started transition at 0 (learned on
the day-budget bars).

## Materials

The polished-stone swatch recipe from the presentation frame (`.material-swatch`, `nap.css`)
is an in-app material now:

- Recipe: 145° linear gradient with **alternating light/dark stops**, inner top-light edge
  (`inset 1px 1px 1px #eee4ff77`), weighted drop shadow (`0 8px 20px #0008`), rounded-rect
  pebble geometry with a slight rotation.
- Gold "Ritmus" stone: `#fff0c8 → #af9371 24% → #322a29 52% → #dbc4a0` — the ceremony bar fill
  (horizontal remap) and the mid glucose verdict pebble.
- Sage stone (low): `#f0f7dd → #93b06c 24% → #28321d 52% → #c9e0a2`.
- Coral stone (high): `#ffe2d4 → #c17d66 24% → #3a241d 52% → #eab8a2`.
- Text is never set ON the stone (the dark band kills contrast); the stone is a carried object
  (pebble badge, bar fill), text stays on glass.

## The glucose step (meal ceremony act three)

"Vércukor-válasz" — Glucose-Goddess-informed, deliberately **categorical**:

- Three bands only (alacsony / közepes / magas várható hatás) from a GL-style clothed-carb
  heuristic (`glycemicFor`, `food-state.js`): carb load weighted by sugar share, braked by
  fiber/protein/fat. **No numeric GI/GL is ever shown** — mixed-meal GI math mispredicts
  22–50%; production must keep the same honesty boundary.
- The curve is a story, not a measurement: named `alapszint` baseline, time axis
  evés → +3 ó, annotated peak, and the high curve dips UNDER the baseline with a
  `visszaesés` label — that dip is the early-hunger crash.
- Three lived-terms rows (Energia / Alapszint / Éhség) translate the shape, plus the one-line
  rule: flatter = steadier energy.
- One actionable hack per meal, chosen from composition (food order, clothed carbs,
  post-meal walk); low band gets an affirmation, never emptiness.
- Reopenable: every logged meal row carries a mini-curve chip (the curve IS the icon, colored
  by band) left of the score chip; it opens the same panel as a glass sheet.
- Below the panel: the day budget rows (kalória + fehérje/szénhidrát/zsír in house colors),
  each bar rAF-filling to consumed/target with the honest "még X fér bele" remainder.
- UI vocabulary: **"vércukor-válasz"**, never "glycogene index"; the small print always says
  minta/becslés, nem mérés és nem orvosi előrejelzés.

## Copy rules

Adherence-neutral, always. Verdict ladders celebrate or stay constructive — never shame
(the repo's fuel tests literally fail on shame words). Meal ladder: 5 "Hibátlan választás." /
4 "Erős tányér." / 3 "Rendben van." / 2 "Ez is számít." / 1 "Rögzítve — minden adat segít."
Supplements: "A reggeli adagod a helyén." / "A déli adag megvan." / "Az esti adag is a
helyén." / full day: "Mára minden megvan."

## Reuse checklist for a new ceremony surface

1. Is the trigger a **completed whole**? If not, use a toast.
2. Reuse the `fcer` scene classes and the single-pass rAF driver; pick 2–3 counters that are
   true numbers of the completed thing.
3. Centerpiece: stars only where a real score exists; otherwise the domain's clay icon + aura.
4. Verdict copy through the adherence-neutral filter; honest-null for missing data.
5. Reduced-motion branch, one-shot play, undo never replays.
