# Magától tanuló energiaigény, 2. rész — weekly summary, learning page, day marks, switch (design)

- **Bead:** `mezo-3n2so` (Part 2 of `mezo-zz91i`; builds on `mezo-y72o3` „Hogy tanultam?”)
- **Date:** 2026-09-27 · **Status:** owner-approved direction (brainstorm 2026-09-27)
- **Parent spec:** [`2026-09-26-learned-expenditure-design.md`](2026-09-26-learned-expenditure-design.md)
  (§2 decisions L1–L8 stand; §5.3 marks, §6 Part 2 are refined here).
- **Look:** Üveg canon. Prototype first: the **Fuel living prototype** `docs/design_2.0/prototypes/elo/fuel.html`
  (seeded in this change, see §9), owner OK before any code.

## 1. Goal

Make the learning visible and correctable. Once a week the app says what it learned and changed,
only when there is something to say; any day can be marked complete or incomplete in one gesture,
with an immediate recompute; one switch takes learning out of the target; one page shows the whole
story week by week. Honest throughout: no number is shown that the data does not support.

## 2. Owner decisions (2026-09-27, do not re-litigate)

| # | Question | Decision |
|---|---|---|
| P1 | When a day mark changes the target | **Immediately.** The mark recomputes the affected week and every later week at once; the target moves now, and a short line says by how much. |
| P2 | Where a day can be marked | **Three places:** the weekly summary sheet (excluded days), the learning page (last 14 days), and the bottom of any day's food log in Fuel. |
| P3 | Switch off | **Keeps learning silently.** The target returns to the formula (+ accepted corrections) at once; the weekly run keeps computing with the same rails, not serving. Switching on serves the value learned meanwhile, with a line saying how much the target moved. |
| P4 | When the weekly card and bell appear | **Only when there is something to say:** the base moved, a day was excluded, or the week was holding (too little data). A quiet week gets no card and no bell. |
| P5 | Detail page shape | **One full page.** „Hogy tanultam?” becomes its own page: week-by-week chart on top, last 14 days with toggles, then the existing six sections about the latest week. The breakdown sheet keeps a one-line summary + „Részletek”. |

Engineering calls (delegated, recorded):

- The card's dismissal is stored **on the server** (per week), so it disappears on every device.
- An **unlogged** day (nothing logged) takes no mark at all: „complete” would count an invented
  zero, and „incomplete” changes nothing (it is already excluded). The UI offers no action on it.
- The chart leaves a **gap** for a week without a row; it never interpolates.
- Carry-overs from Part 1: evaluation basis says „learned” for a learner; the Profile TDEE card
  shows the served (learned) base; confidence casing is lowercase on every FE-facing field (§6.5).

## 3. Prior art

Researcher report, filtered:

- **Adopted: modular check-in that shows only what applies** — MacroFactor's check-in is a chain of
  modules (partial logging, logging break, program update) that appear only when relevant. Our card
  has three optional parts (step, excluded days, holding reason) and is not shown at all on a quiet
  week (P4). https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules
- **Adopted, inverted default: suspicious-day confirmation** — MacroFactor flags partial days but
  counts them *unless* the user confirms, and calls partial logging its "major Achilles heel". We
  exclude by default; the one tap is „teljes volt”. Unanswered = excluded, so no answer is ever
  required. https://help.macrofactorapp.com/en/articles/29-how-do-macrofactor-s-coaching-algorithms-deal-with-partially-logged-days
- **Rejected: guessing intake for unlogged days** (MacroFactor V3) — invented numbers; violates the
  honesty rule. https://macrofactor.com/expenditure-v3/
- **Adopted: report layout** — Carbon puts the new target and the change on top, then a plain "why";
  bad data means no change. Our card: learned base + step first, then reason.
  **Rejected:** Carbon's whole-week self-report question (coarse, needs an answer every week).
  https://help.joincarbon.com/en/articles/6004812-weekly-check-in-in-carbon-how-it-works-and-what-to-expect
