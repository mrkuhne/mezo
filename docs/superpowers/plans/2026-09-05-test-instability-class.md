# Test-Instability Class Elimination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining five open issues of the time/load test-instability class (mezo-7qpy, mezo-8h2s, mezo-oou9, mezo-0121, mezo-lld8) as four independent slices + a closing audit, each with a recorded fails-with-bug / passes-without proof.

**Architecture:** Four independent slices, each cut from fresh `origin/main` in its own worktree, one branch, one self-PR (CI is the gate; the PR stays open — the user merges). Spec: `docs/superpowers/specs/2026-09-05-test-instability-class-design.md`.

**Tech Stack:** Backend: Java 21 / Spring Boot 4 / JUnit 5 / AssertJ / Testcontainers PG. Frontend: vitest / @testing-library.

## Global Constraints

- NEVER `cd` into the primary repo; each slice gets its own worktree from fresh `origin/main`.
- Focused backend tests ALWAYS with `-Dmezo.test.use-testcontainers=true`; run `ArchitectureTest` separately; ALWAYS `clean`.
- FE tests ALWAYS in both modes explicitly: `VITE_USE_MOCK=false pnpm test` AND `VITE_USE_MOCK=true pnpm test` (bare `pnpm test` in a worktree = mock twice, real gate vacuous).
- New/moved files → regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change; behavior change → update the matching `docs/features/*.md` + `node scripts/lint-docs.mjs`.
- Conventional commit subjects carry the driving bd id, e.g. `fix(test): ... (mezo-7qpy)`.
- Every flake fix needs a RECORDED reproduction: the failure demonstrated with the bug present, green with the fix, day-part simulation where wall-clock is involved. Record the evidence as a bd comment on the driving issue + in the PR body.
- Merge is NOT part of any slice: bring CI to green, leave the PR open.

---

## Slice S1 — mezo-7qpy: LlmCallListIT day-anchored seeding (branch `fix/llmlist-midnight-anchor`)

Root cause: rows seeded at `Instant.now().minus(i, MINUTES)` while `period=DAY` starts at `LocalDate.now(reportZone).atStartOfDay` (`UsagePeriod.java:26-33`, zone = `mezo.llmlog.report-zone` = Europe/Budapest, `application.yml:479`). Repository filters are `createdAt >= :since` with NO upper bound (`LlmLogRepository.java:120`), so same-day timestamps "in the future of now" are fine — a start-of-day anchor is always inside the window.

### Task S1.1: Reproduce deterministically, then fix the seeding

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallListIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmCallListMidnightIT.java`

**Interfaces:**
- Consumes: `LlmLogPopulator.logCall(Instant, UUID, CallKind, CallStatus, String feature, String op, String model, BigDecimal cost)`; `LlmLogProperties.reportZone()` (`io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties`).
- Produces: nothing consumed by later slices.

- [ ] **Step 1: Write the failing (with-bug) proof — the midnight-simulation IT**

Create `LlmCallListMidnightIT` that FORCES "just past local midnight" via a dynamically computed report zone, and runs the same window assertion. With the current now-minus-minutes seeding this test MUST fail (rows fall into "yesterday"); it becomes the permanent regression guard once the seeding is fixed.

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Midnight simulation for the period=DAY window (mezo-7qpy): the report zone is computed at
 * startup so that "now" in that zone is ALWAYS 00:00-00:30 — every run exercises the
 * day-boundary that previously only bit CI runs in the first minutes after Europe/Budapest
 * midnight. Seeding anchored anywhere but the current local day fails here deterministically.
 */
class LlmCallListMidnightIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;

    /** An offset zone in which the current wall time is a few minutes past midnight. */
    @DynamicPropertySource
    static void justPastMidnightZone(DynamicPropertyRegistry registry) {
        registry.add("mezo.llmlog.report-zone", () -> {
            LocalTime utcNow = LocalTime.now(ZoneOffset.UTC);
            // offset that maps "now" to ~00:05 local; ZoneOffset supports ±18h so this always resolves
            int targetSeconds = 5 * 60;
            int offsetSeconds = targetSeconds - utcNow.toSecondOfDay();
            if (offsetSeconds < -18 * 3600) {
                offsetSeconds += 24 * 3600;
            }
            return ZoneOffset.ofTotalSeconds(offsetSeconds).getId();
        });
    }

    @Test
    void testListCalls_shouldSeeAllTwelveRows_whenLocalClockIsJustPastMidnight() {
        UUID owner = ownerId();
        Instant dayAnchor = LocalDate.now(llmLogProperties.reportZone())
            .atStartOfDay(llmLogProperties.reportZone()).toInstant();
        for (int i = 0; i < 12; i++) {
            llmLogPopulator.logCall(dayAnchor.plus(i, ChronoUnit.SECONDS), owner,
                CallKind.CHAT, CallStatus.SUCCESS, "companion_chat", "send", "gemini-2.5-flash", null);
        }

        LlmCallListResponse full = getForBody("/api/llm-usage/calls?period=DAY&limit=20",
            ownerAuthHeaders(), HttpStatus.OK, LlmCallListResponse.class);

        assertThat(full.getItems()).hasSize(12);
        assertThat(full.getHasMore()).isFalse();
    }
}
```

