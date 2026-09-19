# Súly-diagnózis („Miért mozog a súlyom?") — Design

**Date:** 2026-09-19 · **Status:** approved by user · **bd:** epic `mezo-85x5r`

> Brainstormed with Daniel on 2026-09-18/19, triggered by a live +1.4 kg weekly card
> (Szep 14–20, 5 weigh-ins, Monday 84.3 → Friday 85.6). UI language: Hungarian, labels
> verbatim; this spec is English per repo convention.

## Purpose

The third diagnosis question on the `DiagnosisRecipe` seam — and the first **week-anchored**
one: explain a specific week's weight movement from everything the app logged, with the
physics done in code. The report's job is not "what changed" but **"how much of the delta is
tissue and how much is water/glycogen/content"** — and only then, ranked suspects for the
water part.

## Decisions taken (with user)

1. **Week-anchored, card-launched.** The report is about ONE week (ISO Monday anchor).
   Entry points: a „✦ Mi történt ezen a héten?" button on the weekly weight-history card
   (the stepper card the screenshot shows) with that week as anchor, AND the Diagnózis
   catalog (anchor = the running week). The catalog title goes live as
   **„Miért mozog a súlyom?"** (replacing the UPCOMING „Miért nem mozdul a súlyom?" slot —
   the moving-up week proved the question is bidirectional).
2. **All five missing nutrition metrics are built now:** `DAILY_CARBS_G`, `DAILY_FAT_G`,
   `DAILY_SUGAR_G`, `DAILY_SALT_G`, `DAILY_FIBER_G`. Carbs/fat are one-line `fuelRollup`
   extractors; sugar/salt/fiber are a new rollup over the frozen `meal_item` snapshot
   columns with the **null = unknown, never zero** discipline.
3. **A deterministic decomposition layer** (code, not LLM) renders as a „Számvetés" block
   above the suspects. The LLM narrates and ranks water-suspects only; it can neither
   invent numbers nor contradict the computed ceiling.
4. **Quota-friendly reuse:** an existing non-stale report for `(weight, anchorStart)` is
   OPENED, not regenerated — stepping through past weeks on the card never burns the daily
   quota.

## 1. Product shape