- **Adopted and extended: formula → learned story with named holding state** — MacroFactor shows the
  estimate over time from a formula start, but no visible uncertainty band. Our page draws the band
  (±σ̂) narrowing as data builds, and gaps where no data.
  https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure
- **Adopted: "off" stops driving the target, analytics stay** — MacroFactor keeps the expenditure
  screen in every program style. Our switch keeps the page readable („most nem használom”).
  **Rejected:** three program modes; one switch is enough. https://help.macrofactorapp.com/en/articles/91-program-styles
- Not covered: RP Diet (no public docs); Cronometer has no learned estimate.

## 4. Codebase terrain

Investigator report, filtered (anchors at `origin/main` 2026-09-27):

- **Engine:** `goal/engine/service/ExpenditureLearningService.java` — `reviewWeek` (:56, global gate
  :58), `replay` (:116; prev row :137-142), **marks injection point :145-147** (`Map.of()` today),
  `decideAndPersist` (:172, idempotent upsert; supersedes `weekly_correction` and calls
  `recomputeActiveGoal` :224-225). `IntakeDayClassifier.classify(..., marks, ...)` (:26): TRUE→USABLE,
  FALSE→MARKED_INCOMPLETE, unlogged wins over a mark (:32). `LearnedBaseResolver.apply` (:35-54)
  serves the **latest row only**. `GoalPrescriptionCalculator` (:77-80) applies the learned base
  before preferences are resolved. `AdaptiveReviewJob` (:35-51) Monday 06:40, learning first,
  suggestion fallback on empty. `ExpenditureRolloutRunner` (boot, `@Order(208)`).
  `ExpenditureEstimateRepository` has no "rows from week X on" finder yet.
- **Explanation read:** `GET /api/goals/expenditure/explanation` (latest explained week, 204 when
  none) via `ExpenditureExplanationService`/mapper/`GoalController:152`. No multi-week read exists.
  The persisted series statuses are `usable|suspicious|marked|unlogged` — a confirmed-complete day
  reads as `usable`, so mark state needs its own read.
- **Diet preferences:** `nutrition/entity/DietSettingsEntity` (+ ghost defaults in
  `DietSettingsProperties`, precedent `202609030100_mezo-sxlj_…day_type_shift.sql`),
  `DietSettingsService.setSettings` already calls `recomputeActiveGoal`; goal reads it through the
  goal-owned `DietPreferencesPort` (ADR 0012), implemented un-gated by `DietPreferencesResolver`.
  `DietPreferences` is an 8-field positional record (every constructor site changes).
  `api/feature/diet-settings/diet-settings.yml` request/response list all fields as `required`; PUT
  is full replacement.
- **Bell:** `appnotification/domain/AppNotificationKind` (key ≤ 32, no DB CHECK), always-on
  `AppNotificationEmitter.emit(…, dedupKey)`; precedent `goal/service/GoalSuggestionNotificationListener`
  (`@Async @TransactionalEventListener(AFTER_COMMIT)`). FE: `data/types.ts` kind union + meta,
  `features/notification/logic/category.ts` („cel” category), `data/notification/feedMock.ts`.
- **FE:** `features/fuel/pages/FuelMaiPage.tsx:145-149` (top of `EntranceGroup`, `!past`),
  `sheets/EnergyBreakdownSheet.tsx` (`HowLearned` :98, Alap row :189-200), `LearnedBaseExplainer`,
  `LearnedBaseChart`, `learnedBaseFormat.ts`; `data/fuel/expenditure{Api,Hooks,Explanation}.ts`
  (`useDualQuery`), `data/fuel/fuel.ts:450` mock energy fields; `pages/FuelSettingsPage.tsx`
  (`/settings/fuel`, „Finomhangolás” card :302, `dietDirty` diff, one Mentés), `data/fuel/dietSettingsHooks.ts`
  (ghost :9-12; invalidations :35-39 miss `expenditureExplanation`). Router: `app/router.tsx`.