NOTE: check how `LlmCallListIT.list(...)` is implemented (bottom of that file) and reuse the same helper style if `getForBody` signature differs — copy the exact call shape from `LlmCallListIT`.

- [ ] **Step 2: Prove the OLD seeding fails under the midnight zone**

Temporarily change the new test's seeding to the old pattern (`Instant.now().minus(i, ChronoUnit.MINUTES)`), run:

```bash
cd backend && ./mvnw clean test -Dtest=LlmCallListMidnightIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL with `Expected size: 12 but was: <7-11>` (rows older than ~5 minutes fell into local "yesterday"). Capture the output. Revert to the day-anchored seeding; re-run; expected: PASS. This is the fails-with-bug / passes-without evidence — record both outputs.

- [ ] **Step 3: Fix the flaky test (and siblings) in `LlmCallListIT`**

Add to `LlmCallListIT`:

```java
@Autowired private io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties llmLogProperties;

/** Second {@code i} of the current report-zone day — always inside the period=DAY window (mezo-7qpy). */
private Instant todayAt(int i) {
    var zone = llmLogProperties.reportZone();
    return java.time.LocalDate.now(zone).atStartOfDay(zone).toInstant().plusSeconds(i);
}
```

Replace every `Instant.now()`-relative seed in the file with `todayAt(...)`, preserving relative order (larger argument = newer):
- `testListCalls_shouldFlagMoreRows_whenWindowSmallerThanThePeriod` (line ~156): `todayAt(i)` for the 12 rows.
- `testListCalls_shouldReturnNewestFirst_whenSeveralCallsLogged` (lines ~41-45): meal_coach at `todayAt(60)`, companion_chat at `todayAt(180)` (keeps companion_chat newest).
- `testListCalls_shouldKeepCostNull_whenRowIsUnpriced` (~line 77): `todayAt(120)` / `todayAt(60)`.
- `testListCalls_shouldIncludeOwnerlessRows_whenLoggedByBackgroundJob` (~line 100): `todayAt(120)` / `todayAt(60)` (keeps proactive_briefing newest).
- Plain `Instant.now()` seeds with no ordering/window sensitivity (payload-omission, filters) may switch to `todayAt(0)` for uniformity.
- `testListCalls_shouldExcludeOlderRows_whenLoggedBeforeThePeriodStart` (40 days ago) stays as is.

Add one boundary regression test:

```java
/** The DAY window's lower edge: start-of-day is IN, one second before it is OUT (mezo-7qpy). */
@Test
void testListCalls_shouldCutAtLocalDayStart_whenRowStraddlesTheBoundary() {
    UUID owner = ownerId();
    llmLogPopulator.logCall(todayAt(0), owner, CallKind.CHAT, CallStatus.SUCCESS,
        "companion_chat", "send", "gemini-2.5-flash", null);
    llmLogPopulator.logCall(todayAt(0).minusSeconds(1), owner, CallKind.CHAT, CallStatus.SUCCESS,
        "meal_coach", "verdict", "gemini-2.5-flash", null);

    assertThat(list("period=DAY").getItems())
        .singleElement()
        .satisfies(i -> assertThat(i.getFeature()).isEqualTo("companion_chat"));
}
```

- [ ] **Step 4: Run the focused gates**

```bash
cd backend && ./mvnw clean test -Dtest='LlmCallListIT,LlmCallListMidnightIT' -Dmezo.test.use-testcontainers=true
cd backend && ./mvnw clean test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

