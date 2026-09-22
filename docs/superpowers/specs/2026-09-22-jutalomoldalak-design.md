# Jutalomoldalak — workout close + meal log as one reward family

**Date:** 2026-09-22 · **Bead:** `mezo-p2777` · **Status:** approved by owner (2026-09-22)
**Prototype (approved):** [`docs/design_2.0/prototypes/redress/2026-09-21-jutalom-oldalak.html`](../../design_2.0/prototypes/redress/2026-09-21-jutalom-oldalak.html)

## Problem

The owner: the star-reward screens at workout close and meal log "are a bit scattered, the colour
world is off; the Titanium solution was very good". Recon confirmed three causes:

1. **Two hand-writings.** `WorkoutCeremony` (`.cer-*`) and `FuelMealCeremony` (`.fcx-*`) implement the
   same pattern with different label type (9px/800 caps vs 10px/500), positioning (in-flow bottom vs
   absolute centred), star motion (keyframe pop vs transition fade), bar ticks, and CTA chrome
   (coral house CTA vs lavender wash card + gold pill).
2. **A Titanium stone.** Both bars still fill with the 4-stop *linear* `#FFF0C8 → #AF9371 → #322A29 →
   #DBC4A0` — the dark `#322A29` band reads as a dirty stripe on the restored light ground. The style
   bible §5 recipe is the warm 3-stop *radial* `#FFE9A8 → #E0AC2F → #A9770F`.
3. **No single focus.** Step one spreads attention over stars, bar, three counters, verdict, two stat
   tiles and a record tile — seven peers of similar weight.

## Owner decisions (2026-09-21/22)

| # | Decision |
|---|---|
| D1 | Keep **Titanium's composition and choreography**, in the **restored gold-stone / clay material** (not a dark Titanium stage). |
| D2 | **Two weight classes, one family.** Workout close = the full multi-beat ceremony. Meal log = a ~1 s moment on a bottom sheet over the day (logged 3–5×/day, must not wear out). |
| D3 | **No star numeral.** The stars themselves are the reward — do not write "4,5 / 5". (Overrides style bible §5 "Numeral" for this surface.) The meal's *Mezo score* (x,y / 10) stays: it is a different quantity. |
| D4 | Step two's muscle rows use the **MuscleMap anatomy crops** (`MuscleChip`). |
| D5 | The meal moment shows **fat** too: kcal · fehérje · szénhidrát · zsír. |

## Design

### Shared material (both surfaces)

- Ground `linear-gradient(180deg, var(--mz-tone-gold) 0%, var(--canvas) 52%)` + `--halo-amber` band
  whose opacity rises with `--p`.
- **Stone:** `radial-gradient(85% 160% at 36% 30%, #FFE9A8 0%, #E0AC2F 55%, #A9770F 100%)` + a 1px
  white inset top highlight — the clay star's own material at bar scale. Used for the workout fuse and
  the meal score ring. Text never sits on it.
- Stars: `ClayIcon i-termes`; unlit `opacity .22`, half `.62`, lit `1` with a one-shot pop + amber aura.
- One quiet **card** (`--surface-1`, `--mz-shadow`) holds every secondary number; the **record** is the
  only gold-wash element (`--mz-wash-gold` + `--mz-shadow-dec`).
- The house CTA (`--gradient-cta`, the existing `.wo-close-cta` recipe) is the one primary button on
  both surfaces; the way back is the quiet house secondary.

### Workout close — step one (the big moment, ~2.7 s)

Anatomy, top → bottom: eyebrow · **star arc** (sizes 46/56/68/56/46 px, outer stars lifted 20/7 px) ·
**fuse** (the stone bar, 250×8 px, split in five by 2px canvas gaps — one segment per star) · verdict
(26px/700) · **card** [record strip (if any) · minutes + XP pair (each hidden when null) · quiet row:
szett · ismétlés · kg×rep] · pending-sets note · one CTA `Részletek`.

Choreography — ONE rAF pass of 2700 ms, cubic ease-out per phase:

| t (ms) | beat |
|---|---|
| 0–1700 | fuse burns to `score.ratio`, stars ignite at (i+1)/5 (half inside the .1 window), halo swells |
| 1750 | verdict fades up (`.is-b1`) |
| 2050 | card rises (`.is-b2`); its counters run 0 → value over the rest of the pass |
| 2350 | record strip stamps in with a scale overshoot (`.is-b3`) |
| 2700 | pass ends → `told` → CTA in |

The pass toggles the beat classes itself (frame-driven, no timers). Reduced motion / `settled`: final
state on first render, no pass.

### Workout close — step two

Order: **recap chip** (mini stars + verdict, gold cell) · **kcal hero** (sage wash, 58px/200 numeral,
unchanged copy, opens Fuel) · section title · **one card of muscle rows** — each row: `MuscleChip` 40px
on a 12%-tint of the region colour, label, done/plan, mini stars, fill bar in the region colour ·
`Hogy ment?` note · `Vissza a mai napra` (done state) + `Vissza az értékeléshez` · footnote.