- **Carry-over sites:** `GoalEvaluationService.java:65,122` (basis „adaptive” iff adjustment ≠ 0),
  `meal/service/FuelDayService.java:239-240` (lowercases confidence), `goal.yml:387-390`
  (`learnedConfidence` uppercase), `biometrics/profile/service/BiometricProfileService.java:114`
  (formula only; the biometrics→goal edge already exists).
- **Traps:** re-chain must run weeks ascending and recompute the goal once at the end (each
  `decideAndPersist` recomputes today); replays use today's formula base and plan EAT (rows drift
  slightly on re-chain — accepted, documented); a mark in the current unreviewed week needs no
  re-chain; Liquibase changesets are **appended** to `1.1.0_master.yml`; new table into
  `ResetDatabase` TRUNCATE; jsonb `?` placeholder trap; ArchUnit layer subpackages + frozen cycle
  store; codemap regen after every merge; `VITE_USE_MOCK=false` explicit for the real-mode gate;
  the Monday job bean is off in the test profile; bell must not ring from rollout or re-chain.
- **Prototype:** `elo/fuel.html` does not exist yet and has no Artifact URL — seeding is step one.

## 5. What the owner sees

### 5.1 Weekly summary — a dot on Mai, a sheet behind it (prototype round 2)

**Owner, prototype rounds 1–2:** a card on top of Mai is rejected (Mai focuses on today); pills are
rejected too. The summary lives in a bottom **sheet „Heti tanulás”**; Mai carries only a **dot**.

Shown when **all** hold: learning switch on; a row exists for `weekStart = this Monday − 7`; the
row is *worth saying* (`step ≠ 0` OR `excluded_days` non-empty OR `status = HOLDING`); the row is
not dismissed; today only (never on a past day).

- **The dot** (8 px, glowing, sage; amber when holding) is a signal only, never a tap target
  (`pointer-events: none`). It sits inside the „Miből jön össze?” button (≥ 44 px tall), which opens
  the equation box as before.
- In the equation box the **Alap row** is highlighted (tinted fill, accent ring, the dot, sub-line
  „· heti tanulás ›”); the whole row (full width, ≥ 44 px) opens the sheet and closes the box.
- On the learning page the **status row** becomes a full-width button (dot + „· heti összegző ›”)
  opening the same sheet.

Sheet content, top to bottom (each part only when it applies):

Content, top to bottom (each part only when it applies):

1. **Head:** „Heti tanulás · <date range>” and the learned line „Alap 2 480 kcal · Közepesen
   biztos · ±150 kcal” (holding: the head says „Ezen a héten vártam”).
2. **Change:** „+60 kcal a napi keretedben” with one reason line („a súlyod lassabban nőtt, mint
   amit a felírt evés alapján vártam”) — or, holding: „kevés adat volt: 3 teljes nap, 1 mérlegelés
   — legalább 4 és 2 kell”, and the base did not move.
3. **Excluded days:** one row per excluded day: weekday + date, logged kcal, reason („hiányosnak
   tűnt” / „te jelölted hiányosnak”), and a one-tap **„Teljes volt”** (suspicious days only; a marked
   day offers „Mégis teljes volt”). Tapping recomputes at once (P1); the sheet re-renders in place with the new
   result and a line „A keret +40 kcal-lal változott” (or „nem változott”).
4. **Footer:** „Részletek” → the learning page; „Bezárom” → dismiss (server-side, per week).

No answer needed: an untouched summary leaves suspicious days excluded (parent L2).

### 5.2 Bell

One feed item per week, emitted only by the Monday job, only when the summary would show and the
switch is on: title „Heti tanulás: +60 kcal” / „Heti tanulás: kevés adat volt” / „Heti tanulás: 2
nap kimaradt”; tap → learning page. Never from the deploy rollout or a re-chain.

### 5.3 Learning page — „Hogy tanultam?” (route `/fuel/tanulas`)