Expected: all green.

- [ ] **Step 5: CODEMAP + commit**

```bash
node scripts/gen-codemap.mjs && git add -A
git commit -m "fix(test): anchor LlmCallListIT seeds to the report-zone day start (mezo-7qpy)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Doc note: test-only change, no feature-doc touch needed (no behavior/contract change).

- [ ] **Step 6: Push, self-PR, CI green; bd**

Push branch, `gh pr create` (self-PR; body: root cause, the recorded fails-with-bug/passes-without outputs, day-part note: the midnight IT simulates 00:05 EVERY run, the plain IT covers the daytime path). Wait for CI green (`gh pr checks --watch`). Leave the PR open. `bd update mezo-7qpy` with the evidence comment; do NOT close until the user merges — add comment "fix on PR #N, CI green, awaiting merge".

---

## Slice S2 — mezo-8h2s: medication cycle-day zone unification (branch `fix/medication-cycle-zone`)

Root cause: two callers derive "today" in DIFFERENT zones — `MedicationService.getDay` uses `LocalDate.now(ZoneOffset.UTC)` (`MedicationService.java:62`), `MedicationTools.renderCycle` uses `LocalDate.now()` system default (`MedicationTools.java:73`) — and the test seeds with a third (`LocalDate.now()` default zone, `CompanionToolsRenderIT.java:1025,1056`). Between UTC and local midnights the derived cycle day drifts ±1. This is a prod code-vs-code inconsistency, not just a test bug.

### Task S2.1: Unify "today" in MedicationCycleService; pin the tests to the same reference

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/MedicationCycleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/MedicationService.java:62`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MedicationTools.java:73`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java:1022-1035,1054-1067`
- Modify: the medication feature doc (locate via `docs/CODEMAP.md`; likely `docs/features/fuel.md` medication section)

**Interfaces:**
- Produces: `MedicationCycleService.MEDICATION_ZONE` (`public static final ZoneId`, `Europe/Budapest`) and `MedicationCycleService.deriveToday(UUID userId, MedicationEntity med)` → `MedicationCycle`.
- Consumes: existing `derive(UUID, MedicationEntity, LocalDate)`.

- [ ] **Step 1: Reproduce the drift with the CURRENT code**

The seed side reads the JVM default zone; the render side (scope=all → `MedicationService.getDay`) reads UTC. Force them apart by picking a JVM zone whose date differs from UTC's *right now* (ahead if UTC time-of-day > 10:00, behind otherwise):

```bash
# pick TZ=Pacific/Kiritimati (UTC+14) when the current UTC time is AFTER 10:00,
# TZ=Etc/GMT+12 (UTC-12) when it is BEFORE 12:00 — either way local date != UTC date
cd backend && ./mvnw clean test -Dtest='CompanionToolsRenderIT#testGetMedication_shouldRenderGeneralOverview_whenScopeAll' \
  -Dmezo.test.use-testcontainers=true -DargLine='-Duser.timezone=Pacific/Kiritimati'
```

