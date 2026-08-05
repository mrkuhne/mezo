# Habit Honest-Derivation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DERIVED habits complete on „aznapi log elég" (date-presence) semantics — the weigh-in/stim/run wall-clock cutoffs die — and a supplement-intake log immediately refreshes the habit UI.

**Architecture:** Three metric cases in `HabitEvaluator` become date-presence reads and the catalog renames two metric strings atomically with them (`habit_day` stores keys, not metrics — history untouched). Three `HabitProperties` fields + yml keys are deleted. On the FE, `useStackActions` gains the `mezo-pquo` invalidation fan-out.

**Tech Stack:** Spring Boot 4 / Java 21 backend (`backend/`), React 19 + TanStack Query frontend (`frontend/`), integration tests per `docs/references/testing_standards.md` + `integration_test_framework.md`.

**Spec:** `docs/superpowers/specs/2026-08-05-habit-honest-derivation-fix-design.md` · **bd:** `mezo-u6jx` · **Branch:** `feat/habit-honest-derivation` (already checked out in this worktree)

## Global Constraints

- Work in the current worktree (`…/.claude/worktrees/parallel-session-2`), branch `feat/habit-honest-derivation`. Never switch branch, never touch the primary checkout.
- **NEVER run the full backend suite locally** (`./mvnw clean test` bare) — 16 GB machine, it OOM-dies. Only the focused gate below. CI is the authoritative full gate.
- Backend focused gate (compose Postgres must be up): `cd backend && ./mvnw clean test -Dtest='HabitEvaluatorIT' -DargLine=-Xmx3g` per-task; final backend gate: `-Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT'`. ALWAYS `clean` (Lombok/MapStruct incremental compile is flaky).
- Frontend gate: `cd frontend && pnpm test <file>` per-task; final: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (BOTH modes must be green).
- Commits: conventional subject carrying the bd id, e.g. `fix(habit): … (mezo-u6jx)`. **Explicit `git add <paths>` + `git commit --no-verify`** — the bd pre-commit hook force-stages a stray root `issues.jsonl` otherwise. Never `git add -A`.
- Code/comments English; keep comment density/idiom of the surrounding file.

---

### Task 1: Backend — date-presence metrics (evaluator + catalog + properties)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java`
- Modify: `backend/src/main/resources/content/habit-catalog.json` (lines 21, 25)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.habit:` block, ~line 646)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java`

**Interfaces:**
- Consumes: existing populators (`WeightLogPopulator.createWeightLogAt`, `PantryItemPopulator.createStim`, `SupplementIntakePopulator.createIntake`, `RunningPopulator.createBlock/createRunLogAt`, `SleepGoalPopulator.goal`, `TrainPopulator.*`) and the IT's `at(LocalDate, "HH:mm")` helper — all already in the file.
- Produces: metric strings **`weight_logged_today`** and **`stim_intake_today`** (replacing `weight_logged_before` / `stim_intake_before`) in `HabitEvaluator.INTRADAY_METRICS` and the catalog. No API/DTO change.

- [ ] **Step 1: Rewrite the metric tests to the date-presence contract (failing first)**

In `HabitEvaluatorIT.java` replace the five wall-clock tests (lines 77–147: `shouldRespectWeighInCutoff…`, `shouldFailWeighIn_whenLoggedAfterCutoff`, `shouldPassMorningCoffee_whenStimIntakeBeforeWindowEnd`, `shouldPassTraining_whenRunLoggedBeforeAnchoredCutoff`, `shouldFailTraining_whenRunLoggedAfterAnchoredCutoff`, `shouldUseGhostWakeCutoff_whenNoSleepGoal`) with:

