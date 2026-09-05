# Proactive Coaching S6 — Rules Batch B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the epic's remaining six detections — `acute_bad_day`, `load_fuel_mismatch`, `rapid_weight_loss`, `joint_overuse`, `ignored_nudge`, `late_eating` — on the existing flag spine, each with an honesty gate, a deterministic fact block, and (for two of them) a one-tap action the previous slice already built.

**Architecture:** Slice S6 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §4 (rows 2, 7, 8, 10, 14, 16). Every rule is a `FlagRule` implementation reading through `MetricSeriesService` or a bounded repository finder, wired into `FlagEvaluator`, with its thresholds in `FlagProperties` and its evidence in `AdviceFactRenderer`. Nothing new is invented at the delivery end: S4's severity gate already ranks all six keys (they sit in `AdvicePriority.ORDER` as pre-seeded literals) and S5's action framework already has the two adapters these rules point at.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, React/TS frontend (one small task), JUnit ITs extending `AbstractIntegrationTest`.

## The one thing that makes this slice dangerous

**Six new flag keys × five runtime-only mirrors.** This epic's recurring defect is an enumeration nobody re-derives, and three of the five flag-key mirrors fail only at runtime:

| Mirror | Where | How it fails if missed |
|---|---|---|
| `FlagKey` constant | `companion/flags/service/FlagKey.java` | compile error (the safe one) |
| `FlagProperties.CooldownHours` field + `forFlag` switch arm | `companion/flags/config/FlagProperties.java` | **runtime**: the `default` branch throws `COMPANION_FLAG_UNKNOWN_KEY` inside `FlagService.evaluateAndLog`, per-user, swallowed by the listener's catch |
| `ck_companion_flag_log_flag_key` DB CHECK | a NEW Liquibase changeset | **runtime**: insert fails |
| `@Pattern` on `CompanionFlagLogEntity.flagKey` | `companion/flags/entity/` | **runtime**: Bean Validation rejects the row BEFORE the DB CHECK is reached |
| `@Pattern` on `CompanionProperties.Intervention.flag` | `companion/config/CompanionProperties.java` | **Spring CONTEXT STARTUP** — the app refuses to boot once the intervention library references the key |

And three further sites that are not "mirrors" but silently degrade:

- `AdvicePriority.ORDER` — already contains all six keys as **string literals** marked `// S6`, deliberately not constants (adding constants before widening the CHECK and the two regexes was the trap). This slice replaces the literals with the new `FlagKey` constants.
- `AdviceFactRenderer.render`'s `switch` — `default -> List.of()`, **silent**. A rule without a renderer arm ships a card with an empty evidence block.
- `CompanionFlagLogRepository.existsProblemRaiseSince` — hardcodes `NOT IN ('all_healthy', 'logging_gap')`. Every new key silently counts as a "problem raise" that suppresses `all_healthy` for a whole quiet window. That needs a per-key decision, not a default.

**Task 2 does all of this at once, with an enumeration test**, rather than six partial widenings. Do not spread it across the rule tasks.

## Decisions already made — do not re-litigate

- **The spec's metric names are stale.** `COMBINED_TRAINING_LOAD` is really `MetricKey.COMBINED_LOAD_MIN`; `LAST_MEAL_CLOCK` is really `MetricKey.LATE_MEAL_HOUR`. Use the real enum names.
- **`acute_bad_day` does NOT read a metric series.** It needs the raw same-day check-ins ("≥2 check-ins with body ≤3 or energy ≤3"), and `MetricKey.CHECKIN_BODY`/`CHECKIN_ENERGY` are day-AVERAGED — averaging is exactly what destroys the signal. Use `CheckInRepository.findByCreatedByAndDateOrderBySlotTime(userId, today)` and count raw rows.
- **`all_healthy`'s suppression list is a per-key judgement.** The spec's own reasoning for excluding `logging_gap` was that it names a data-availability gap rather than a health problem. Applying the same test: `acute_bad_day`, `load_fuel_mismatch`, `rapid_weight_loss`, `joint_overuse` and `late_eating` ARE behaviour/health signals and must count as problems (i.e. stay OUT of the exclusion list). `ignored_nudge` is about the app's own nudging failing to land, not about the user's health — it joins `logging_gap` in the exclusion list. Record that reasoning in the query's javadoc.
- **Two rules offer actions, and both adapters already exist** (S5): `joint_overuse` → `lighten_tomorrow`, `ignored_nudge` → `shift_sleep_anchor`. `AdviceActionCatalog` is the seam; it already gates an offer on the action's port being registered, so no new plumbing is needed.
- **`skip_sport_slot` is NOT offered by any S6 rule.** The spec assigns lighten to `joint_overuse` and the anchor shift to `ignored_nudge`, and nothing to the skip. Task 12 still closes the FE skip gap (`mezo-cq06`), because that gap is what would make offering it later unsafe, and because the backend already honours the skip while five FE surfaces do not — a live coherence seam regardless of whether a card offers the button.