Expected: FAIL — `ciklus: 3. nap` (or `5. nap`) instead of the asserted `4. nap`. This reproduces exactly the S6 gate incident (2026-09-05 just past midnight). Capture the output. NOTE: if `-DargLine` clashes with surefire config, set `<argLine>` via `-Dsurefire.argLine` or check `pom.xml` for the existing argLine wiring and append.

- [ ] **Step 2: Implement the unification**

In `MedicationCycleService` add (with the class javadoc gaining one paragraph):

```java
/**
 * The zone in which the medication "today" is derived. One zone for EVERY caller (service,
 * companion tool) — mezo-8h2s was a UTC-vs-default-zone split that shifted the rendered cycle
 * day by one between the two midnights. Owner-local like TrainingStreakCalculator.TZ; if
 * per-user timezones ever become real (AppUserEntity.timezone), both move together.
 */
public static final ZoneId MEDICATION_ZONE = ZoneId.of("Europe/Budapest");

/** The cycle derived for today in {@link #MEDICATION_ZONE} — the only "today" callers may use. */
public MedicationCycle deriveToday(UUID userId, MedicationEntity med) {
    return derive(userId, med, LocalDate.now(MEDICATION_ZONE));
}
```

- `MedicationService.getDay`: replace `cycleService.derive(userId, med, LocalDate.now(ZoneOffset.UTC))` with `cycleService.deriveToday(userId, med)` (drop the now-unused `ZoneOffset` import if nothing else uses it).
- `MedicationTools.renderCycle`: replace `LocalDate.now()` + `derive(userId, med, today)` with `deriveToday(userId, med)`.

- [ ] **Step 3: Pin the two tests to the same reference**

In `CompanionToolsRenderIT` both medication dose seeds become:

```java
LocalDate seedDay = LocalDate.now(MedicationCycleService.MEDICATION_ZONE).minusDays(3);
medicationDosePopulator.createDose(owner, med.getId(), seedDay, new BigDecimal("4"));
```

and every `LocalDate.now()` inside the assertions of those two tests becomes `seedDay.plusDays(3)`-free — i.e. use `seedDay` directly: `contains("utolsó dózis: " + seedDay + " (4 mg)")`, `contains("következő esedékes: " + seedDay.plusDays(7))`, `contains("Utolsó dózisok: " + seedDay + ": 4 mg")`. The `"4. nap"` literals stay — they are now deterministic (seed and render share one zone; the only residual race is a midnight flip between the seed statement and the render call, microseconds wide — acceptable, note it in a one-line comment).

- [ ] **Step 4: Re-run the Step 1 proof — now expected green**

Run the exact Step 1 command(s) again with the SAME hostile `user.timezone` values (`Pacific/Kiritimati`, `Etc/GMT+12`, and no override = three simulated day-parts). Expected: PASS in all three. Capture outputs.

- [ ] **Step 5: Focused gates + docs**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionToolsRenderIT,MedicationServiceIT*,Medication*IT' -Dmezo.test.use-testcontainers=true
cd backend && ./mvnw clean test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

(Adjust the `-Dtest` list to the actual medication IT class names found via CODEMAP.) Update the medication feature doc's behavior note (cycle "today" zone) + `node scripts/lint-docs.mjs`.

- [ ] **Step 6: Commit, push, self-PR, CI green; bd**

