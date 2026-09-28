# Arányos progressziós lépcső Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed load increment with a proportional, real-weight step (reps-before-load when the jump exceeds 10 %, one step further on a big RIR reserve), and surface the "why" of an above-range rep target on the Eligazítás row and the workout card.

**Architecture:** The pure static `ProgressionDecider.decide` gains the available-weight set and a `StepPolicy` record (config) and picks real candidate weights; `SetRecommendationService` resolves `used` + `gaps` and passes them. FE shows `progression.rationale` only when the target reps exceed the recipe's `repMax` (the overflow case).

**Tech Stack:** Java 21 / Spring Boot (backend, JUnit 5 + Testcontainers ITs), React + TS + Vitest (frontend).

Spec: `docs/superpowers/specs/2026-09-28-proportional-progression-design.md`. Prototype: `docs/design_2.0/prototypes/elo/edzes.html` (artifact DdTK5jJ6XTBuqnPSC3fpcC, owner OK 2026-09-28).

## Global Constraints

- step-percent compound 0.025 · isolation 0.05 · default 0.05; max-jump 0.10; max-jump-reserve 0.15; reserve-slack 2; rep-overflow 3.
- `deltaKg = base − ref` for every WEIGHT/DELOAD decision; a WEIGHT decision's delta is never 0.
- `increment` map stays (gap learning threshold only).
- HU copy exactly as spec §3.6 (decimal comma, integer percent).
- No contract change.

---

### Task 1: Decider — proportional step (backend, pure)

**Files:** Modify `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ProgressionDecider.java`; Test `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ProgressionDeciderTest.java`

**Interfaces — Produces:**
- `record StepPolicy(BigDecimal stepPercent, BigDecimal maxJump, BigDecimal maxJumpReserve, int reserveSlack, int repOverflow, BigDecimal plateStep)`
- `static Decision decide(RefSet ref, int repMin, int repMax, int targetRir, StepPolicy policy, Set<BigDecimal> used, Set<BigDecimal> gaps, boolean deloadWeek)`
- `static int equalEffortReps(BigDecimal w, int reps, Integer rir, int targetRir, BigDecimal base)`

- [ ] Rewrite `ProgressionDeciderTest` to the spec §3.8 table + cases: up fits (60×10@1 → 62.5×8, delta 2.5), Smith 50×7 → 52.5×5, rep extension (8×12 → 8×13 REP, rationale `A 10 kg +25% ugrás lenne → előbb 13 ismétlés 8 kg-mal`), forced jump (8×15 → 10×7), reserve (60×10@3 → 65×9), compound light (12.5×15 → 12.5×16), off-grid ref uses logged weight candidate, gap excluded from candidates, heavy compound 140×10 → 142.5, down fits (60×5@0 → 57.5), down build-from-below (10×7@1, repMin 10 → REP 10×8), down grind hold (slack<0 → HOLD), in-range unchanged, deload unchanged, null RIR neutral, capAtHold of the new REP → HOLD.
- [ ] Run `./mvnw -q -Dtest=ProgressionDeciderTest test` → FAIL (signature).
- [ ] Implement per spec §3.1–3.4, §3.6.
- [ ] Run → PASS. Commit `feat(train): proportional progression step in ProgressionDecider (mezo-bk7sn)`.

### Task 2: Wiring + config (backend)

**Files:** `HypertrophyProperties.java`, `application.yml` (mezo.hypertrophy), `SetRecommendationService.java:54-100`, `WorkoutService.java:289-292` comment, ITs: `HypertrophyPropertiesIT`, `SetRecommendationServiceIT`, `WorkoutTodayProgressionIT`, `WorkoutWeightGapIT`, `OverloadChallengeGeneratorIT`, test yml if any.

- [ ] Add validated fields `stepPercent` (Map), `defaultStepPercent`, `maxJump`, `maxJumpReserve`, `reserveSlack`, `repOverflow`; yml values per Global Constraints; extend `HypertrophyPropertiesIT`.
- [ ] `prescribe`: build `StepPolicy` from props by `ex.getType()`; pass `historyResolver.workingWeightsEverLogged` + `weightGapService.gaps`; keep the reactive snap (fires only for DELOAD in practice).
- [ ] Update the hard-coded +5 expectations in the ITs to the new values (recompute each from the rule, don't guess).
- [ ] Run the focused ITs with Testcontainers → PASS. Commit.

### Task 3: FE — overflow "why" line (Eligazítás row + card)

**Files:** `frontend/src/features/train/logic/progressionChip.ts` (+ test), `WorkoutBriefing.tsx`, `ActiveWorkoutPage.tsx` (~905), `WorkoutCard.tsx` (cue slot), mock `data/train/train.ts` fixtures (realistic rationale + one overflow exercise), CSS for `.wbr-row-why`.

- [ ] `export function overflowWhy(ex: { repMax: number; progression?: ProgressionSignal | null }): string | null` — rationale when `lever==='rep' && targetReps > repMax`. Unit test.
- [ ] Briefing row: `why` prop rendered under the small line. Card: `cue ?? overflowWhy(exercise)` in the t-info cue slot.
- [ ] Tests both modes, `pnpm build`. Commit.

### Task 4: Docs, prototype sync, ship

- [ ] `docs/features/train.md` §4 Set recommendation engine + §9; feature index row; milestone log entry.
- [ ] Prototype: overload line text back to production's `+rep`.
- [ ] `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`.
- [ ] Merge (--no-ff via detached HEAD), push, deploy green, verify live + prod DB read.

## Kész, ha…

- [ ] Engine gives the spec §3.8 numbers (unit tests) and ITs pass with the new values.
- [ ] Eligazítás row + workout card show the overflow sentence only on an above-range rep target; chip shows `↑ +1 ism.` / `↑ +2,5 kg`; nothing else on the screens changes (parity).
- [ ] 320 px: the why line wraps, no overflow; reduced motion unaffected (no new animation).
- [ ] Gates: backend focused tests (Decider, Snapper, SetRecommendation, TodayProgression, WeightGap, OverloadChallenge, HypertrophyProperties, ReadinessLighten); FE `CI=true` mock + `VITE_USE_MOCK=false`; `frontend/tests/layout` train specs; `pnpm build`; codemap; lint-docs 0/0.
- [ ] Docs: train.md, feature index, milestone log.
- [ ] Shipped: main merged, deploy green, production today-endpoint shows proportional targets (checked in browser), prod DB read.
- [ ] Living prototype in sync + republished.
