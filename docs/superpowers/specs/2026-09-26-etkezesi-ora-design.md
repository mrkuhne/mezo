# Étkezési óra — the meal clock replaces the window strip

- **bd:** `mezo-6g52f`
- **Date:** 2026-09-26
- **Owner decisions (this session):** the talking clock ("A · beszédes óra"), the blood-sugar
  response shown **as a band only, no number**, the "Logolva …" card line removed, the
  pre-log "Ajánlott … · még 38 p" line kept, the kcal ring measuring the meal's own budget,
  the AI score unboxed with a bigger icon and a joint "tap me" shake.
- **Approved prototype:** [`docs/design_2.0/prototypes/fuel-ora-ablak.html`](../../design_2.0/prototypes/fuel-ora-ablak.html)
  (set the toggles to *A · beszédes óra* and *Csak sáv*; the other positions are comparison
  only and are not built).

## 1. Problem

Every Fuel *Mai* meal block carries a horizontal strip (`WindowBar`, `FuelMealBlocks.tsx:120-144`).
It draws a fixed ±150 min box around one planned time, with a ±30 min band, so it states nothing
true about *when you should eat* or *why*. It also sits beside the scoring, which uses a
different, static window (5–10 / 11–15 / 17–22 on the backend, no snack windows at all). The
owner found it unhelpful.

What the owner wants instead is one element that is always on the card and tells two stories:

1. **Before logging:** the recommended window (from–to), why it is recommended, and how it relates
   to the day's movement and the meal plan.
2. **After logging:** when the meal was logged, how well it hit the recommended window, and what to
   expect from that timing, the food's quality (the existing blood-sugar band) and the day's rhythm.

## 2. The design (as approved in the prototype)

### 2.1 On the card

- **The clock button** replaces `WindowBar` and the logged-only `.fmx-clock`. It always renders,
  in the block head, before the kcal ring (46px, flat secondary fill, never glass-in-glass).
  - The Titanium clock icon (`ContentIcon i-idozito`) sits in the centre.
  - Around it runs a **12-hour dial ring**: a recessed track plus the recommended window as an arc
    in the block accent (`--block-color`) with a soft glow.
  - **Pre-log, window open now:** a small ink dot at "now" on the ring plus a slow ping halo
    (reduced motion: static, no ping).
  - **Logged:** a 4px dot at the logged time. It takes the block accent when inside the window and
    amber when outside. There is never red.
- **Pre-log line** (kept): `Ajánlott 10:30–11:30` plus a chip: `most nyitva · még 38 p`,
  `nyílik 45 p múlva` / `nyílik 13:00`, or `az ablak 11:30-kor zárult`.
- **Logged cards** show no time line. The clock dot is the only time signal on the card.
- **kcal ring (semantics change):** the ring measures **the logged kcal against this meal's own
  budget** (`slot kcal budget`), not the share of the daily budget.
  - At 100% the circle is full.
  - Anything over 100% runs a **second amber lap** (capped at one extra lap).
  - Pre-log the track is dotted and the centre shows the planned kcal.
  - The aria label reads `Logolva: 784 / 800 kcal (98%)`.
- **AI score:** no box.
  - The icon grows to 40px with a lavender halo.
  - The numeral is 22px Geist 400 in gradient text (lavender → pale lavender → warm gold).
  - Every ~6 s icon and numeral shake **together** (a ±5° wobble with a slight scale over ~0.6 s).
    Cards are staggered by 0.8 s, and reduced motion gets no shake.
  - It stays a button that opens today's score detail.
- **Blood-sugar chip** (`GlycemicChip`): unchanged behaviour. It keeps the band word under the mini
  curve and never shows a number.

### 2.2 The clock box (tap the clock)