```bash
git add -A && git commit -m "fix(medication): one zone for the cycle 'today' across service and tool (mezo-8h2s)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Self-PR with the three-zone proof matrix in the body; CI green; leave open; bd comment on mezo-8h2s with evidence.

---

## Slice S3 — mezo-oou9: ResetDatabase vs async work (branch `fix/reset-db-async-drain`)

Root cause: `ResetDatabase.resetExceptMasterData()` runs one `TRUNCATE ... CASCADE` (`ResetDatabase.java:39-49`) while async AFTER_COMMIT work from the PREVIOUS test can still hold read transactions. The existing `drainAsyncWork()` (`AbstractIntegrationTest.java:125-150`) is bounded at 2000 ms and silently proceeds when the executor is still busy — exactly then the TRUNCATE deadlocks. Seven `@Async` AFTER_COMMIT listeners exist under `feature/companion` (embedding writers + `GraphPromotionListener` which may run an LLM call); the test profile currently disables only two cron jobs (`backend/src/test/resources/application.properties:23-37`).

### Task S3.1: Make the drain honest (longer, and LOUD on failure)

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java:125-150`

- [ ] **Step 1: Reproduce the race (throwaway, recorded, NOT committed)**

In a scratch IT extending `AbstractIntegrationTest`, submit a slow task onto the `applicationTaskExecutor` that opens a read transaction on a domain table and sleeps 5 s (use `TransactionTemplate` + `SELECT count(*) FROM pattern` via `EntityManager`), then let the NEXT test method's `@BeforeEach` reset run. With the current 2 s cap the drain gives up and the TRUNCATE blocks/deadlocks (or waits on the lock until the reader commits — observe `PessimisticLockException` or a multi-second stall). Record the behavior/output, then delete the scratch test.

- [ ] **Step 2: Harden `drainAsyncWork`**

Replace the method body:

```java
/**
 * V1.2 → mezo-oou9: committed writes trigger AFTER_COMMIT {@code @Async} work (fact extraction,
 * embedding/graph writers). A leftover async task must not race the next test's TRUNCATE —
 * PR #306 hit a real 'deadlock detected' when a reader outlived the old silent 2 s cap. The
 * drain now waits up to 30 s and FAILS the test loudly instead of proceeding into a likely
 * deadlock: a deterministic failure naming the cause beats a flaky PessimisticLockException.
 */
private void drainAsyncWork() {
    if (applicationTaskExecutor == null) {
        return;
    }
    long deadline = System.currentTimeMillis() + 30_000;
    while (applicationTaskExecutor.getActiveCount() > 0
            || !applicationTaskExecutor.getThreadPoolExecutor().getQueue().isEmpty()) {
        if (System.currentTimeMillis() > deadline) {
            throw new IllegalStateException(
                "Async work did not drain within 30s before DB reset (active="
                    + applicationTaskExecutor.getActiveCount() + ", queued="
                    + applicationTaskExecutor.getThreadPoolExecutor().getQueue().size()
                    + ") — a hung AFTER_COMMIT listener would deadlock the TRUNCATE (mezo-oou9)");
        }
        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
    }
}
```

- [ ] **Step 3: Verify every `@Async` rides the drained executor**

`grep -rn "@Async" backend/src/main/java` — every occurrence must be bare `@Async` (default executor) or name `applicationTaskExecutor`. If a listener names a DIFFERENT executor, add that executor to the drain the same way (autowire `required = false`, drain both). Record the survey result in the PR body.

- [ ] **Step 4: Disable the remaining crons in the test profile**