- Question: „Miért mozog a súlyom?" · phenomenon `weight` · anchored to an ISO-Monday week.
- Window = the anchor week's 7 days; baseline = the preceding 28 days.
- A running week is askable; the report carries an honest „a hét még nyitott · N mért nap"
  line. Fewer than **3 weigh-ins** in the anchor week → 409 with its own copy
  („Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.").
- Report page layout: hero (question + week range + weigh-in count) → **Számvetés card**
  (the derived rows) → verdict card (LLM prose + confidence) → ranked suspect cards with
  evidence rows and the probe→experiment CTA (unchanged machinery) → stale footer.

## 2. The decomposition layer (code — the new element vs fatigue/sleep)

Computed by a pure `WeightDecomposition` calculator (unit-tested), emitted as
`kind: 'derived'` evidence items so the schema, index discipline and FE envelope stay
untouched (`EvidenceItem.kind` widens `metric|pattern|fact` → `+ derived`):

1. **Valódi delta.** Weekly mean vs previous week's mean; the EWMA trend delta from
   `WeightTrendService` (trend is authoritative, raw is noise); the raw min→max flagged as
   noise — in the trigger week, half of the „+1.4" was a Monday low-point artifact.
2. **Szövet-plafon (energy ceiling).** Σ(logged kcal − TDEE from the goal engine's
   prescription) over the week → `surplus / 7700` = max plausible fat gain (lean ≈ 1800
   kcal/kg noted in prose). Delta beyond the ceiling is **by definition**
   water/glycogen/content. Independent check: a trend change > **1% bodyweight/week** is
   itself evidence of non-tissue movement.
3. **Cél-sáv verdikt.** (trend delta − target rate) against the active goal
   (`trajectory`, `rateTargetPctPerWeek`): cut 0.25–1 %BW/wk, bulk 0.1–0.25 %BW/wk bands.
   Same +1.4 reads „terv fölött" on a cut and „terven, enyhén gyors" on a bulk. Language
   rule (prompt-enforced): no „tartós irányváltás" call before 2–3 weeks of consistent
   trend deviation.
4. **Erő-trend.** Top lifts' e1RM in-window vs baseline via `ExerciseRecordService`
   (read-only): weight↑+strength↑ tells a glycogen/muscle story, weight↑+strength↓ a
   fatigue/water story. This is a NEW `proactive → train` edge — the plan must prove it
   cycle-free against ArchUnit; if it closes a cycle, V1 proxies with `GYM_VOLUME_KG` and
   e1RM becomes a follow-up issue.

No active goal → the goal-band row renders „nincs aktív cél — sáv nélkül", never a made-up
band. Missing TDEE inputs → the ceiling row is omitted (absent, not zeroed).

## 3. The recipe's metric list (fixed order — the index is the contract)

State first, suspects after, per the SLEEP template; the five NEW enum entries are appended
at the catalog's END (append-only ordering):

`WEIGHT_DELTA_KG`, `WEIGHT_TREND_PCT_WK` ·
`DAILY_KCAL`, `DAILY_CARBS_G`⁺, `DAILY_FAT_G`⁺, `DAILY_SUGAR_G`⁺, `DAILY_SALT_G`⁺,
`DAILY_FIBER_G`⁺, `DAILY_PROTEIN_G`, `DAILY_WATER_ML`, `LATE_MEAL_HOUR`, `MEAL_SCORE` ·
`ACWR`, `TRAINING_MONOTONY`, `GYM_VOLUME_KG`, `COMBINED_LOAD_MIN` ·
`SLEEP_DURATION_H`, `SLEEP_QUALITY`, `BEDTIME_VARIABILITY`, `CHECKIN_STRESS` ·
`MEDICATION_CYCLE_DAY`, `MEDICATION_DOSE_MG`

Suspect vocabulary the prompt names (each requiring cited evidence): CH-ugrás → glikogén
(1 g CH köt 3–4 g vizet), só-ugrás, terhelés-ugrás (ACWR — izomjavítási vízvisszatartás),
alváshiány/stressz (kortizol), késői/nagy étkezés a mérés előtt, gyógyszer-ciklus
étvágy-hatás, kreatin/supplement-váltás (protokoll-adat).

`WEIGHT_DELTA_KG` yields points only for consecutive weigh-in days (gaps never bridged), so
its coverage thins fast — the collector's coverage threshold handles it honestly; the
weigh-in-count gate (§1) is the user-facing guard.

## 4. Schema & contract

- Migration (drop+re-add ck precedent `202608311500_mezo-po3y_…`):
  `diagnosis` `+ anchor_start date null`; `ck_diagnosis_phenomenon` widens to
  `('fatigue','sleep','weight')`.
- Generate request: optional `anchorStart` (date). For `weight` it is required to be an ISO
  Monday (400 otherwise); for the other phenomena it is rejected (400) — they stay rolling.
  Response carries `anchorStart`; list rows too (the card needs to find its week's report).
- Collector generalization: `gather(userId, from, to, recipe)` — today's rolling
  `today − windowDays` becomes one caller-computed window; fatigue/sleep behavior stays
  bit-identical (pinned by regression tests).
- `EvidenceItem.kind` pattern widens to `metric|pattern|fact|derived` (contract + envelope).
- Reuse rule (service): generate for `(weight, anchorStart)` with an existing non-stale row
  → return the existing row (200-semantics via the existing find; the FE button opens it);
  regeneration stays explicit via the stale → `↻ Frissítsd` path.

## 5. Frontend

- `diagnosisCatalog.ts`: „Miért mozog a súlyom?" into `LIVE_QUESTIONS`
  (blurb: a számvetés-ígéret), the „Miért nem mozdul a súlyom?" string leaves
  `UPCOMING_QUESTIONS`.
- Weekly weight-history card (the stepper card in the screenshot — the plan pins the exact
  component next to `FuelWeekResponse.weightAvgKg`'s consumer): footer button
  „✦ Mi történt ezen a héten?" → open-or-generate for the stepped week.
- Report page: renders `derived` items as the Számvetés card above the suspects; hero sub
  = week range + weigh-in count. Everything else (probe CTA, feedback, stale) unchanged.
- Mock seed: one anchored weight diagnosis so the demo shows the full shape.

## 6. Honesty rules (contracts)

| state | rule |
|---|---|
| <3 weigh-ins in the anchor week | 409, own copy — never a thin report |
| running week | allowed + „a hét még nyitott · N mért nap" line |
| no active goal | goal-band row says so; no invented band |
| ceiling exceeded | prose MUST attribute the remainder to water/content — prompt + validation tone |
| trend vs raw | verdicts read the trend; raw extremes are labeled noise |
| <2–3 weeks deviation | no persistent-change language |
| nutrition snapshot nulls | unknown ≠ 0; coverage threshold drops the metric |

## 7. Testing

- `WeightDecomposition` unit tests: ceiling math, band classification (cut/bulk/none),
  trend-vs-raw delta, strength-trend direction, all absent-input branches.
- Recipe IT via the `[fake-diagnosis:…]` sentinel (any candidate label — single-render
  channel): anchored generate persists `anchorStart`; 409 under 3 weigh-ins; reuse rule.
- Regression: fatigue + sleep ITs unchanged through the window generalization.
- New extractor tests (5 metrics; sugar/salt/fiber null-discipline).
- ArchUnit: the new `proactive→train` / `proactive→biometrics(weight)` / `proactive→goal`
  read edges are cycle-free (or the e1RM row falls back per §2.4).
- FE dual-mode + catalog tests; contract-drift; CODEMAP regen.

## Prior art (researcher)

- **Hacker's Diet / Libra / Happy Scale** — EWMA trend as the authoritative signal; the
  scale-minus-trend residual IS the water message. Adopted as the backbone (our
  `WeightTrendService` already computes it).
  https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
- **MacroFactor weight trend** — trend consumed everywhere, raw shown pale; calm tone
  („one weird weigh-in has trivial impact"). Adopted: tone + trend-first verdicts; gap
  interpolation noted but not needed (WeightTrendService owns smoothing).
  https://help.macrofactorapp.com/en/articles/21-weight-trend
- **Stronger by Science** — encoded magnitudes: fat ≈7700 kcal/kg, lean ≈1800 kcal/kg,
  glycogen binds 3–4 g water/g CH, daily swings up to ~2–4 kg tissue-free. Adopted as the
  ceiling math + suspect vocabulary. Sodium/creatine magnitudes stay qualitative in prose
  (no hard numbers without an evidence-grade source).
  https://www.strongerbyscience.com/calories-weight/
- **MacroFactor goal adjustments + cutting calculator** — week vs that week's target (no
  catch-up), 2–3 week confirmation before acting, %BW/wk bands (cut 0.25–1, bulk
  0.1–0.25). Adopted as the goal-band verdict + language rule. Rejected: cumulative
  catch-up logic.
  https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal
  · https://macrofactor.com/cutting-calculator/

## Codebase terrain (investigator)

- Engine: `feature/proactive/service/DiagnosisRecipe.java` (FATIGUE 19 / SLEEP 16 metrics;
  `byPhenomenon` dispatch), `FatigueEvidenceCollector.java:73` (recipe-parameterised
  gather, coverage/minDomains gates), `DiagnosisGenerator.java` (ONE shared marker
  `FARADTSAG-DIAGNOZIS-FELADAT` for all phenomena — no new FakeCompanionLlm mirror needed),
  `DiagnosisService.java` (quota/409/reuse home), `DiagnosisProperties`.
- Catalog: `MetricKey.java` is at 37 entries; `WEIGHT_DELTA_KG` = prev-calendar-day delta,
  gaps unbridged (`MetricSeriesService.java:357-372`); `WEIGHT_TREND_PCT_WK` = 7d OLS.
  **No carbs/fat/sugar/salt/fiber metric exists**; `MealItemEntity.java:89-116` carries the
  frozen `snapshotFiberG/SugarG/SaltG` + NOVA per line.
- Goal context: `GoalEntity` (`trajectory`, `rateTargetPctPerWeek`),
  `GoalProjectionService` (TDEE + projected rate reconciled against the live EWMA trend),
  `WeightTrendService` (EWMA + weekly rates + `dataSufficiency`). goal-engine.md
  (2026-08-15) is STALE vs the adaptive-correction machinery — trust code over that doc.
- Strength: `ExerciseRecordService.java:96-98` (Epley e1RM series per exercise).
- Precedents: pattern pair `daily-kcal~next-morning-weight-delta` already monitored
  (`application.yml:1653`); `FuelWeekResponse.weightAvgKg` is the weekly weight-in-fuel
  join the card likely consumes.
- Traps: evidence **index is the contract** (append-only metric lists); ArchUnit
  cycle-freeze (`ArchitectureTest.java:69-77` — `biometrics↔goal`, `meal↔recipe` frozen;
  NEW cycles fail); coverage gates are real 409s; quota counts soft-deleted rows;
  CODEMAP `--check` + contract-drift gates; this session's original worktree branch is
  ~200 releases stale — the branch is cut from `origin/main` v2.286.0.

## Non-goals (YAGNI)

- No body-composition estimation (no BIA/measurement inputs exist).
- No sodium/creatine hard-coded kg numbers in the prompt (qualitative only, §Prior art).
- No backfill of reports for historical weeks (any week remains askable on demand).
- No new chart on the report (the weekly card already owns the sparkline).
- No digestive/bowel tracking (no data), no alcohol as a separate signal (kcal carries it).
- No changes to fatigue/sleep recipes beyond the window-generalization refactor.

## Sequencing (plan will slice)

1. Five nutrition extractors + tests (standalone value for patterns/tools too).
2. Collector window generalization + anchored schema/contract + WEIGHT recipe +
   decomposition + generator prompt.
3. FE: catalog + weekly-card button + Számvetés block + mock/dual-mode tests.