Entry: the Alap row's „Részletek” in the energy breakdown sheet, the weekly sheet, the bell, the
day-log mark line („Mit jelent ez?”).

1. **Status line:** switch on → „Tanult alap · Közepesen biztos · ±150 kcal”; switch off → „Most
   nem használom — a keret a képletből jön” + the silently learned value in muted tone.
2. **Week by week chart:** up to the last 26 weeks with a row. Two lines: formula base (dashed,
   muted) and applied base (accent), with the ±σ̂ band around the posterior. A week without a row is
   a gap; holding weeks get a hollow marker. Tap a week → its numbers (formula, learned ±, applied,
   step, usable days, weigh-ins).
3. **Last 14 days:** one row per day (today excluded — the day is not over): date, logged kcal (or
   „nincs felírva”), status chip — **számít** / **hiányosnak tűnt** (excluded by the rule) /
   **te jelölted hiányosnak** / **te jelölted teljesnek** / **nincs felírva** — and a toggle
   „számít” (on/off). Toggling recomputes immediately with the change line (P1). Unlogged rows have
   no toggle.
4. **The six sections** of the existing explainer about the latest reviewed week, unchanged.

Empty state (no row yet): „Még nem tanultam — ehhez legalább 10 felírt nap kell az utolsó 4 hétből
és heti 2 mérlegelés.” No chart, no invented numbers; the 14 days still render.

### 5.4 Day-log mark line — Fuel „Mai”, any day

At the bottom of a day's food log (today and past days): a quiet line with the day's status and one
action:

- usable day → „Ez a nap számít a tanulásban” · action „Hiányos volt”;
- suspicious (auto-excluded) → „Ez a nap hiányosnak tűnt, kihagytam” · action „Teljes volt”;
- marked incomplete / complete → the status + „Visszavonom” (clears the mark, back to the rule);
- unlogged → no line.

Today's day: marking it only saves the mark (it counts next Monday); the line says so.

### 5.5 Switch — diet settings („Finomhangolás” card)

„Tanulás a súlyomból és az evésemből” with a one-line hint („Hetente megtanulom, mennyi energiát
használsz valójában”). On by default. Saved with the existing Mentés. Off: the target returns to the
formula at once; the Monday weight-only suggestion may return. On again: the silently learned value
is served; the settings page shows „A keret −80 kcal-lal változott” after save.

## 6. Engineering design

### 6.1 Data

- **`intake_day_mark`** (goal-owned; `goal/entity/IntakeDayMarkEntity`, repository in
  `goal/repository`): owned columns (`id`, audit, `created_by uuid` FK `app_user` on delete cascade,
  `is_deleted`), `day date not null`, `status varchar(16)` CHECK in (`COMPLETE`,`INCOMPLETE`); partial
  unique index `(created_by, day) where is_deleted = false`. Clearing a mark deletes the row.
- **`expenditure_estimate.dismissed_at timestamptz null`** — the card's dismissal. The upsert in
  `decideAndPersist` **preserves** it (a re-chain must not resurrect a dismissed card).
- **`diet_settings.learning_enabled boolean not null default true`** + ghost default
  `mezo.diet-settings.default-learning-enabled: true`; `DietPreferences` gains `learningEnabled`.
- Liquibase: one script `…_mezo-3n2so_learned_expenditure_part2.sql`, appended to `1.1.0_master.yml`;
  `intake_day_mark` added to `ResetDatabase`.

### 6.2 Engine changes

- **Marks:** `replay` loads marks for the classifier window from the new repository and passes them
  (`COMPLETE`→TRUE, `INCOMPLETE`→FALSE) instead of `Map.of()`. Classifier rule unchanged (unlogged
  wins).