Enumerate scheduled jobs: `grep -rn "@Scheduled\|cron" backend/src/main/java --include='*.java' | grep -v test` and cross-check `mezo.techcore.cron.*` keys in `application.yml`. For every job NOT yet disabled in `backend/src/test/resources/application.properties`, add a kill-switch line following the exact house pattern at lines 23-37 (property + one-line incident comment referencing mezo-oou9: a mid-suite tick holds locks against ResetDatabase's TRUNCATE). If a job has no `mezo.techcore.cron.<name>.enabled` switch, add the switch to the job per `configuration_conventions.md` (`@ConditionalOnProperty` + `FeaturesConfiguration` constant) — in this same slice, since the test profile needs it.

- [ ] **Step 5: Re-run the Step 1 reproduction against the hardened drain**

Re-create the scratch slow-listener test: with the 30 s honest drain the reset now WAITS for the 5 s reader and proceeds cleanly (no deadlock, no exception). Record; delete the scratch test again.

- [ ] **Step 6: Focused gates**

The classes that died in the PR #306 incident + the listener-heavy ones:

```bash
cd backend && ./mvnw clean test -Dtest='CharacterObservationServiceIT,CharacterConferenceJobIT,ActivityLogEntityIT,PatternDetectionServiceIT' -Dmezo.test.use-testcontainers=true
cd backend && ./mvnw clean test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 7: Commit, push, self-PR, CI green; bd**

```bash
git add -A && git commit -m "fix(test-infra): honest 30s async drain before DB reset + full cron kill-switch list (mezo-oou9)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Test-infra change → update `docs/references/integration_test_framework.md` if it documents the drain; CI green; PR stays open; bd comment with both recorded runs.

---

## Slice S4 — mezo-0121 + mezo-lld8: FE load-timeout policy (branch `fix/fe-timeout-policy`)

Root cause (measured, see mezo-0121's consolidated comment): condition-based waits with TWO too-low ceilings under full-suite CPU contention — vitest's default 5 s per-test timeout (no `testTimeout` in `frontend/vite.config.ts:69-76`) and testing-library's default 1 s `waitFor`/`findBy` ceiling (`asyncUtilTimeout`) — in a 99-test file full of multi-click `userEvent` chains (`completeExerciseSets`, `ActiveWorkoutPage.test.tsx:48-58`). Evidence this is the "machine really is slow" case, not a wait-shape bug: file passes 99/99 isolated in 25-33 s; under the full suite it takes 68-93 s; failing subset varies run to run; `--testTimeout=20000` already measured to drop 3 failures → 1 (the residual being the 1 s findBy ceiling: "Unable to find an element: Szett kész ✓").

### Task S4.1: Config-level ceilings + stress-proof

**Files:**
- Modify: `frontend/vite.config.ts:69-76`
- Modify: `frontend/src/test/setup.ts`

- [ ] **Step 1: Record the BEFORE evidence under controlled load**

In the slice worktree's `frontend/`:

```bash
# stress: saturate ~half the cores for the duration of the run (adjust N to ~50% of cores)
for i in $(seq 1 8); do yes > /dev/null & done
VITE_USE_MOCK=false pnpm test 2>&1 | tail -30
VITE_USE_MOCK=true  pnpm test 2>&1 | tail -30
kill %1 %2 %3 %4 %5 %6 %7 %8
```

Expected: ActiveWorkoutPage.test.tsx (and possibly dualMode.guard / FuelSettingsPage) failures at ~5000 ms. If one pass doesn't reproduce, repeat up to 3×; record the failing output verbatim.

- [ ] **Step 2: Raise the two ceilings, config-level only**

`frontend/vite.config.ts` test block gains two lines:

```ts
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, 'tests/**'],
    // Load-flake policy (mezo-0121): every wait in the suite is condition-based (waitFor/findBy),
    // so a slow ceiling only ever costs time on a genuinely broken test. Under full-suite CPU
    // contention the heavy files run 3x their isolated time; 5s pops spuriously (measured:
    // 20s drops 3 fails to 1, the last one being testing-library's own 1s ceiling — see setup.ts).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
```

`frontend/src/test/setup.ts` (top, with the other imports):

```ts
import { configure } from '@testing-library/react'

// The other half of the mezo-0121 load-flake policy (see vite.config.ts): findBy*/waitFor
// default to 1s, which under whole-suite contention is the "Unable to find an element"
// flake. 5s changes nothing on green runs — waits resolve as soon as the condition holds.
configure({ asyncUtilTimeout: 5_000 })
```

(If `@testing-library/react` does not re-export `configure` in the installed version, import from `@testing-library/dom`.)

- [ ] **Step 3: Sanity-check that per-test overrides still win**

`ActiveWorkoutPage.test.tsx:1237-1268` carries an explicit `20_000` on the hard-reload test — now redundant but harmless; leave it (its inline comment documents the incident). Confirm no test sets a SHORTER explicit timeout that the new defaults would mask — `grep -rn "timeout:" frontend/src --include='*.test.*' | grep -v 20_000 | head -30` and eyeball: explicit timeouts on waitFor (3000 in MesoCloseSheet etc.) are unaffected by testTimeout and stay.

- [ ] **Step 4: AFTER evidence — same stress protocol**

Re-run Step 1's exact protocol (same core count, both modes, 3 full runs each). Expected: 0 failures. Then the unloaded gates:

```bash
VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

Record before/after outputs.

- [ ] **Step 5: Commit, push, self-PR, CI green; bd**

```bash
git add frontend/vite.config.ts frontend/src/test/setup.ts
git commit -m "fix(test): config-level load-flake ceilings — vitest 20s, testing-library 5s (mezo-0121)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

PR body: the measurement history (isolated vs full-suite timings, the 20s→3→1 measurement, why config-level raise is the correct shape per the spec §5) + before/after stress outputs. CI green; leave open. bd comments on mezo-0121 AND mezo-lld8 (the 20 s testTimeout covers the guard's tree-walk budget; verify by including `dualMode.guard.test.ts` in a stressed run — if it STILL flakes, cheapen the walk by hoisting `walk(SRC_DIR)`'s result: it already runs once at module scope (`dualMode.guard.test.ts:48`), so the budget is parse+regex per test — report the measurement either way).

Doc: test-infra policy → add two sentences to `docs/references/frontend_conventions.md` testing section (config-level ceilings; per-test raises remain a smell) if that file has a testing section; `node scripts/lint-docs.mjs`.

---

## Slice S5 — closing audit + report (no new branch unless findings require it)

- [ ] **Step 1: Repo-wide audit for issue-less members of the class**

Backend: `grep -rn "Instant.now()\|LocalDate.now()\|LocalDateTime.now()" backend/src/test/java --include='*.java'` — flag only tests that (a) assert a COUNT/WINDOW/derived-day over the seeded times (the LlmCallList pattern) or (b) hardcode a derived value from a now-relative seed (the medication pattern). Echo-back asserts (seed a date, assert the same date rendered) are safe — do not flag those.
Frontend: `grep -rLn "setSystemTime\|MOCK_NOW" $(grep -rln "new Date()\|Date.now()" frontend/src --include='*.test.*')` — flag test files reading the wall clock without pinning it; also any test file with waitFor budgets tighter than the work they await.
Also check: `backend/src/test` for other exact-Instant-equality asserts across a DB round trip without `truncatedTo` where the LEFT side is an in-memory instant.

- [ ] **Step 2: File bd issues for every real finding**

One issue per root cause (not per test), each with path:line anchors and the class label, linked to this series' spec.

- [ ] **Step 3: Push the docs branch of this session**

This worktree's branch carries the spec + this plan (+ any audit doc updates): push, docs-only self-PR, CI green, leave open.

- [ ] **Step 4: Final report to the user**

The report the user asked for: how many of the 22 were duplicates (10) and already-fixed (5), the root-cause groups, which PR shipped which slice, what was deliberately NOT fixed (mezo-448k, mezo-htzy — with the spec §2 reasoning), and the audit's findings/new issues.

---

## Self-review notes

- Spec coverage: S1↔spec §4.1, S2↔§4.2, S3↔§4.3, S4↔§4.4 (+lld8), S5↔§4.5. Groups (d)/(e) closed during dedup — no tasks, matching spec §3.
- Proof protocol (spec §6) is embedded per slice: S1 midnight-zone IT (committed, simulates 00:05 every run), S2 three-timezone matrix, S3 slow-listener reproduction, S4 stress before/after.
- Type consistency: `todayAt(int)` only in S1; `MEDICATION_ZONE`/`deriveToday` only in S2; no cross-slice interfaces.