### Meal log (the small moment, ~1 s)

`.fcx-screen` becomes a scrim over the day; `.fcx-sheet` rises from the bottom (radius 30 top).
Sheet anatomy: grab handle · left column [eyebrow `A NAPOD RÉSZE LETT`, meal label, time, **5 stars
30px**] · right **score medal** (92px disc, stone ring filling to score/10, `x,y` numeral 34px/200 in
the disc, caption `Mezo értékelése`) · verdict (17px/600) · **macro card** with four cells: kcal (sage
ink), g fehérje, g szénhidrát, g zsír · actions: `Vissza a naphoz` (secondary) + `Részletek` (house
CTA, only when `onDetails`). Tapping the scrim = `Vissza a naphoz`.

Choreography — ONE rAF pass of 1000 ms: sheet translate 105% → 0 on t∈[0,.3]; ring, stars and macro
counters on t∈[.2,.95]; `.is-b1` (verdict + macros) at .55, `.is-b2` (actions) at .85. The sheet's
entry is frame-driven too (a CSS animation would freeze off-screen in a hidden webview). Reduced
motion: final state on first render.

### Unchanged (behaviour frozen)

Triggers (only a completed close / a new meal with a score; edit & undo never fire), every
computation (`cerScore`, `mealStars`, `scoreOutOfTen`), all copy strings and verdict ladders, the
null-hides-the-tile honesty, focus on the sr-only heading, the shell-hosted meal provider, the
two-step workout flow. `SportCeremony` shares the `.cer-stars` / `.cer-bar` / `.cer-fill` rules and so
inherits the arc, fuse and warm stone; its own structure is untouched.

## Data changes

- `MealCelebration` and `FuelMealCeremonyProps` gain `fatG: number`; `MealComposer.celebrate` passes
  `meal.f ?? 0` (the wire already carries `macros.f`, mapped to `FuelMeal.f`).

## Prior art

- **Duolingo lesson-complete** ([60fps.design](https://60fps.design/shots/duolingo-anime-lesson-complete-animation)) —
  adopted: hero first, then *one* stats card rising, then the button; stats never compete with the
  reveal.
- **Strava Activity Replay** ([support](https://support.strava.com/en-us/articles/15401546-activity-replay)) —
  adopted: cap the highlights (record, time, XP) and push the rest into a quiet row.
- **Apple HIG Activity rings** ([HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings)) —
  adopted: the reward graphic is the same material as the in-app progress graphic (clay star = stone).
- **Habituation / Asana** ([Supercharged](https://www.supercharged.studio/blog/psychology-of-microinteractions-in-ux-design)) —
  adopted: frequent actions get a short moment → D2.
- **Duolingo streak beat** ([60fps.design](https://60fps.design/shots/duolingo-2-day-streak-animation)) —
  rejected for now: the ceremony carries no streak (removed in `mezo-e1ii9`, not re-opened here).

## Codebase terrain

- Train: `frontend/src/features/train/components/WorkoutCeremony.tsx` (+ 29 tests),
  `SportCeremony.tsx` (shares `.cer-*`), `ActiveWorkoutPage.tsx:777-808` mount, `logic/cerScore.ts`.
- Fuel: `frontend/src/features/fuel/components/FuelMealCeremony.tsx` (+ tests),
  `MealCeremonyProvider.tsx` (portal into `.phone-screen`, hosted in `AppLayout`), `MealComposer.tsx`
  (`celebrate`), `logic/mealCeremony.ts`.
- CSS: `frontend/src/styles/prototype.css` sections `── fuel-ceremony (` and `── train ceremony (`;
  both pinned by `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (stone string, class
  lists, sage kcal, gold record, `.fcx-fill` width formula, no fill transition) — updated in the same
  change.
- Traps: frame-driven fills only (hidden webview freezes CSS transitions); `MuscleChip` loads geometry
  lazily (placeholder first); the gym close cannot be driven to the end in mock (`mezo-p30l2`) — verify
  via unit tests + the sport ceremony + the meal ceremony live; the `.levelup` overlay (z 250) must not
  be raised by either ceremony (`mezo-n6yqh`).

## Testing

- Unit: update/extend `WorkoutCeremony.test.tsx` (arc stars, beat classes after the pass, card holds
  the counters, no visible star numeral, MuscleChip in rows), `FuelMealCeremony.test.tsx` (fat cell,
  sheet structure, scrim closes, ring dashoffset at final), `MealCeremonyProvider.test.tsx` (fatG
  passes through), `prototypeCssStructure.test.ts` (new stone, new classes).
- Frontend gates both modes + build. Live check: meal ceremony + sport ceremony in mock mode.

## Docs

`2026-09-15-ceremony-pattern.md` (materials + weight classes + D3), style bible Appendix C addendum
(C.3), `docs/features/train.md` + `docs/features/fuel.md` ceremony sections.