- **Switch (P3):** the per-user switch is read through `DietPreferencesPort`.
  - `LearnedBaseResolver.apply` serves the learned base only when the switch is on → off falls back to
    the formula + `balanceAdjustmentKcal` automatically.
  - `reviewWeek` is **not** gated by the switch (learning continues), but when off it does **not**
    supersede an open `weekly_correction`.
  - `AdaptiveReviewJob`: switch off → run the learning step (silent) **and** the weight-only
    suggestion path; switch on → as today (learning, fallback only on empty).
  - `ExpenditureRolloutRunner` unchanged (it runs the learning step, which is switch-agnostic).
- **Re-chain (P1):** new `ExpenditureLearningService.rechainFrom(user, day)`:
  `weekStart(day)`; if that week is ≥ the current week (not yet reviewed) → return (mark saved only).
  Else run the week step for `weekStart(day)` and every later week that has a row (ascending, up to
  the last completed week), via a `persistOnly` variant that skips the per-week goal recompute and
  supersede; then **one** `recomputeActiveGoal` if the latest `appliedBase` changed. Returns
  `{appliedBaseBefore, appliedBaseAfter}` of the latest row. Replays use today's formula and plan
  EAT (documented drift).
- **Card worthiness** is a pure function `WeeklyCardPolicy.worthSaying(row)` shared by the card
  read and the bell.
- **Bell:** `AppNotificationKind.EXPENDITURE_WEEK` (`expenditure_week`, feed-only, `familyKey` null,
  deeplink `/fuel/tanulas`). The job publishes an event after the learning step when switch on and
  worth saying; an AFTER_COMMIT listener emits with dedupKey `expenditure_week:<weekStart>`.
- **Carry-overs:** `GoalEvaluationService` basis = `learned` when the served bootstrap is learned
  (the calculator hands the flag through); `BiometricProfileService` passes its bootstrap through
  `LearnedBaseResolver` (existing biometrics→goal edge; verify no new ArchUnit cycle).

### 6.3 API (contract-first, `api/feature/goal/goal.yml`)

| Method + path | Returns |
|---|---|
| `GET /api/goals/expenditure/weeks?limit=26` | `ExpenditureWeek[]` ascending: `weekStart, status, confidence, formulaBaseKcal, posteriorBaseKcal, posteriorSdKcal, appliedBaseKcal, stepKcal, usableDays, weighInDays` + top-level `learningEnabled` (wrapper `ExpenditureHistory {learningEnabled, weeks}`) |
| `GET /api/goals/expenditure/weekly-card` | `ExpenditureWeeklyCard {weekStart, weekEnd, status, confidence, appliedBaseKcal, posteriorSdKcal, stepKcal, usableDays, weighInDays, minUsableDays, minWeighInDays, excludedDays[{date, kcal, reason: suspicious|marked}]}`; **204** when §5.1 says no card |
| `POST /api/goals/expenditure/weekly-card/{weekStart}/dismiss` | 204 |
| `GET /api/goals/expenditure/days?from=&to=` (max 56 days) | `IntakeDayStatus[] {date, kcal, status: usable|suspicious|marked_incomplete|confirmed_complete|unlogged, mark: complete|incomplete|null}` — computed live with the classifier (not from the persisted explanation) |
| `PUT /api/goals/expenditure/days/{date}/mark` body `{status: complete|incomplete}` | `IntakeDayMarkResult {day: IntakeDayStatus, appliedBaseBeforeKcal, appliedBaseAfterKcal, recomputed: bool}` |
| `DELETE /api/goals/expenditure/days/{date}/mark` | same `IntakeDayMarkResult` |

Rules: marking an unlogged day (either status) → 409; a future date → 400; `from`/`to` range > 56 → 400.
`diet-settings.yml` gains `learningEnabled` (boolean; **optional** in the request, defaulting to the
stored value, so older clients cannot silently reset it).

### 6.4 Frontend