```java
@Test
void testSatisfied_shouldPassWeighIn_whenWeightLoggedAnyTimeToday() {
    UUID owner = owner();
    LocalDate d = LocalDate.now();
    // 11:15 was a MISS under the retired 09:00 cutoff — date-presence ticks it (mezo-u6jx).
    weightLogPopulator.createWeightLogAt(owner, d, new BigDecimal("81.4"), at(d, "11:15"));
    assertThat(evaluator.satisfied("weight_logged_today", owner, d)).isTrue();
}

@Test
void testSatisfied_shouldFailWeighIn_whenNoWeightLogToday() {
    UUID owner = owner();
    assertThat(evaluator.satisfied("weight_logged_today", owner, LocalDate.now())).isFalse();
}

@Test
void testSatisfied_shouldPassMorningCoffee_whenStimIntakeLoggedLate() {
    UUID owner = owner();
    LocalDate d = LocalDate.now();
    var stim = pantryItemPopulator.createStim(owner, "Tasty Dose gombakávé");
    // 15:35 mirrors the live retro-log that used to miss the 10:00 window (mezo-u6jx).
    supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "15:35"));
    assertThat(evaluator.satisfied("stim_intake_today", owner, d)).isTrue();
}

@Test
void testSatisfied_shouldFailMorningCoffee_whenNoStimIntakeToday() {
    UUID owner = owner();
    assertThat(evaluator.satisfied("stim_intake_today", owner, LocalDate.now())).isFalse();
}

@Test
void testSatisfied_shouldPassTraining_whenRunLoggedAnyTimeToday() {
    UUID owner = owner();
    LocalDate d = LocalDate.now();
    // Wake-anchored cutoff retired: a goal-holder's 11:30 run (a MISS before) now counts.
    sleepGoalPopulator.goal(owner, 450, "WAKE", "05:00", 15);
    var block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
    runningPopulator.createRunLogAt(owner, block.getId(), d, at(d, "11:30"));
    assertThat(evaluator.satisfied("training_done_today", owner, d)).isTrue();
}
```

Keep every other test untouched (wake window, gym date-presence, breakfast protein, E1/E2, E4, ritual, unknown-metric). Update the class javadoc paragraph that describes the RUN branch cutoff: the run branch is now date-presence like the gym branch.

- [ ] **Step 2: Run the suite to verify the new tests fail**

Run: `cd backend && ./mvnw clean test -Dtest='HabitEvaluatorIT' -DargLine=-Xmx3g`
Expected: the five new/renamed tests FAIL (`weight_logged_today` / `stim_intake_today` hit the unknown-metric default → false; the 11:30 run fails the still-live cutoff). Everything else passes.

- [ ] **Step 3: Implement date-presence in `HabitEvaluator`**

Replace the three cases in `satisfied(...)`:

```java
case "weight_logged_today" -> weightLogRepository
    .findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(userId, date)
    .isPresent();
case "stim_intake_today" -> !stimIntakes(userId, date).isEmpty();
case "training_done_today" -> {
    if (!workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()) {
        yield true;
    }
    // Run branch is date-presence too since mezo-u6jx — the tick rewards the logged act,
    // the timing coaching lives in anchorCopy (spec: honest-derivation fix §2).
    yield runSessionLogRepository
        .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
        .stream()
        .anyMatch(r -> date.equals(r.getDate()));
}
```

Update `INTRADAY_METRICS` (`weight_logged_before` → `weight_logged_today`, `stim_intake_before` → `stim_intake_today`). The `localTime(Instant)` helper stays (E1/E2 still use it via `stimIntakes`/meals); `habitTargets` stays (wake window + E2/E4 anchors).

- [ ] **Step 4: Rename the catalog metric strings**

