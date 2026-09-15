# Train Titanium T2 — One Home for Epley (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** one home for the e1RM formula and its eligibility rules — five duplicated Epley
implementations delegate to a Spring-free `OneRepMax`, the goal engine stops counting warmup
sets, and the rep cap becomes one named constant (= 12) everywhere.

**Architecture:** new pure static class `feature/train/service/OneRepMax` (estimate → null,
never zero/throw; `eligible(ExerciseSetEntity)`; `REP_CAP = 12`). Call sites delegate:
`ExerciseRecordService`, `MedalEvaluator`, `GymSignalCalculator`, `GuardEvaluationService`
(which also switches to the working-set repository method), `MesocycleReportService` (formula
only — its weightless-ranks-below rule stays local). Two stale doc lines corrected.

**Tech stack:** plain JUnit table test for the decider; focused Testcontainers ITs; ArchUnit.

**Driving artifacts:** openGym-audit handoff §A2, bd `mezo-88iwa.3`,
branch `feat/train-a2-onerepmax`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints. Verbatim from the
handoff: `REP_CAP` **= 12** is a decided product call — do not re-litigate, do not leave a
second cap anywhere; a `null` estimate propagates as an omitted field, never as `0`; the
`GuardEvaluationService` repository switch **changes existing users' strength-guard numbers on
purpose** (the old ones were wrong) — say so in the PR body; `goal → train` is a pre-existing
package edge (GuardEvaluationService already injects `ExerciseSetRepository`), so the delegate
adds no new slice edge — `ArchitectureTest` must stay green to prove it.

Verified anchors (2026-09-15): `ExerciseRecordService.java:42` (THIRTY) + `:156` (formula) +
repo filter `findByCreatedByAndRepsNotNullAndKind(createdBy, "working")`;
`MedalEvaluator.java:22` + `:83`; `GymSignalCalculator.java:27` + `:90-92`;
`GuardEvaluationService.java:63` (`MAX_E1RM_REPS = 10`) + `:68` (THIRTY) + `:99-100`
(unfiltered `findByCreatedByAndRepsNotNull` + local eligibility) + `:174` (divide);
`MesocycleReportService.java:84` (THIRTY) + `:336-346` (TopSet/e1rm + weightless-below rule);
`ExerciseSetRepository.java:29` (unfiltered) and `:53` (working-kind method).

---

### Task 1: `OneRepMax` decider + table test

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/OneRepMax.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/OneRepMaxTest.java`

**Interfaces:**
- Produces:
  `public final class OneRepMax { public static final int REP_CAP = 12; public static BigDecimal estimate(BigDecimal weightKg, Integer reps); public static boolean eligible(ExerciseSetEntity set); }`
  — estimate: Epley `weight × (30 + reps) / 30`, scale 4 HALF_UP; returns **null** for
  null/non-positive weight, null/`< 1` reps, or `reps > REP_CAP`. eligible:
  `"working".equals(set.getKind()) && !set.isSkipped() && set.getWeightKg() != null && set.getWeightKg().signum() > 0 && set.getReps() != null && set.getReps() >= 1 && set.getReps() <= REP_CAP`
  (check the entity's actual skipped accessor name — grep `skipped` in `ExerciseSetEntity`;
  if the entity has no skipped flag, drop that clause and note it in the report).

- [ ] **Step 1: Write the failing table test** — plain JUnit, no Spring:

```java
class OneRepMaxTest {

    @Test
    void repCapIsTwelve_byProductDecision() {
        assertThat(OneRepMax.REP_CAP).isEqualTo(12);
    }

    @Test
    void estimatesInsideTheCap_andRefusesAboveIt() {
        assertThat(OneRepMax.estimate(new BigDecimal("100"), 12))
            .isEqualByComparingTo(new BigDecimal("140.0000")); // 100 × 42/30
        assertThat(OneRepMax.estimate(new BigDecimal("100"), 13)).isNull();
    }