This is the Fuel-centred `GlassBox` (`features/fuel/components/GlassBox.tsx`), the same shell that
TimeBox and GlycemicGlass use. The glass frame stays fixed and the content scrolls inside it (the
prototype's `.box` / `.box-in` split; the frame must not scroll away).

**Shared:**
- The head carries the block icon, the name, `N. étkezés az M-ből · <status>` and a close control.
- The **24-hour day dial** (Oura-like) shows:
  - the awake span as the recessed track and sleep as a lavender arc, with a moon glyph;
  - the other meal windows as faint arcs;
  - **this** window as the bright accent arc;
  - training as a thin coral outer arc with the dumbbell glyph;
  - a "now" tick;
  - hour labels 0/6/12/18;
  - a legend underneath.
- The dial centre never repeats the headline number. Pre-log it shows `MOST / 10:52 / még 38 p`.
  Post-log it shows `AJÁNLOTT VOLT / 07:20–09:20 / 2 ó hosszú ablak`.

**Before logging:**
- Headline `AJÁNLOTT ABLAK`, `10:30–11:30`, status line.
- **Miért ekkor?** shows 1–2 reason rows, each an icon, a bold title and one sentence. They come
  from the planner's reason codes (§3.2).
- **Hogyan illik a napodba** has two rows:
  - Movement today: the training blocks with times, plus today's steps when known.
  - Meal plan: `N. étkezés az M-ből`, the meal's kcal budget.
- A Mezo note (Fraunces italic, fixed copy): *"Az ablak iránymutatás. A napi összes fehérje és
  kalória többet számít, mint az, hogy percre pontosan mikor eszel."*

**After logging:**
- Headline `LOGOLVA`, `08:46`, `ajánlott ablak: 07:20–09:20`, and a **hit chip**:
  - inside: `Az ablakban` (sage);
  - outside: `+25 p később` / `−40 p korábban` (amber, whatever the distance).
  - There is no score, no percentage and no red.
- **Vércukor-válasz:**
  - the three-band meter (low/mid/high, active band lit);
  - a relative expected curve with no y numbers and an x axis of `evés … +3 óra`;
  - the existing `glycemicBand` sentence.
  - When the meal was eaten ≤150 min before bedtime, it adds a dashed "late evening" ghost curve
    and one sentence: *"Késő este ugyanez általában magasabbra és tovább emelkedik."*
  - **No number is shown** (owner, reconfirmed a third time).
- **Mire számíts** has three rows (§3.4):
  - Energia;
  - Mikor leszel éhes;
  - either A nap ritmusa, or Alvás when the meal was late in the evening.
- One tip in the Mezo note style (§3.4).

## 3. Logic

### 3.1 One window, one source

The planner's window becomes the single truth for both the pre-log clock and the post-log hit and
timing score.

- **Frontend.** `PlannedWindow` gains `from`/`to` (minutes) and `reasons: WindowReason[]`. The
  field flows through `FuelSlot` (`windowFrom`, `windowTo`, `windowReasons`) to the block tile VM.
- **At log time.** When a meal is logged *into a block* (the block's "Logolás ide" path, or any
  path that knows the target slot window), the frontend sends the window with the request.
- **Backend.**
  - `MealRequest.window` is `{ from: "HH:mm", to: "HH:mm" }`, optional and nullable.
  - The backend persists it on the meal as two new nullable `TIME` columns.
  - `timingSub`, `windowPassed` and `MealTimingDetail` use the **stored window when present** and
    fall back to the static `slot-windows` config otherwise (legacy rows, log paths with no
    window).
  - A snack with a stored window is now timing-scored. A snack without one still "fits any time".
- **Post-log hit** on the card and in the box reads the stored window from
  `breakdown.context.timing`, which already carries `windowFrom`/`windowTo`. The FE only falls back
  to the planner window when the meal has no stored window. The drawn hit and the scored timing
  therefore cannot disagree. It also removes the past-day trap (`asPastDayLane` rebuilds windows
  from today's plan), because a logged meal carries its own window.
- `MealTimingDetail.windowFrom/To` change from whole hours `"HH:00"` to full `"HH:mm"`. The
  contract already types them as `"HH:mm"` strings, so the schema is unchanged and only the
  descriptions are updated.

### 3.2 Window width and reasons (pure, table-tested)

This is a new pure module, `features/fuel/logic/mealWindow.ts`. It widens each placed time into a
range by the rule that placed it:

| Placement | Window | Reason codes |
|---|---|---|
| Breakfast (not training-snapped) | `t−40 … t+80` | `after-wake`, `protein-start` |
| Lunch / dinner / other main (standard) | `t−45 … t+45` | `protein-spacing` |
| Main snapped **before** training (pre) | `t−30 … t+30` | `pre-training-main` |
| Post-workout main | `latestEnd+15 … latestEnd+105` | `post-training` (+ `before-bed` if its `to` is ≤150 min before bed) |
| Pre-workout snack | `start−90 … start−45` | `pre-training-snack` |
| Plain snack (Tízórai / Uzsonna / Esti snack) | `t−30 … t+30` | `bridge` |
| Template row | anchor-based: `t±30` (snack) / `t±45` (main) | derived from the anchor: `wake` → `after-wake`, `training_start` → `pre-training-*`, `training_end` → `post-training`, `bed` → `before-bed`, `fixed` → `template-fixed` |

After widening:
- every window is clamped into `[eatingStart, kitchenClose]`;
- overlapping neighbours are split at the midpoint, so windows never overlap;
- a window is never narrower than 30 min.

`placeWindows` records *which* rule placed each window; today that fact is thrown away. The
widths above are the approved prototype's feel and are named constants in `fuelConfig.ts`.

Reason copy (`windowReasonCopy(code, ctx)`) is a pure map from code plus context (wake time,
training start and end, bed time, previous meal time) to `{ icon, title, body }` in Hungarian. The
copy follows the prototype. All copy says *segít / általában* and never *kell / különben*.

### 3.3 Hit (pure)

`hitOf(window, eatenAt)` returns one of:
- `{ kind: 'in' }`;
- `{ kind: 'near' | 'far', offsetMin }`, where near means ≤45 min outside.

It drives only the chip wording and the dot colour: the accent when inside, amber otherwise. There
is no score and near and far look the same. The wording is `+1 ó 45 p később`.

### 3.4 "Mire számíts" (pure, table-tested)

This is a new module, `features/fuel/logic/mealForecast.ts`. It **consumes** `glycemicBand`'s level
and does not modify it, because that module's texts and thresholds are owner-locked.

Inputs:
- the band level;
- the logged kcal;
- `eatenAt`;
- training blocks;
- bed time;
- the next planned window (label, from, to).

Outputs are three rows and one tip:

- **Energia** is the band sentence plus one training clause:
  - `low`: *Egyenletes, hosszan kitartó energia, nincs utána visszaesés.*
  - `mid`: *Mérsékelt emelkedés, 2–3 órán át stabil energia.*
  - `high`: *Gyors energia, 1–2 óra múlva jöhet egy kisebb visszaesés.*

  The training clause depends on timing:
  - ≤120 min before training: `high` gets *Edzés előtt ez most előny: gyorsan elérhető üzemanyag.*
    and the other bands get *Az edzésre ez tartós alapot ad.*
  - 120–300 min before training: *Az edzésig (HH:mm) ebből nagyjából kitart az alap.*
  - 0–180 min after the training end: *Edzés után ez a raktárak visszatöltését segíti.*
- **Mikor leszel éhes** uses `hungryAt = eatenAt + (kcal < 400 ? 150 : 210) + (high −45 | low +20 | mid 0)`.
  It is compared with the next window:
  - inside it (−30/+15 slack): *pont az X ablakában*;
  - before it: *egy pohár víz vagy kávé áthidalja*;
  - after it: *X ablaka ezért kicsit később lehet, vagy kisebb adag is elég*.

  On the last meal the text reads *Ez volt a nap utolsó étkezése, reggelig nem kell több.* Always
  write *nagyjából*, because this is an estimate.
- **Row 3.** If the meal was ≤150 min before bed, it becomes **Alvás**:
  - `high`: *…ráadásul magas vércukor-válaszú ételt. Ma éjjel valószínűleg nyugtalanabb lesz az
    alvás és magasabb a pulzus.*
  - otherwise: *Az emésztés még dolgozik, amikor elalszol.*

  Otherwise it is **A nap ritmusa**:
  - inside the window: *Tartja a 3–4 órás fehérje-ritmust…*;
  - outside it: *N-nel később ettél. Ez nem gond, a nap elbírja, csak X ablaka tolódik vele.*
- **Tip:**
  - `high` and late: the "don't judge yourself on tonight's numbers" line;
  - `high`: the 10–15 min walk line;
  - `mid`: the short walk line;
  - `low` ≤120 min before training: the "add a faster carb" line;
  - otherwise: *Jó választás két étkezés közé: nem hoz éhség-hullámot.*

Hungarian article agreement (`a`/`az` before a label) goes through a tiny helper. The prototype
needed it (`az Ebéd`).

### 3.5 Honest-null

- No carbs known → `glycemicBand` returns null. The box then omits the Vércukor-válasz section and
  the Energia row falls back to the training clause only, or is omitted.
- No training today → no training clauses, no coral arc and no movement block rows. The steps line
  is shown only if steps are known.
- A meal with no window at all (an extra log outside any block) → the clock ring shows only the
  track and the dot, the box shows `Logolva HH:MM` with no hit chip, and the text says
  *Nem tartozott ablakhoz.*

## 4. Architecture and files

**Frontend (`features/fuel`):**
- `logic/buildDayPlan.ts`: `placeWindows` records the placement rule per window, and `mealWindow.ts`
  widens it. `PlannedWindow` gains `from`, `to` and `reasons`.
- `logic/compileTemplate.ts`: the same, from anchors.
- `logic/mealWindow.ts` *(new)*: widening, clamping, the overlap split, `hitOf`, `windowReasonCopy`.
- `logic/mealForecast.ts` *(new)*: "Mire számíts" and the tip.
- `data/types.ts`: `FuelSlot.windowFrom/windowTo/windowReasons`.
- `logic/keretHero.ts` / the tile VM: carry the window and the slot kcal budget to the block.
- `components/MealClock.tsx` *(new)*: the button with its 12h ring. It replaces `WindowBar` and the
  logged-only clock.
- `components/MealClockBox.tsx` *(new)*: the box, including `DayDial24` (can live inside) and the
  forecast rows. It replaces `TimeBox`.
- `components/FuelMealBlocks.tsx`:
  - mount MealClock and the pre-log line;
  - drop WindowBar, TimeBox and the logged time line;
  - change the `BudgetRing` semantics to the meal budget with the amber overflow lap;
  - make `FuelScoreChip` boxless with the joint shake.
- `styles/prototype.css`: delete `.fmx-window*` and `.fmx-timebox*`, and add
  `.fmx-mclock*` and `.fmx-mclockbox*`. Motion sits under `prefers-reduced-motion: no-preference`.
- The log path (`data/fuel/mealApi.ts` plus the block log entry) sends `window` when the target
  block is known.

**Backend (`feature/nutrition`, contract `api/feature/meal/meal.yml`):**
- Contract:
  - `MealRequest.window` (new optional `MealWindow {from, to}` HH:mm);
  - `MealTimingDetail` description updated.
  - Regenerate `api.gen.ts`, since the contract-drift gate checks it.
- Liquibase: `meal.window_from TIME NULL`, `meal.window_to TIME NULL`.
- Entity / mapper / service: persist and read back.
- `MealScoringService`: `timingSub(slot, t, storedWindow)`, `windowPassed` and `contextDim` use the
  stored window first. The Időzítés row text uses the minute precision.
- `docs/CODEMAP.md`: regenerate in the same change and after the merge.

**Docs:** update `docs/features/fuel.md` for the clock, window truth, ring semantics and the removed
strip. Add a "Meal clock" slice lesson to the üveg bible appendix.

## 5. Testing

- **Pure logic, table tests:**
  - `mealWindow`: each placement rule, clamping, the overlap split, the minimum width, template
    anchors, hit in/near/far.
  - `mealForecast`: each band × training position × late/not late × has next/last.
  - Reason copy snapshot per code.
- **Components:** `FuelMealBlocks.test.tsx` rewrite:
  - the clock renders on **every** block (pre and post);
  - the ring arc and the dot/now marker;
  - the pre-log line and chip wording;
  - no `.fmx-window`;
  - the logged card has no time line;
  - the box opens with the pre or post content;
  - the honest-null variants;
  - the kcal ring aria and overflow lap;
  - the score button has no box.
- **Backend ITs:**
  - `MealScoringService` with a stored window (in, outside, a snack now scored), without one
    (legacy config path unchanged);
  - the `MealTimingDetail` window round-trip at minute precision;
  - the Liquibase changelog applies.
  - Run focused ITs plus ArchUnit, and the full suite with Testcontainers because this touches
    the contract and a migration.
- **Frontend gates:** both modes (`VITE_USE_MOCK=true` and `false` explicitly) plus the build. The
  mock fixtures gain windows (use the existing 23:35 dinner as the "far" case).
- **Layout spec** (`tests/layout/layout.spec.ts`): `.fmx-block` reachability still holds, and the
  clock is visible at 390px.

## 6. Out of scope

- Any number for blood-sugar response (owner-locked, band only).
- Rewriting the plan when a meal is late. The copy says the next window "tolódik", but the planner
  does not yet re-place windows from actual logs. That goes into a follow-up bd issue.
- Real glucose or CGM data, and step-based window changes. Steps are displayed only.
- Plan history for past days beyond what the stored window fixes for logged meals.

## Prior art

From the researcher report, filtered:

- **Adopted: Oura Meals.** Meals on a 24-hour clock beside sleep and wake. This became the box's
  day dial. We **reject** its glucose-backed claims, because we have no sensor.
  https://ouraring.com/blog/oura-meals/
- **Adopted: the ISSN nutrient-timing position stand.** It gives defensible "why" reasons: protein
  every 3–4 h, fuel placed around training, and a pre-sleep protein note. The copy is hedged to
  *segít*. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5596471/
- **Adopted in spirit: MacroFactor.** Timing is shown descriptively, never graded to the minute,
  and total intake matters most. This became the Mezo note and the no-score hit chip.
  https://macrofactor.com/protein-timing/
- **Adopted: the Levels "modifier" teaching** (a walk after eating). **Rejected: its 1–10 meal
  score.** It relies on measured glucose, and per-person glucose response varies widely (Zeevi et
  al. 2015). https://www.levels.com/blog/zone-and-meal-scores ·
  https://pubmed.ncbi.nlm.nih.gov/26590418/
- **Adopted, hedged: late-eating evidence.** A late meal gives about +46% glucose AUC (Garaulet).
  This is balanced by a 2025 TRE trial that found no insulin-sensitivity benefit when calories
  were matched, so the late-evening copy says *általában* and makes no fat-loss claim.
  https://pubmed.ncbi.nlm.nih.gov/25311083/ ·
  https://www.science.org/doi/10.1126/scitranslmed.adv6787
- **Avoided:** anabolic-window urgency, streaks or penalties for missing a window, and presenting
  time-restricted eating as superior in itself.

## Codebase terrain

From the investigator report, filtered:

- **Card:** `features/fuel/components/FuelMealBlocks.tsx`:
  - `WindowBar` :120-144 (to delete; its comment admits it is not a real window);
  - `BudgetRing` :152-167 (the daily share today);
  - `TimeBox` :174-192 (replaced);
  - `.fmx-clock` logged-only :267-275;
  - `GlycemicChip` :224-236, `FuelScoreChip` :195-217;
  - box state :326-353.
  - It is mounted from `pages/FuelMaiPage.tsx:183` through `useFuelTimeline`.
- **Window sources disagree today:**
  - the FE planner's single time: `buildDayPlan.ts:200-262` `placeWindows`, and the
    `compileTemplate.ts` anchors;
  - the backend's static hourly windows: `MealScoringService.java:653-769`,
    `application.yml:2353-2359`.
  - The "why" is discarded because `PlannedWindow` has no reason field.
  - §3.1 resolves this.
- **Blood-sugar band:** `logic/glycemicBand.ts` is owner-locked (verbatim texts and thresholds, no
  number, the word "vércukor-válasz"). Its deferred "peri" timing branch is what `mealForecast.ts`
  now supplies *around* it without editing it.
- **Day rhythm on the FE:** `useFuelTimeline` → `plan, blocks, wake, bed, nowHHmm, template`.
- **Kit:** the Fuel-centred `GlassBox` (not the shared bottom-docked one; they are deliberately
  unmerged). The clock icon is `ContentIcon i-idozito` → Titanium `t-clock`, so no new sprite is
  needed. The 24h dial glyphs use existing sprite symbols.
- **Traps:**
  - mock `slot` is a Hungarian string and real mode uses the enum;
  - unset `VITE_USE_MOCK` means mock, so run real mode explicitly;
  - the ArchUnit layer subpackages (nutrition must not import train);
  - regenerate the CODEMAP after the merge;
  - Liquibase: no bare `?` in SQL;
  - a fixed `MOCK_NOW_HHMM` in mock mode.

## Addendum (planning, 2026-09-26)

- **Which window the post-log view uses.** `MealTimingDetail` gains `windowSource: plan | config`.
  - The FE judges a logged meal against the stored window only when the source is `plan`.
  - A `config` window (5–10 etc.) never reaches the clock; the tile's planner window is used instead.
- **Forecast copy reuses the owner-approved band texts.**
  - The Energia row starts with `glycemicBand().expect.energy`, used verbatim.
  - The box's blood-sugar paragraph is `glycemicBand().tip`.
  - `mealForecast` adds only the timing clauses: training, next window, bedtime.
  - Its own tip exists only for the late + high meal and the low meal ≤120 min before training.
  - §3.4's band sentences are superseded by these.
- **The card's blood-sugar chip shows the band word under the mini curve.** This is the approved "Csak sáv" look.
- **Steps are not shown in this slice.** "Movement today" lists only the training blocks.
- **The "N. étkezés" wording** is `N. étkezés M közül`, which needs no Hungarian suffix agreement.