- Data (`data/fuel/`): `expenditureHistory`, `expenditureWeeklyCard`, `intakeDays` queries and
  `useIntakeDayMark` mutation via `useDualQuery` with mock seeds; mock mutation updates the mock
  state and returns a deterministic ±kcal. Invalidations after a mark or switch save: `fuelDay`,
  `goals`, `expenditureExplanation`, `expenditureHistory`, `expenditureWeeklyCard`, `intakeDays`.
- `features/fuel/sheets/WeeklyLearningSheet.tsx` (the summary sheet) + the dot: `WeeklyLearningDot`
  inside the „Miből jön össze?” button (Mai, today) and the highlighted Alap row in the equation box
  (both open the sheet via the Alap row only), the learning page's status row as a button,
  `components/DayLearningMark.tsx` (bottom of the day log), `pages/LearningPage.tsx` (route
  `/fuel/tanulas`, reuses `LearnedBaseExplainer`'s six sections; new `LearningHistoryChart`), the
  breakdown sheet's `HowLearned` becomes a summary line + „Részletek” link. Settings: switch row in
  the „Finomhangolás” card, part of `dietDirty` and the draft.
- Bell FE: kind `expenditure_week` in the `types.ts` union + meta (Titanium sprite icon), category
  „cel”, a mock row.
- Every icon from the Titanium sprite; any new one on the prototype's „Új ikonok” sheet first.

### 6.5 Confidence casing

Every **FE-facing** confidence is lowercase (`low|medium|high`), matching `FuelDayEnergy` and the
explanation endpoint; the new endpoints follow it. `GoalPrescription.learnedConfidence` is persisted
inside the prescription jsonb, uppercase; it stays as is and is documented as internal (FE must read
`FuelDayEnergy.baseConfidence` instead). No FE code reads it today.

## 7. Error handling and honesty rules

- No row → no card, page empty state, day statuses still live. No number is ever shown for a week
  without a row, and σ̂ is always shown next to a learned value.
- A day with no logged food takes no mark (409; the UI never offers it).
- Re-chain failure rolls back the whole mark (one transaction) and the UI shows „Nem sikerült
  menteni, próbáld újra”; the toggle returns to its old state.
- Switch off never deletes rows or marks.

## 8. Testing

- **Pure:** `WeeklyCardPolicy` table test; classifier with marks (both directions, unlogged wins).
- **Service ITs (Testcontainers):** mark in an older week re-chains later weeks ascending and
  recomputes the goal once; mark in the current week saves only; dismissed_at survives a re-chain;
  switch off → resolver serves formula + adjustment, learning still writes rows, `weekly_correction`
  not superseded, suggestion path runs; switch on again serves the latest row; bell emitted once per
  week only from the job; a mark on an unlogged day → 409.
- **Contract/controller** tests for the five new endpoints; diet-settings round trip with and
  without `learningEnabled`.
- **FE:** dot + sheet visibility states (moved / excluded / holding / dismissed / none), one-tap confirm
  re-renders with the change line, learning page empty + full + switch-off states, 14-day toggles,
  day-log line states, settings switch in the dirty diff; both modes (`CI=true`, mock and
  `VITE_USE_MOCK=false`); a `tests/layout` spec for the learning page at 320 px; `pnpm build`.

## 9. Delivery order

1. **Seed the Fuel living prototype** `elo/fuel.html` from `fuel-uveg.html` + `uveg-fuel-tobbi.html`,
   matched against the live screens; fold in `hogy-tanultam.html` as a route. Commit the seed alone.
2. Add the Part 2 routes (weekly sheet behind the Mai dot, learning page, day-log line, settings switch, bell item,
   „Új ikonok” if needed); publish as the Fuel Artifact, record the URL in `elo/README.md`.
   **Owner OK.**
3. Plan (with the *Kész, ha…* checklist) → owner OK → build → gates → merge → deploy → verify live.

## 10. Out of scope

- Guessing intake for unlogged days; per-meal „quick add” to fix a partial day.
- A week-level „this whole week was unreliable” answer.
- Learning-rate or rail tuning; reviving the Monday suggestion for a learner who stops logging.
- Light mode.