## Prerequisites this slice must fix first (Task 1)

Both are the same defect class: an extractor that loads a user's entire history and filters in Java. Harmless while nothing called them per-user-per-hour; the hourly `FlagSweepJob` about to consume them is what makes them matter.

- **`WEIGHT_TREND_PCT_WK`** (bd `mezo-9gp3`, filed after S1's review, explicitly carried forward as "must be wired before S6 consumes it"): `MetricSeriesService.weightTrendPctWk` calls `weightLogRepository.findAllOwned(userId)` — every weigh-in ever — then filters to `[from-6, to]`. `rapid_weight_loss` reads it, and `load_fuel_mismatch` embeds it as a corroborating fact.
- **`LATE_MEAL_HOUR`** (found during this slice's recon, not previously filed): `MetricSeriesService.lateMealHour` calls `mealRepository.findAllOwned(userId)` with the identical shape. `late_eating` reads it.

Every other date-scoped extractor in that file bounds the repository call instead (`shoulderStrain` uses `findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc`). Fix both to match, using the bounded finders that already exist — `WeightLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc` for weight, and whatever the meal repository's bounded equivalent is (check; add one following the sibling naming if it is missing).

## Global Constraints

- **Every new flag key needs all five mirrors plus the three degrade-sites above.** Task 2 owns them; later tasks must not add a key.
- **Honesty gates are load-bearing, not decoration** (spec §7): too little data ⇒ the rule stays silent or says "data gap" explicitly, never estimates. Each rule below states its own gate; implement it as a guard that returns `Optional.empty()`, and give each one a test that proves silence.
- **Unlogged days are never counted as compliant OR as violating** — they route to `logging_gap`, which already exists. A rule that treats a missing day as a good day is wrong; so is one that treats it as a bad day.
- `MetricSeriesService.series(...)` returns a day→value map where **missing days are simply absent**, with two documented exceptions that are calendar-complete and where an unlogged day is a real `0.0`: `COMBINED_LOAD_MIN` and `HABITS_DONE`. `load_fuel_mismatch` reads the first of those — so for it, "no data" and "a rest day" look identical, and its ≥4-logged-days gate must be computed from the OTHER side (kcal / sleep), not from the load series.
- **`FlagEvaluator` has no `List<FlagRule>` injection** — rules are individually autowired fields called in a fixed order. Each rule task adds a field and a call line. `AllHealthyRule` must stay last and stay gated on `raises.isEmpty()`.
- Liquibase changesets are immutable; new files timestamped after the newest existing one, registered in `1.0.0_master.yml`. Index names carry the `idx_` prefix (CI's `lint` job runs `node scripts/lint-liquibase.mjs` — S5 shipped an `ix_` and failed it).
- Any new owned domain table joins `ResetDatabase`'s TRUNCATE list in the same change (a documented growth rule; S5 broke it once).
- Any new `SystemMessage` code needs a `messages.properties` entry.
- ArchUnit (CI): rules live in `companion/flags/service/rule`, services in `service` packages, no field injection (constructor DI), no class-level `@Transactional`, no `@Value` (config must be a `*Properties` record), `no_raw_generic_exceptions_outside_techcore`, and the FROZEN `feature_slices_are_cycle_free`. Note the direction each rule needs: `companion → biometrics`, `companion → train`, `companion → meal`, `companion → notification` — **verify each before you write the import**, and if one does not already exist, invert it through a port rather than creating a cycle.
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's (`./mvnw … | tail` reports `tail`'s). "Tests run: 0" or a `-Dtest` name matching nothing is a FAILURE to report, not a pass.
- Frontend (Task 12 only): `pnpm test`, then `VITE_USE_MOCK=false pnpm test`, then `pnpm build`. Known load flakes: `ActiveWorkoutPage.test.tsx` (bd `mezo-0121`), `insights.nav.test.tsx`.
- Run everything from this worktree's root; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.6)` plus a `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` in the same change as any new file, and AFTER any docs edit.

## File Structure

| File | Responsibility |
|---|---|
| `companion/service/MetricSeriesService.java` (M) | bound the two unbounded extractors |
| `companion/flags/service/FlagKey.java` (M) | six new constants |
| `companion/flags/config/FlagProperties.java` (M) | six threshold records + six `CooldownHours` fields + six `forFlag` arms |
| `companion/flags/entity/CompanionFlagLogEntity.java` (M) | the `@Pattern` mirror |
| `companion/config/CompanionProperties.java` (M) | the `Intervention.flag` `@Pattern` mirror |
| `db/changelog/.../2026090?????_mezo-d58h.6_flag_key_batch_b.sql` (C) | the DB CHECK mirror |
| `companion/flags/repository/CompanionFlagLogRepository.java` (M) | `existsProblemRaiseSince`'s exclusion decision; a push-log range finder if `ignored_nudge` needs one |
| `companion/flags/entity/FlagPayloadEnvelope.java` (M) | six new payload records + factories |
| `companion/flags/service/rule/AcuteBadDayRule.java` … `LateEatingRule.java` (C ×6) | the rules |
| `companion/flags/service/FlagEvaluator.java` (M) | six fields + six call lines |
| `proactive/service/AdvicePriority.java` (M) | literals → constants |
| `proactive/service/AdviceFactRenderer.java` (M) | six new switch arms |
| `proactive/service/AdviceActionCatalog.java` (M) | two action offers |
| `application.yml` (M) | six threshold blocks + six cooldowns + six intervention-library entries |
| `frontend/src/features/fuel/logic/buildProtocol.ts`, `data/today/todayHooks.ts`, `features/today/logic/useDayOrbFill.ts`, `data/ritual/recapHooks.ts`, `data/fuel/fuelWeekHooks.ts` (M) | the skip gap (`mezo-cq06`) |
| `docs/features/companion.md`, `docs/features/proactive.md` (M) | the six detections and their gates |

---

### Task 1: bound the two unbounded metric reads

**Files:** `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`; possibly `feature/meal/repository/MealRepository.java`; `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesServiceIT.java` (verify the real class name first)

Fix `weightTrendPctWk` and `lateMealHour` to bound their repository reads to the requested window, exactly as `shoulderStrain` does. The weight finder already exists:

```java
List<WeightLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
        UUID createdBy, LocalDate from, LocalDate to);
```

**Mind the window's left edge:** `weightTrendPctWk` computes a 7-day rolling slope, so it legitimately needs data from `from.minusDays(6)`, not `from`. Bound the query to `[from.minusDays(6), to]` — narrowing it to `[from, to]` would silently change the metric's values at the start of every window, which is a behaviour change disguised as a performance fix. Say in your report which bound you used and why.

For meals, check whether a bounded finder exists; if not, add one following the sibling naming convention.

- [ ] **Step 1:** Write a test that pins the metric's VALUES unchanged across a fixture with weigh-ins/meals both inside and outside the window — this is a refactor, so the test's job is to prove the numbers did not move.
- [ ] **Step 2:** Run it to confirm it passes against the current code (it should — this is a characterisation test).
- [ ] **Step 3:** Make both extractors bounded.
- [ ] **Step 4:** Re-run: same values, and ideally assert the repository is called with bounds (a spy, or simply trust the value-equality plus a code read — say which you did).
- [ ] **Step 5:** Commit: `perf(companion): bound the weight-trend and late-meal metric reads (mezo-d58h.6, mezo-9gp3)`

Then close `mezo-9gp3` with `bd close mezo-9gp3` in the shipping task, not here.

---

### Task 2: the six flag keys and every mirror, at once

**Files:** `FlagKey.java`, `FlagProperties.java`, `CompanionFlagLogEntity.java`, `CompanionProperties.java`, a new Liquibase changeset + `1.0.0_master.yml`, `CompanionFlagLogRepository.java`, `AdvicePriority.java`, `application.yml` (cooldowns only); tests: `FlagPropertiesIT` (verify the name), `CompanionFlagLogPersistenceIT`, `AdvicePriorityTest`

The six keys, in the spec's severity order: `acute_bad_day`, `load_fuel_mismatch`, `rapid_weight_loss`, `joint_overuse`, `ignored_nudge`, `late_eating`.

- [ ] **Step 1: Write the enumeration test FIRST.** Extend `AdvicePriorityTest`'s existing reflection test — it already asserts every live `FlagKey` constant has a rank, so adding the constants without adding ranks fails there. Then add a NEW test asserting the reverse direction too: every entry in `AdvicePriority.ORDER` that looks like a flag key is a real `FlagKey` constant (this is what catches a literal that never got promoted). Also extend the flag-log persistence IT to `rawInsert` each of the six new keys and assert the DB CHECK accepts them, plus one nonsense key it still rejects.

- [ ] **Step 2: Run them — they must fail** for the missing constants and the missing CHECK values.

- [ ] **Step 3: Add all five mirrors.** `FlagKey` constants; six `CooldownHours` fields with six `forFlag` arms; a new changeset dropping and re-adding `ck_companion_flag_log_flag_key` with all thirteen keys (copy the S2 changeset's comment style, and note the `flag_key` column is `length = 24` — check every new key fits, `load_fuel_mismatch` is 19 and `rapid_weight_loss` is 17, so they do); the entity `@Pattern`; the `Intervention.flag` `@Pattern`. Cooldown defaults in `application.yml`, from spec §4 where stated and otherwise 48h for acute signals and 72h for slower ones — state your choice per key in the report.

- [ ] **Step 4: Promote `AdvicePriority.ORDER`'s six literals to the new `FlagKey` constants** and delete the `// S6` comments. The order must not change.

- [ ] **Step 5: Decide and implement `existsProblemRaiseSince`.** Per the Decisions section: `ignored_nudge` joins `logging_gap` in the exclusion list; the other five stay counted. Update the query and extend its javadoc with the reasoning (the existing javadoc already explains why `logging_gap` is excluded — extend that argument rather than replacing it). Add a test proving an `ignored_nudge` raise does NOT suppress `all_healthy` while an `acute_bad_day` raise does.

- [ ] **Step 6:** Run: the enumeration tests, `FlagPropertiesIT`, the flag-log persistence IT, `AdvicePriorityTest`, `FlagServiceIT`, and every `FlagEvaluator*IT` (verify names first). Plus `node scripts/lint-liquibase.mjs`.

- [ ] **Step 7:** Commit: `feat(companion): the six batch-B flag keys and every mirror (mezo-d58h.6)`

---

### Task 3: the six rules' config

**Files:** `FlagProperties.java`, `application.yml`, `FlagPropertiesIT`

Six nested records, one per rule, following the existing ones' shape exactly (every threshold config, never in code). The defaults come from spec §4:

- **`acute_bad_day`**: `minCheckIns` 2, `bodyOrEnergyAtMost` 3.
- **`load_fuel_mismatch`**: `windowDays` 7, `loadThreshold` (in `COMBINED_LOAD_MIN` minute-equivalents — pick a defensible default and say how you derived it from the spec's "above threshold" plus the evidence in spec §0), `kcalFractionOfTarget` 0.80, `sleepFloorHours` 7.0, `minLoggedDaysPerSide` 4.
- **`rapid_weight_loss`**: `pctPerWeekAtMost` −0.7, `minWeighIns` 4.
- **`joint_overuse`**: `windowDays` 7, `strainAvgAtLeast` 5.0, `muscleNeedle` "shoulder".
- **`ignored_nudge`**: `category` "lights_out", `minConsecutiveDays` 5, `nonComplianceMinutes` 60.
- **`late_eating`**: `minutesBeforeBed` 90, `absoluteHour` 22.5 (the spec's "after 22:30", expressed in the fractional-hour unit `LATE_MEAL_HOUR` actually uses), `minDaysOfLastThree` 2, `windowDays` 3.

- [ ] Failing config test first (bind the properties and assert every field's default), then the records, then the YAML. Commit: `feat(companion): batch-B rule thresholds in config (mezo-d58h.6)`

---

### Tasks 4-9: one task per rule

**Each task delivers:** the `FlagRule` class in `companion/flags/service/rule/`, its `FlagPayloadEnvelope` nested record + static factory, its `FlagEvaluator` field and call line, its `AdviceFactRenderer` switch arm rendering deterministic Hungarian facts from that payload, its intervention-library entry in `application.yml` (the card's suggestion text AND the template prose when the LLM call fails), and its IT.

**Read `SustainedStressRule` first** — it is the canonical shape: read the window from `FlagProperties`, pull a series from `MetricSeriesService`, aggregate, `Optional.empty()` on no-raise, else `Optional.of(new FlagRaise(FlagKey.X, FlagPayloadEnvelope.x(...)))`. The payload must freeze BOTH the thresholds and the observed values, so the raise is reproducible from the log alone — that is what `AdviceFactRenderer` renders and it is a contract, not a convenience.

**Every rule's IT must include a silence test for its honesty gate**, and a boundary pair (just inside / just outside). Follow `FlagEvaluatorStressSleepIT`'s idiom: a `keys(owner)` helper over `evaluator.evaluate(owner)`, populator-built fixtures, `contains`/`doesNotContain` on the `FlagKey` constant, plus one assertion reading the payload's own fields.

- [ ] **Task 4 — `acute_bad_day`** (severity rank 1, the most urgent card in the whole system). Reads `CheckInRepository.findByCreatedByAndDateOrderBySlotTime(userId, today)` — NOT a metric series, because the day-average destroys the signal. Raises when ≥`minCheckIns` of today's check-ins have `body <= 3` or `energy <= 3`. **Honesty gate:** fewer than `minCheckIns` check-ins today ⇒ silent (one bad check-in is a moment, not a day). Mind that `body` and `energy` are nullable `Integer` on a 1-10 scale — a null is not a low score. Payload: the count, the threshold, and each qualifying check-in's slot time + body + energy. Facts should name the day's pattern, not just a number.
- [ ] **Task 5 — `load_fuel_mismatch`** (rank 2). Reads `COMBINED_LOAD_MIN` (calendar-complete: an unlogged day is a real 0.0), the kcal series, and the sleep series over `windowDays`. Raises when the 7-day load average is above `loadThreshold` AND (7-day kcal average < `kcalFractionOfTarget` × the user's target OR 7-day sleep average < `sleepFloorHours`). **Honesty gate:** ≥`minLoggedDaysPerSide` logged days on EACH side, else `logging_gap` owns the story — and note the load series cannot supply that count (its zeros are indistinguishable from absence), so count logged days from the kcal and sleep series. Also embed `WEIGHT_TREND_PCT_WK` as a CORROBORATING fact when it is available (spec §4 row 10 asks for this explicitly) — but never as a trigger condition. Payload: both averages, both thresholds, the logged-day counts per side, and the weight trend if present. Find the kcal target's real source before writing (there is a goal/diet target in this codebase — name it in your report).
- [ ] **Task 6 — `rapid_weight_loss`** (rank 3). Reads `WEIGHT_TREND_PCT_WK` (bounded by Task 1). Raises when the latest value is < `pctPerWeekAtMost` with ≥`minWeighIns` weigh-ins in the window AND the user's goal is not a cut. **Honesty gate:** the metric's own extractor already yields no data point below 4 points in its rolling window — do not re-implement that, but DO gate on the goal direction, and find how "goal ≠ cut" is actually expressed in this codebase before writing (name it in your report; do not guess a field name). Payload: the trend value, the threshold, the weigh-in count, the goal direction.
- [ ] **Task 7 — `joint_overuse`** (rank 4, offers `lighten_tomorrow`). Reads `SHOULDER_STRAIN` over `windowDays` and `WorkoutService.findPlannedTemplateForDate(userId, today.plusDays(1))`. Raises when the 7-day strain average ≥ `strainAvgAtLeast` AND tomorrow's planned session is shoulder-focused — the session-level `WorkoutSessionEntity.muscle` field, normalised through `MuscleGroup.of(...)` and compared against `muscleNeedle`. Use `findPlannedTemplateForDate`, NEVER `getToday` (that one writes on every call). **Honesty gate:** no strain data points in the window ⇒ silent; no planned session tomorrow ⇒ silent. Payload: the average, the threshold, the day count, tomorrow's date and muscle focus.
- [ ] **Task 8 — `ignored_nudge`** (rank 8, offers `shift_sleep_anchor`). The most composed rule: a `lights_out` push sent on ≥`minConsecutiveDays` consecutive days while the observed bedtime was never within `nonComplianceMinutes` of the anchor. Sent pushes are `push_log` rows (`category` = `NotificationCategory.LIGHTS_OUT`'s wire value `"lights_out"`); `PushLogRepository` has **no date-range finder** — add one following the sibling naming. Observed bedtime is `MetricKey.BEDTIME_HOUR`; the target is `SleepAnchorPort.resolve(userId).bed()`. **Mind two traps:** `BEDTIME_HOUR` shifts clock hours below 12 by +24 so post-midnight bedtimes sort on one number line (compare in that shifted space, not raw wall-clock); and `SleepAnchorPort` GHOSTS a config default when no `sleep_goal` row exists, so a user with no goal would be measured against an invented target — gate on the goal row existing, read through `SleepGoalRepository` directly. **Honesty gate:** an unlogged night is neither compliant nor violating, so a gap in `BEDTIME_HOUR` breaks the consecutive run rather than extending it. Payload: the category, the run length, the threshold, the anchor, and each night's observed bedtime.
- [ ] **Task 9 — `late_eating`** (rank 9). Reads `LATE_MEAL_HOUR` (bounded by Task 1) over `windowDays` = 3. Raises when on ≥`minDaysOfLastThree` of the last three days the last meal was within `minutesBeforeBed` of the bedtime anchor OR after `absoluteHour`. Same anchor-ghosting trap as Task 8 — gate on the goal row for the anchor half; the absolute-hour half needs no goal. **Honesty gate:** days with no logged meal are not late days. Payload: per-day last-meal hours, the anchor, both thresholds, and which condition each qualifying day met.

Each task: failing IT first → the rule → wire it into `FlagEvaluator` → the renderer arm → the config entry → the named ITs green → one commit, e.g. `feat(companion): acute_bad_day detection (mezo-d58h.6)`.

---

### Task 10: the two action offers

**Files:** `proactive/service/AdviceActionCatalog.java`, `AdviceActionCatalogTest`, `AdviceCardServiceIT`

`joint_overuse` → `lighten_tomorrow` (params `{"delta": -1}`); `ignored_nudge` → `shift_sleep_anchor` (params `{"minutes": -30}`). The catalog already gates an offer on the action's port being registered and caps at two actions per card — keep both properties, and note the anchor-shift offer must ALSO keep its existing sleep-goal-row precondition, which `ignored_nudge`'s own gate happens to guarantee but the catalog must not assume.

- [ ] Failing test first (a delivered `joint_overuse` card carries the lighten action; a delivered `ignored_nudge` card carries the anchor shift; neither carries the other's), then the mapping. Commit: `feat(proactive): offer the lighten and anchor-shift actions on their round-2 cards (mezo-d58h.6)`

---

### Task 11: the fact renderers' enumeration guard

**Files:** `AdviceFactRendererTest`

By now all thirteen flag keys have renderer arms. S4's fix wave added a reflection test asserting every live `FlagKey` produces a non-empty fact list for a representative payload — it must now cover the six new keys, which means adding six fixtures to its `fixtureFor` helper. If that test was written to throw on an unmapped key (it was), it is already failing by this point and this task is where it goes green.

- [ ] Extend the fixtures, run it, confirm it fails when any one arm is removed. Commit: `test(proactive): extend the fact-renderer enumeration guard to batch B (mezo-d58h.6)`

---

### Task 12: close the FE sport-skip gap (`mezo-cq06`)

**Files:** `frontend/src/features/fuel/logic/buildProtocol.ts`, `frontend/src/data/today/todayHooks.ts`, `frontend/src/features/today/logic/useDayOrbFill.ts`, `frontend/src/data/ritual/recapHooks.ts`, `frontend/src/data/fuel/fuelWeekHooks.ts`, plus their tests

Five date-specific FE read paths filter sport sessions by weekday/`today` and ignore `sport_slot_skip`, while the backend honours it — so the fuel day-type says "not a training day" while the fuel protocol still renders the sport block. `weekAgenda.ts` is the pattern: it takes a `skips` param and filters on `(day, time, date)`; the query key is `sportSlotSkipsQueryKey()` in `data/train/trainHooks.ts`.

- [ ] Failing tests first (one per site), then the filters, then both FE modes + build. Commit: `fix(fuel,today): honour sport-slot skips in the remaining date-specific FE reads (mezo-cq06)`

---

### Task 13: docs + CODEMAP + the full gate

Update `docs/features/companion.md` (the six detections, their honesty gates, the five-mirror rule, and the `all_healthy` suppression decision) and `docs/features/proactive.md` (the two new action offers). **Edit the wrong sections; do not append a changelog.** Bump both frontmatter `updated:` fields. THEN `node scripts/gen-codemap.mjs` and `--check` (that order — a frontmatter bump drifts the map).

Full gate: the whole backend suite with `-Dmezo.test.use-testcontainers=true` and Maven's own exit code; `node scripts/lint-liquibase.mjs`; both FE modes; `pnpm build`.

- [ ] Commit: `docs(companion,proactive): document batch B + regenerate the codemap (mezo-d58h.6)`

---

### Task 14: ship

Push → self-PR → CI green (`gh pr checks --watch`; "no checks reported" means CONFLICTING, so merge `origin/main` in and push) → `--no-ff` merge from a temp branch off `origin/main` (never `cd` to the primary repo) → regenerate the CODEMAP on the merge if main moved → push main → delete the branch → `bd close mezo-d58h.6`, `bd close mezo-9gp3`, `bd close mezo-cq06` → `bd dolt push`.

This is the epic's last slice: after it, also close the epic `mezo-d58h` itself, and check whether `mezo-5qek` (setup cards have no push path) is now a config-only fix worth folding in or re-filing with what S4/S5 learned.

---

## Self-review notes (for the executor)

- **Spec coverage:** §4 rows 14/2/10/16/7/8 → Tasks 4-9 in that order (which is severity order, deliberately: the highest-severity rule is written first, so if the slice is ever cut short the most urgent detection is the one that shipped). §4's "also embedded as a corroborating fact in (2)'s payload" for the weight trend → Task 5. §5's action-parameter rule (always rule-provided) → Task 10. §7's honesty gates → every rule task, each with a silence test.
- **The riskiest steps**, in order: Task 2 (six keys × five runtime-only mirrors — one miss is a per-user silent failure inside a listener's catch); Task 8 (`ignored_nudge` composes push logs, a shifted-hour metric, and a ghosting anchor — three traps in one rule); and Task 5 (`load_fuel_mismatch`'s logged-day gate cannot be computed from the load series, because its zeros are real).
- **If a step's verbatim code does not compile against the file you are editing, the FILE wins** — read it, adapt, and say so in your task report. Everything here was read from `origin/main` on 2026-09-04, after S5 merged.