In `backend/src/main/resources/content/habit-catalog.json`: line 21 `"metric": "weight_logged_before"` → `"weight_logged_today"`; line 25 `"metric": "stim_intake_before"` → `"stim_intake_today"`. No other field changes (titles/anchors don't reference cutoffs).

- [ ] **Step 5: Delete the three dead properties**

`HabitProperties.java`: remove the `@NotBlank String weighInCutoff`, `@NotBlank String morningWindowEnd`, `@Min(1) int workoutWindowHours` components. `application.yml` `mezo.habit:` block: delete the `weigh-in-cutoff`, `morning-window-end`, `workout-window-hours` lines. Then verify nothing else references them:

Run: `grep -rn "weighInCutoff\|morningWindowEnd\|workoutWindowHours\|weigh-in-cutoff\|morning-window-end\|workout-window-hours" backend/src api/ frontend/src`
Expected: zero hits.

- [ ] **Step 6: Run the evaluator suite green**

Run: `cd backend && ./mvnw clean test -Dtest='HabitEvaluatorIT' -DargLine=-Xmx3g`
Expected: PASS (all tests).

- [ ] **Step 7: Run the focused habit gate**

Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`
Expected: PASS — `HabitCatalogIT` proves the renamed catalog still loads fail-fast-clean; `HabitServiceIT`/`HabitApiIT`/`HabitJobIT` prove the day flow; `QuestApiIT` guards the shared progression tail.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java \
        backend/src/main/resources/content/habit-catalog.json \
        backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java
git commit --no-verify -m "fix(habit): date-presence for weigh-in/stim/run metrics — drop wall-clock cutoffs (mezo-u6jx)"
```

---

### Task 2: Frontend — supplement-intake log refreshes the habit day

**Files:**
- Modify: `frontend/src/data/fuel/stackHooks.ts` (the `useStackActions` mutations, ~lines 91–125)
- Test: `frontend/src/data/fuel/stackHooks.test.tsx`

**Interfaces:**
- Consumes: `useStackActions(date)` returning `{ logIntake, undoIntake }` (unchanged signature); TanStack `QueryClient.invalidateQueries`.
- Produces: real-mode `logIntake`/`undoIntake` now invalidate `['habitDay']` and `['dailyQuests', date]` in addition to `['fuelIntake', date]`. No consumer change.

- [ ] **Step 1: Write the failing invalidation test**

Add to the **real mode** describe block of `stackHooks.test.tsx` (model: `weightHooks.test.tsx:88–110`; MSW `server`/`API_BASE` are already imported in this file):

```tsx
it('logIntake invalidates ["habitDay"] + the day quest read (derived habit re-derive, mezo-u6jx)', async () => {
  // The habit-day READ is the evaluation trigger (habit.md §3) — a stim intake must nudge
  // ['habitDay'] and ['dailyQuests', date] or morning_coffee's ✓ waits for a remount.
  server.use(http.post(`${API_BASE}/api/fuel/intake`, () => HttpResponse.json({ id: 'i-1' })))
  const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  const date = localDateString()
  const { Wrapper } = sharedWrapper()
  const { result } = renderHook(() => useStackActions(date), { wrapper: Wrapper })
  act(() => result.current.logIntake('p-1'))
  await waitFor(() => {
    const keys = invalidateSpy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey))
    expect(keys).toContain(JSON.stringify(['habitDay']))
    expect(keys).toContain(JSON.stringify(['dailyQuests', date]))
  })
  invalidateSpy.mockRestore()
})
```

If the real-mode describe stubs `VITE_USE_MOCK` differently, follow the file's existing `beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))` pattern. Check the real POST path used by `fuelApi.logIntake` in `frontend/src/data/fuel/fuelApi.ts` and match the MSW handler URL to it exactly.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && pnpm test src/data/fuel/stackHooks.test.tsx`
Expected: the new test FAILS — `['habitDay']` never invalidated.

- [ ] **Step 3: Implement the fan-out**

In `useStackActions`, replace the single-key `invalidate` with the `mezo-pquo` fan-out (real mode only, like every metric-feeding mutation):

```ts
const invalidate = () => {
  qc.invalidateQueries({ queryKey: intakeKey(date) })
  // A stim intake can satisfy morning_coffee (stim_intake_today) / affect no_stim_after —
  // the habit-day READ is the evaluation trigger, so nudge it (mezo-pquo pattern, mezo-u6jx).
  qc.invalidateQueries({ queryKey: ['habitDay'] })
  qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
}
```

`logM`/`undoM` keep `onSuccess: mock ? undefined : invalidate` — both writes fan out (undo keeps the caches honest even though a server-side `done` row stays done).

- [ ] **Step 4: Run the file green, then both full modes**

Run: `cd frontend && pnpm test src/data/fuel/stackHooks.test.tsx`
Expected: PASS.
Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Expected: both suites + build green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/fuel/stackHooks.ts frontend/src/data/fuel/stackHooks.test.tsx
git commit --no-verify -m "fix(fuel): stack intake log invalidates habitDay + dailyQuests (mezo-u6jx)"
```

---

### Task 3: Living docs — habit.md + fuel.md

**Files:**
- Modify: `docs/features/habit.md` (§3 metric table refs, §5 Fuel integration, §8 test list, §9 gotchas)
- Modify: `docs/features/fuel.md` (stack-hooks invalidation note in its integrations section)

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–2.
- Produces: current living docs; `node scripts/lint-docs.mjs` clean (clears the git-drift staleness flag).

- [ ] **Step 1: Update `docs/features/habit.md`** (overwrite in place, no changelog — git is the history):
  - §3 bullet **INTRADAY**: `weight_logged_before` → `weight_logged_today`, `stim_intake_before` → `stim_intake_today` (M3/M4 descriptions lose their cutoff wording; note date-presence semantics + spec link `2026-08-05-habit-honest-derivation-fix-design.md`).
  - §3 „Read-triggered heartbeat" bullet: add the supplement-intake mutation to the list of writes that invalidate `['habitDay']`.
  - §5 **← Fuel** bullet: M4 is now `stim_intake_today` (any stim-kind intake that day); E1 unchanged.
  - §5 **← Train** / **← Sleep goal** bullets: run branch no longer wake-anchored — date-presence; `workout-window-hours` removed.
  - §8: `HabitEvaluatorIT` description — replace the cutoff/run-branch case descriptions with the date-presence truth table.
  - §9: delete the „latest-weigh-in decides M3" gotcha (dies with the cutoff); note the accepted E1 retro-log residual + deferred „mikor ittad?" idea; record the property removals in the D6 decision bullet (the `mezo-53su`/`mezo-67rb` precedent line).
- [ ] **Step 2: Update `docs/features/fuel.md`**: in its habit/integration section, note that `useStackActions.logIntake/undoIntake` fan out to `['habitDay']` + `['dailyQuests', date]` (mezo-u6jx).
- [ ] **Step 3: Lint**

Run: `node scripts/lint-docs.mjs`
Expected: no errors, no staleness flag for habit.md/fuel.md.

- [ ] **Step 4: Commit**

```bash
git add docs/features/habit.md docs/features/fuel.md
git commit --no-verify -m "docs(habit): date-presence metrics + stack fan-out in living docs (mezo-u6jx)"
```

---

### Task 4: Ship (maintainer/main-loop task — NOT for a subagent)

- [ ] Push branch: `git push -u origin feat/habit-honest-derivation`
- [ ] Self-PR: `gh pr create --fill` (CI trigger; check it's MERGEABLE — a CONFLICTING PR gets NO CI run)
- [ ] Wait for CI, then **re-run `gh pr checks <n>` and read the table** (never trust `--watch`'s exit code)
- [ ] Merge worktree-safe (main is checked out in the primary checkout): `git fetch origin && git checkout -b tmp origin/main && git merge --no-ff --no-verify feat/habit-honest-derivation && git push origin tmp:main && git checkout feat/habit-honest-derivation && git branch -D tmp`
- [ ] Verify the bd ids survive on main (`git show origin/main:.beads/issues.jsonl | grep -c "u6jx\|n5e9"`), memories intact (`grep -c '"_type":"memory"'`)
- [ ] `bd close mezo-u6jx` + re-export if needed; delete the branch (local + origin)