    @Test
    void nullNeverZeroNeverThrows() {
        assertThat(OneRepMax.estimate(null, 5)).isNull();
        assertThat(OneRepMax.estimate(BigDecimal.ZERO, 5)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("-10"), 5)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("60"), null)).isNull();
        assertThat(OneRepMax.estimate(new BigDecimal("60"), 0)).isNull();
    }

    @Test
    void matchesTheHistoricFormulaAtScaleFour() {
        assertThat(OneRepMax.estimate(new BigDecimal("62.5"), 8))
            .isEqualByComparingTo(new BigDecimal("79.1667")); // 62.5 × 38/30, HALF_UP
    }
}
```

Add `eligible(...)` cases with entity fixtures following the file idiom of an existing plain
train unit test (e.g. `MedalEvaluatorTest` if it exists — copy its entity-building helper):
working+weighted+reps 12 → true; warmup kind → false; reps 13 → false; null weight → false.

- [ ] **Step 2:** Run `./mvnw -q test -Dtest='OneRepMaxTest' -Dmezo.test.use-testcontainers=true`
— FAIL (class missing). **Step 3:** Implement per the interface block (private constructor,
`BigDecimal THIRTY` internal). **Step 4:** rerun — PASS. **Step 5:** Commit
`feat(train): OneRepMax — one home for Epley and its eligibility (mezo-88iwa.3)`.

### Task 2: The five call sites delegate

**Files:**
- Modify: `ExerciseRecordService.java` (:42 delete THIRTY, :156-160 delegate; keep its
  working-kind repo filter), `MedalEvaluator.java` (:22, :83-85), `GymSignalCalculator.java`
  (:27, :90-92), `MesocycleReportService.java` (:84, its e1rm helper delegates for the
  FORMULA; the weightless-ranks-below comparator at :340-346 stays exactly as is),
  `GuardEvaluationService.java` (:63 delete `MAX_E1RM_REPS`, :68 delete THIRTY, :99-100 switch
  to `exerciseSetRepository.findByCreatedByAndRepsNotNullAndKind(userId, "working")` and
  filter with `OneRepMax.eligible`, :174 delegate to `OneRepMax.estimate`).
- Test: extend the existing goal-engine IT that covers the strength guard (grep
  `strength` under `backend/src/test/.../goal/engine`) with: a warmup set carrying an absurd
  load (e.g. 300 kg × 1, kind "warmup") must NOT move the strength trend.

**Interfaces:** consumes Task 1's `OneRepMax` exactly as declared there.

- [ ] **Step 1:** Delegate all five sites. No site keeps a `THIRTY`, a local divide, or a
local cap. Where a site's old inline math produced a value for reps 11–12 that the old
GuardEvaluationService cap (10) refused, that widening is intended.
- [ ] **Step 2:** Write the warmup-immunity IT case per the brief above, following the host
IT's existing seeding idiom.
- [ ] **Step 3:** Grep-check: `grep -rn '"30"\|valueOf(30' backend/src/main/java/io/mrkuhne/mezo/feature/{train,goal}` returns only `OneRepMax.java` (and unrelated non-Epley hits, if
any, listed in the report with one-line justification each).
- [ ] **Step 4:** Run
`./mvnw -q test -Dtest='OneRepMaxTest,ExerciseRecordServiceIT,GymSignal*,Guard*,MesocycleClose*,Medal*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
(adjust to the actual IT class names found; @Nested-bearing classes run unfiltered). Expect PASS.
- [ ] **Step 5:** Commit `refactor(train,goal): five Epley sites delegate to OneRepMax; the goal guard stops counting warmups (mezo-88iwa.3)`.

### Task 3: Docs + ship

- [ ] **Step 1:** Fix `docs/features/train.md:630`-area (grep `warmups are excluded` or
similar) — the claim that warmups are excluded from every real-work reader is TRUE again;
reword to name `OneRepMax.eligible` as the single gate. Fix `docs/features/goal-engine.md:75`
(grep `ExerciseRecordService aggregation idiom`) — it now genuinely reuses the working-set
filter via `OneRepMax`. Update `MesocycleReportService`'s doc mention if it names the inline
Epley.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs --check` (regen if needed).
- [ ] **Step 3:** Commit docs; push `feat/train-a2-onerepmax`; self-PR whose body carries,
verbatim: "The GuardEvaluationService repository switch and the cap change (10 → 12) both
move existing users' strength-guard numbers — deliberately: warmup sets no longer count as
potential bests, and reps 11–12 now do."; CI green → premerge → `--no-ff` merge via detached
temp worktree; close `mezo-88iwa.3`.

## Self-review notes

- Handoff §A2 coverage: single home + cap constant + null-not-zero (Task 1); five delegations
  incl. the report service formula-only rule and the guard's repo switch (Task 2); both stale
  doc lines (Task 3); the grep-style no-other-Epley check (Task 2 Step 3); cap-boundary test
  12-yes/13-no explicit (Task 1). The e1RM series endpoint is NOT this slice (T13).
- Type consistency: `estimate(BigDecimal, Integer) → BigDecimal|null` used identically at all
  five sites; `eligible(ExerciseSetEntity)` only where an entity is in hand (the guard).
