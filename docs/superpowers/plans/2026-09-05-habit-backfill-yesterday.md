# Habit Backfill for Yesterday (mezo-x9c2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow checking/unchecking MANUAL habits for yesterday (max 1 day back): backend window gate + `missed → done` flip, `/nap/rutin` date header, date-aware mock arm.

**Architecture:** The backend gate `requireManualToday` becomes `requireManualWithinBackfillWindow` (window from a new `mezo.habit.backfill-days` tunable, default 1); `check()` materializes rows for the *request* date and gains a `missed → done` branch (yesterday's rows were cron-closed `missed`). XP attribution to yesterday is already wired (`HabitSignal.occurredOn` = `habit_date`, gamification sums by `occurred_on`) — zero progression code. FE: `/nap/rutin` gets a `DayNavigator` (today ↔ yesterday only); the mock arm gets a date-aware day seed and error/XP-date parity.

**Tech Stack:** Spring Boot + Testcontainers ITs, OpenAPI fragment contract, React + TanStack Query + Vitest.

**Driving bd issue:** mezo-x9c2. Spec: [2026-09-05-habit-backfill-yesterday-design.md](../specs/2026-09-05-habit-backfill-yesterday-design.md)

## Global Constraints

- Worktree: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/backfill-logging-yesterday-5553d5`, branch `feat/habit-backfill-yesterday`. Never `cd` to the primary repo.
- Backend commands run from `backend/` with `./mvnw` (the wrapper is `backend/mvnw`, NOT repo root). NEVER the full suite locally — focused tests only, always with `-Dmezo.test.use-testcontainers=true`. CI is the authoritative gate.
- FE tests BOTH modes explicitly: `VITE_USE_MOCK=true pnpm test -- --run` AND `VITE_USE_MOCK=false pnpm test -- --run` (from `frontend/`), plus `pnpm exec tsc -b`. No local eslint.
- New error code is `HABIT_TOO_OLD` (replaces `HABIT_NOT_TODAY` — for both too-old AND future dates). Mock arm mirrors codes verbatim as `Error('HABIT_TOO_OLD')`.
- Tunables go in `HabitProperties` (`mezo.habit.*`), never code constants.
- Scope is MANUAL habits only. DERIVED backfill is out (follow-up bd issue filed in Task 7).
- Commit subjects carry the bd id: `feat(habit): … (mezo-x9c2)`. Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- ADR 0010 tone: `missed` is dim and silent; backfill copy never frames a "failure fix".
- bd only for tracking (no TodoWrite). `bd comment` uses `--stdin` on this build; avoid the word "git" and command substitution in text passed to bd.

---

### Task 1: Backend window gate + `missed → done` flip

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitService.java:142-180` (check/uncheck), `:388-395` (gate)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java`
- Modify: `backend/src/main/resources/application.yml:1720-1728` (mezo.habit block)
- Modify: `backend/src/main/resources/messages.properties:54`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitServiceIT.java`

**Interfaces:**
- Produces: `requireManualWithinBackfillWindow(HabitDefEntity def, LocalDate date)` (private, replaces `requireManualToday`); `HabitProperties.backfillDays()` (int, config `mezo.habit.backfill-days: 1`); 409 code `HABIT_TOO_OLD` (replaces `HABIT_NOT_TODAY` everywhere).
- Consumes: existing `ensureRows(UUID, LocalDate)`, `complete(row, def, source)`, `conflict(code)`, `progressionService.revertHabit`.

- [ ] **Step 1: Write the failing ITs**

In `HabitServiceIT.java`, change the last assertion of `testCheck_shouldAwardAndGuard_whenManualHabit` (line ~183) from a yesterday-check expecting `HABIT_NOT_TODAY` to a **two-days-ago** check expecting `HABIT_TOO_OLD`, plus a future-date guard:

```java
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.minusDays(2)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_TOO_OLD"));
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.plusDays(1)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_TOO_OLD"));
```

Add three new tests (imports to add: `io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository`; autowire it as `@Autowired private LevelUpEventRepository levelUpEventRepository;`):

```java
    /**
     * Backfill (mezo-x9c2): yesterday's cron-closed MISSED row flips to done on a backdated
     * MANUAL check, and the XP's business date is YESTERDAY (occurredOn rides habit_date —
     * mezo-huzd plumbing), so the gamification day aggregate heals retroactively.
     */
    @Test
    void testCheck_shouldFlipMissedToDoneAndBackdateXp_whenYesterday() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_MISSED);

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1); // XP attributed to YESTERDAY, not today
        // done rows guard unchanged for the past day too
        assertThatThrownBy(() -> habitService.check(owner, "morning_sunlight", yesterday))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_ALREADY_DONE"));
    }

    /**
     * Backfill (mezo-x9c2): a yesterday whose rows never materialized (the user never opened
     * the app that day) must not 500 — ensureRows materializes the REQUEST date's rows.
     */
    @Test
    void testCheck_shouldMaterializeAbsentRows_whenYesterdayNeverTouched() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // no populator call — yesterday has zero rows

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(repository.findByCreatedByAndHabitDate(owner, yesterday)).isNotEmpty();
    }

    /**
     * Backfill (mezo-x9c2): yesterday-uncheck reverts the XP and resets to pending; the next
     * closePast honestly re-closes it missed — intended semantics, pinned here.
     */
    @Test
    void testUncheck_shouldRevertAndRecloseMissed_whenYesterday() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_MISSED);
        habitService.check(owner, "morning_sunlight", yesterday);

        var reverted = habitService.uncheck(owner, "morning_sunlight", yesterday);
        assertThat(reverted.getStatus().getValue()).isEqualTo("pending");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday)).isEmpty();

        habitService.closePast(owner, LocalDate.now());
        assertThat(byKey(repository.findByCreatedByAndHabitDate(owner, yesterday),
            "morning_sunlight").getStatus()).isEqualTo("missed");
    }
```

- [ ] **Step 2: Run the tests to verify they fail for the right reason**

```bash
cd backend && ./mvnw -q test -Dtest='HabitServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -40
```
Expected: the modified guard test fails with code `HABIT_NOT_TODAY` (not `HABIT_TOO_OLD`); the three new tests fail with `HABIT_NOT_TODAY` conflicts. NOT compilation errors (all consumed symbols exist). Verify the failure messages actually name the wrong code before proceeding.

- [ ] **Step 3: Implement**

`HabitProperties.java` — add the tunable (keep record field order matching application.yml block order convention; append at the end):

```java
public record HabitProperties(
    @NotBlank String closeCron,
    @Min(0) int wakeWindowMin,
    @Min(1) int proteinTargetG,
    @Min(0) int bedGraceMin,
    @Min(0) int kitchenCloseOffsetMin,
    @Min(1) int strengthWindowDays,
    @Min(1) int minSample,
    @Min(1) int summaryDays,
    @Min(0) int backfillDays) {}
```

`application.yml` mezo.habit block — append after `summary-days: 30`:

```yaml
    backfill-days: 1              # MANUAL check/uncheck window: today - N .. today (mezo-x9c2)
```

`messages.properties:54` — replace `HABIT_NOT_TODAY=Only today's habits can be changed.` with:

```properties
HABIT_TOO_OLD=Only today or yesterday can be changed.
```

`HabitService.java` — replace `requireManualToday` (also update both call sites at :145 and :164, and the class javadoc's "(same day only)" phrase to "(today or yesterday — the backfill window)"):

```java
    /**
     * MANUAL check/uncheck gate (mezo-x9c2): the write must target a MANUAL def and a date
     * inside the backfill window — {@code today - backfillDays .. today}. One code for both
     * out-of-window sides (older AND future): a future date is a client bug, not a product
     * state, so it does not earn its own code.
     */
    private void requireManualWithinBackfillWindow(HabitDefEntity def, LocalDate date) {
        if (!HabitDefEntity.MODE_MANUAL.equals(def.getMode())) {
            throw conflict("HABIT_NOT_MANUAL");
        }
        LocalDate today = LocalDate.now();
        if (date.isAfter(today) || date.isBefore(today.minusDays(properties.backfillDays()))) {
            throw conflict("HABIT_TOO_OLD");
        }
    }
```

`check()` — materialize the *request* date and allow the `missed` flip (replace lines 145-152):

```java
        requireManualWithinBackfillWindow(def, date);
        ensureRows(userId, date); // the REQUEST date — a never-opened yesterday has no rows yet
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(); // unreachable: ensureRows just reconciled every catalog row for date
        // pending (live day) and missed (cron-closed backfill target) both flip; done guards.
        if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())
            && !HabitDayEntity.STATUS_MISSED.equals(row.getStatus())) {
            throw conflict("HABIT_ALREADY_DONE");
        }
```

`uncheck()` — only the gate call changes (line 164): `requireManualWithinBackfillWindow(def, date);`. The revert already resets to `pending`; the next `closePast` re-closing it `missed` needs no code.

- [ ] **Step 4: Run the focused ITs to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='HabitServiceIT,HabitJobIT,ProgressionHabitIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```
Expected: PASS (ProgressionHabitIT's existing `testApplyHabit_shouldStampBusinessDate_whenAwarded` already covers the backdated-occurredOn award — no new progression test needed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit backend/src/main/resources backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitServiceIT.java
git commit -m "feat(habit): allow MANUAL check/uncheck for yesterday (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: closePast race IT + HTTP 409 branch

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitServiceIT.java` (race orderings)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitApiIT.java` (HTTP 409 `HABIT_TOO_OLD`)

**Interfaces:**
- Consumes: Task 1's window gate + missed-flip; `habitPopulator.pendingDay(owner, date)`; HabitApiIT's existing `postForBody(path, body, type, status)` / error-body helpers (copy the call pattern of the `HABIT_NOT_MANUAL` case at ~:44).

- [ ] **Step 1: Write the race-ordering ITs (they should PASS already — they pin behavior)**

The midnight race is benign by construction (closePast only closes `pending`, skips `done`; both interleavings end `done` with one award). These tests PIN that — the spec's test-expectation says the race deserves IT coverage, not that it needs new code. Add to `HabitServiceIT.java`:

```java
    /**
     * Midnight race, ordering A (mezo-x9c2): the user checks late, the close job runs after.
     * closePast only closes PENDING rows, so it must skip the done row — no double-close,
     * no second award.
     */
    @Test
    void testClosePastAfterCheck_shouldKeepDoneAndSingleAward_whenCheckWonTheRace() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitService.check(owner, "morning_sunlight", yesterday); // pending -> done (backfill window)

        habitService.closePast(owner, LocalDate.now()); // the "cron" arrives second

        assertThat(byKey(repository.findByCreatedByAndHabitDate(owner, yesterday),
            "morning_sunlight").getStatus()).isEqualTo("done");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1); // exactly one award
    }

    /**
     * Midnight race, ordering B (mezo-x9c2): the close job wins and closes the row missed;
     * the user's late check then flips missed -> done. Both orderings converge on done + 1 award.
     */
    @Test
    void testCheckAfterClosePast_shouldFlipMissedToDone_whenCronWonTheRace() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitService.closePast(owner, LocalDate.now()); // cron closes it missed first

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1);
    }
```

In `HabitApiIT.java`, extend the existing guard test (or add one following its exact helper style — read the file's existing `HABIT_NOT_MANUAL` case first and copy its call shape) asserting `POST /api/habit/morning_sunlight/check` with `{"date": "<today minus 2 days>"}` returns HTTP 409 whose body contains `HABIT_TOO_OLD`.

- [ ] **Step 2: Run them**

```bash
cd backend && ./mvnw -q test -Dtest='HabitServiceIT,HabitApiIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```
Expected: PASS. If ordering B fails, the Task 1 missed-branch is wrong — fix there, not here.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/habit
git commit -m "test(habit): pin closePast/backfill race orderings + HABIT_TOO_OLD API branch (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Contract descriptions + regenerated artifacts

**Files:**
- Modify: `api/feature/habit/habit.yml:26`, `:46`, `:53`, `:69`
- Regenerate: `api/openapi.yml` (bundle), `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: contract text naming the yesterday window and `HABIT_TOO_OLD`; regenerated artifacts so the CI contract-drift gate stays green. No schema shape change.

- [ ] **Step 1: Edit the fragment**

In `api/feature/habit/habit.yml`:
- `:26` summary → `Manually check a MANUAL habit for today or yesterday (max 1 day back) (Habits)`
- `:46` 409 description → `HABIT_NOT_MANUAL | HABIT_TOO_OLD | HABIT_ALREADY_DONE`
- `:53` summary → `Un-check of a MANUAL habit for today or yesterday; reverses the XP (Habits)`
- `:69` 409 description → `HABIT_NOT_MANUAL | HABIT_TOO_OLD | HABIT_NOT_DONE`

- [ ] **Step 2: Regenerate both artifacts (CI drift gate's own recipe)**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 3: Verify the drift is fully absorbed**

```bash
git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts && ! grep -rn "HABIT_NOT_TODAY" api/ frontend/src/data/_client/api.gen.ts
```
Expected: both files changed; grep finds nothing (exit 0 for the negated grep).

- [ ] **Step 4: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): habit check/uncheck contract names the yesterday window + HABIT_TOO_OLD (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: FE data layer — date-aware mock day + action parity

**Files:**
- Modify: `frontend/src/data/habit/habitHooks.ts`
- Test: `frontend/src/data/habit/habitHooks.test.tsx`

**Interfaces:**
- Produces: `useHabitDay(date)` mock arm returns a **closed-day projection** for any past date (`pending` seeds read `missed`); mock `check`/`uncheck` throw `Error('HABIT_TOO_OLD')` outside the window and pass `date` to `awardGamificationEvent` so the mock ledger credits the request date.
- Consumes: `awardGamificationEvent(qc, { type, date?, xpOverride?, silentXp? })` (already date-capable, `gamificationStore.ts:32-36`); `addDays`/`localDateString` from `@/shared/lib/dates`; existing `patchMock` (flips any status, no change needed).

- [ ] **Step 1: Write the failing tests**

Add to `habitHooks.test.tsx` (follow the file's existing wrapper/`QueryWrapper` + mock-mode describe pattern — read the `useHabitDay (mock mode)` describe first and reuse its setup verbatim; `addDays` import from `@/shared/lib/dates`):

```tsx
describe('useHabitDay past-day mock projection (mezo-x9c2)', () => {
  test('yesterday reads as a closed day: pending seeds become missed, done stays done', () => {
    const yesterday = addDays(localDateString(), -1)
    const { result } = renderHook(() => useHabitDay(yesterday), { wrapper: QueryWrapper })
    const byKey = Object.fromEntries(result.current.habits.map((h) => [h.key, h.status]))
    expect(byKey.morning_sunlight).toBe('done')     // seeded done — untouched
    expect(byKey.morning_pushups).toBe('missed')    // seeded pending — the night closed it
    expect(byKey.wind_down).toBe('missed')
  })
})

describe('mock check window parity (mezo-x9c2)', () => {
  test('check for two days ago rejects with HABIT_TOO_OLD, like the backend', async () => {
    const twoDaysAgo = addDays(localDateString(), -2)
    const { result } = renderHook(() => useHabitActions(twoDaysAgo), { wrapper: QueryWrapper })
    await expect(result.current.check('morning_pushups')).rejects.toThrow('HABIT_TOO_OLD')
  })

  test('yesterday check flips the missed row to done in the day cache', async () => {
    const yesterday = addDays(localDateString(), -1)
    const wrapper = QueryWrapper
    const day = renderHook(() => useHabitDay(yesterday), { wrapper })
    const actions = renderHook(() => useHabitActions(yesterday), { wrapper })
    expect(day.result.current.habits.find((h) => h.key === 'morning_pushups')?.status).toBe('missed')
    await act(() => actions.result.current.check('morning_pushups'))
    expect(day.result.current.habits.find((h) => h.key === 'morning_pushups')?.status).toBe('done')
  })
})
```

CAUTION: the two `renderHook` calls must share one QueryClient — if the file's `QueryWrapper` builds a fresh client per render, use the file's existing shared-client pattern instead (check how the non-idempotence describe at ~:158 shares state, and mirror it).

- [ ] **Step 2: Run to verify they fail for the right reason**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run src/data/habit/habitHooks.test.tsx 2>&1 | tail -20
```
Expected: projection test fails with `'pending'` (static seed leaks to past dates); window test fails because check resolves instead of rejecting.

- [ ] **Step 3: Implement in `habitHooks.ts`**

Imports: add `addDays, localDateString` from `@/shared/lib/dates`.

Below `MOCK_DAY`, add and use a projection helper:

```ts
/**
 * Past-day mock seed (mezo-x9c2): the nightly close already ran for any past date, so open
 * seeds read `missed` — the static MOCK_DAY leaking into yesterday made the mock arm lie.
 * MANUAL missed rows are exactly the backfill targets the yesterday surface offers.
 */
const mockDayFor = (date: string): HabitDay =>
  date >= localDateString()
    ? MOCK_DAY
    : {
        habits: mockHabitDay.map((h) =>
          h.status === 'pending' ? { ...h, status: 'missed' as const } : h),
        levelUps: [],
      }
```

In `useHabitDay`: `queryFn: mock ? async () => mockDayFor(date) : () => habitApi.day(date)`, `initialData: mock ? mockDayFor(date) : undefined`, and the fallback `q.data ?? (mock ? mockDayFor(date) : EMPTY_DAY)`.

In `useHabitActions`, both mutation mock branches gain the backend's window guard as their first line (mirrored-error-string convention), and the check's award carries the date:

```ts
      if (mock) {
        if (date < addDays(localDateString(), -1)) throw new Error('HABIT_TOO_OLD')
        patchMock(habitKey, 'done')
        const xp = mockHabitDay.find((h) => h.key === habitKey)?.xp ?? 0
        // The call site emits its own DS reward toast for the check (mezo-k5sa), so the
        // generic „+N XP" line would be a duplicate — the level/streak notices still fire.
        // A backfill credits the REQUEST date's ledger (mezo-x9c2), same as the backend's
        // occurredOn = habit_date attribution.
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp, silentXp: true, date })
        return undefined
      }
```

Uncheck mock branch first line: `if (date < addDays(localDateString(), -1)) throw new Error('HABIT_TOO_OLD')` before `patchMock(habitKey, 'pending')`.

- [ ] **Step 4: Run both modes + typecheck**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run src/data/habit 2>&1 | tail -8 && VITE_USE_MOCK=false pnpm test -- --run src/data/habit 2>&1 | tail -8 && pnpm exec tsc -b
```
Expected: PASS both modes; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/habit
git commit -m "feat(habit-fe): date-aware mock day + backfill window parity in the mock arm (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `/nap/rutin` date header + yesterday tick semantics

**Files:**
- Modify: `frontend/src/features/today/pages/NapRutinPage.tsx`
- Test: `frontend/src/features/today/pages/NapRutinPage.test.tsx`

**Interfaces:**
- Consumes: `DayNavigator` (`@/shared/ui/DayNavigator`, props `{date, onChange, maxDate?, minDate?}` — arrows auto-disable at bounds, label reads "Ma" at maxDate); `addDays` from `@/shared/lib/dates`; Task 4's date-aware hooks.
- Produces: `/nap/rutin` navigable between today and yesterday; on yesterday, MANUAL `pending|missed` rows check (backfill), `done` MANUAL rows uncheck, DERIVED rows are inert (their log surfaces are today-bound).

- [ ] **Step 1: Write the failing page tests**

Add to `NapRutinPage.test.tsx` (the file stubs `useHabitDay`/`useHabitActions` ignoring the date via `habitStore` — seed missed rows and drive the `DayNavigator` arrows; reuse the file's existing `renderAt`/render helper and seeding style):

```tsx
describe('yesterday backfill (mezo-x9c2)', () => {
  test('a missed MANUAL row is tickable on the yesterday view and calls check', async () => {
    habitStore.seed([
      { key: 'morning_sunlight', chain: 'MORNING', position: 1, title: 'Reggeli napfény',
        why: 'w', anchorCopy: 'a', mode: 'MANUAL', status: 'missed', xp: 5, strengthPct: 64 },
    ])
    renderPage()
    // ma: a missed sor nem kattintható (mai napon missed nem is létezhet — védőháló)
    expect(screen.queryByRole('button', { name: 'Reggeli napfény' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Előző nap' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reggeli napfény' }))
    expect(habitStore.checked).toEqual(['morning_sunlight'])
  })

  test('a missed DERIVED row stays inert on the yesterday view', async () => {
    habitStore.seed([
      { key: 'morning_weigh_in', chain: 'MORNING', position: 1, title: 'Reggeli súlymérés',
        why: 'w', anchorCopy: 'a', mode: 'DERIVED', status: 'missed', xp: 10, strengthPct: 93 },
    ])
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Előző nap' }))
    expect(screen.queryByRole('button', { name: 'Reggeli súlymérés' })).not.toBeInTheDocument()
  })

  test('the prev arrow stops at yesterday: one step back disables it', async () => {
    habitStore.seed([])
    renderPage()
    const prev = screen.getByRole('button', { name: 'Előző nap' })
    await userEvent.click(prev)
    expect(prev).toBeDisabled()
  })
})
```

(`renderPage` = whatever this file's existing render helper is — reuse it; if the helper is inline `render(<MemoryRouter>…)`, follow that. Do NOT invent a new harness.)

- [ ] **Step 2: Run to verify they fail for the right reason**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run src/features/today/pages/NapRutinPage.test.tsx 2>&1 | tail -20
```
Expected: fail on the missing `Előző nap` button (no DayNavigator on the page yet).

- [ ] **Step 3: Implement in `NapRutinPage.tsx`**

Imports: add `DayNavigator` from `@/shared/ui/DayNavigator`, `addDays` from `@/shared/lib/dates`.

Date state (replace line 63):

```tsx
  // Tegnapra visszalapozható logoló felület (mezo-x9c2, Streaks-minta): a navigátor a
  // backfill-ablakra szorít — ma és tegnap, semmi több.
  const today = localDateString()
  const yesterday = addDays(today, -1)
  const [date, setDate] = useState(today)
  const isToday = date === today
```

Render the navigator directly under `<PageHead …/>` (inside `EntranceGroup`, before the hero):

```tsx
        <DayNavigator date={date} onChange={setDate} maxDate={today} minDate={yesterday} />
```

`tickAction` — insert a past-day branch after the `done` branch and gate the DERIVED switch to today (the extracted `runCheck` is the current `case 'check'` body, reused verbatim by both branches):

```tsx
  const runCheck = (h: HabitItem) => () => {
    const { done, total } = chainProgress(h.chain)
    const celebration = celebrationFor(catalog, h.key)
    const chainLabel = daypartMilestone(catalog, habits, h.chain)
    check(h.key)
      .then((lu) => emitToast(buildHabitRewardToast({
        title: h.title, chainDone: done, chainTotal: total, xp: h.xp, levelUp: lu?.[0],
        celebration, chainLabel,
      })))
      .catch(() => {})
  }

  const tickAction = (h: HabitItem): (() => void) | null => {
    if (h.status === 'done') {
      return h.mode === 'MANUAL' ? () => { uncheck(h.key).catch(() => {}) } : null
    }
    if (!isToday) {
      // Tegnap (mezo-x9c2): csak a MANUAL sor pipálható vissza — a DERIVED sorok logoló
      // felületei a mai naphoz kötnek, ott a sor csendes történelem (ADR 0010 hangnem).
      return h.mode === 'MANUAL' && (h.status === 'pending' || h.status === 'missed')
        ? runCheck(h)
        : null
    }
    if (h.status !== 'pending') return null
    const ha = habitAction(h)
    switch (ha.kind) {
      case 'check': return runCheck(h)
      case 'nav': return () => navigate(ha.to)
      case 'meal-sheet': return () => setMealOpen(true)
      case 'sleep-sheet': return () => setSleepOpen(true)
      case 'intention-sheet': return () => setFocusOpen(true)
      case 'intention-reflect': return () => setReflectOpen(true)
      case 'none': return null
    }
  }
```

Stat strip: the XP cell label becomes date-honest — `<StatCell value={`+${xpToday}`} label={isToday ? 'XP ma' : 'XP tegnap'} />`.

Note: `useIntentionDay(date)`/`useIntentionActions(date)` also re-key on the state date now — that is correct (the intention rows' sheets only open from the today branch, and the intention day read is date-parametrized already). The `missed` row's rendered tick stays the dim empty circle the page already draws for non-done rows; no new "failure" styling (ADR 0010).

- [ ] **Step 4: Run the page tests, both modes, typecheck**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run 2>&1 | tail -8 && VITE_USE_MOCK=false pnpm test -- --run 2>&1 | tail -8 && pnpm exec tsc -b
```
Expected: full FE suite PASS in both modes; tsc clean. (Full suite here, not just the file — the page is shared surface.)

- [ ] **Step 5: Runtime sanity (mock PWA)**

Use the repo's `verify` skill recipe to launch the mock-mode app, navigate to `/nap/rutin`, step back to yesterday, tick a missed MANUAL row, and confirm the row flips + toast fires + no console errors. (If the skill is unavailable, `pnpm dev` + browser pane on `/nap/rutin`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/pages
git commit -m "feat(habit-fe): /nap/rutin date header with yesterday backfill ticks (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs + codemap

**Files:**
- Modify: `docs/features/habit.md` (front-matter `updated:`, §2, §3, §4, §8, §9)
- Regenerate: `docs/CODEMAP.md`

**Interfaces:**
- Consumes: everything shipped in Tasks 1–5. No code.

- [ ] **Step 1: Update `docs/features/habit.md`**

Precise edits (grep for the quoted phrases — line numbers will have drifted):
1. Front-matter `updated:` → `2026-09-05` (or the actual date of the edit).
2. §2, RutinHubPage block, the sentence **"Retroactive yesterday-logging from this page is DEFERRED (bd `mezo-x9c2`): the past view is read-only, daily check/log stays on the Nap tab."** → rewrite: retro-logging shipped with `mezo-x9c2` but its host is `/nap/rutin`'s date header (Streaks pattern — the canonical logging surface), NOT this page; the hub's past view stays deliberately read-only.
3. §2, the accepted-expansion bullet calling this page **"bd `mezo-x9c2`'s eventual retroactive-logging host"** → correct it the same way (the DayNavigator stays load-bearing as the only *arbitrary* past-day browser; the 1-day backfill lives on `/nap/rutin`).
4. §2: add a bullet to the `/nap/rutin` (NapRutinPage) section describing the date header: DayNavigator bounded to `today-1 .. today`, yesterday's MANUAL `pending|missed` rows check (missed → done), `done` MANUAL rows uncheck, DERIVED rows inert on the past day, XP cell label `XP tegnap`, mock arm's closed-day projection (`pending` seeds read `missed` for past dates).
5. §3, the **"Since checks are today-only (`requireManualToday`, below) this coincides with the grant instant in v1 — no observable behavior change"** sentence → rewrite: since `mezo-x9c2` the backdating this plumbing anticipated is real — a yesterday check awards with `occurredOn` = yesterday, so the gamification day aggregate heals retroactively; note the streak-rollover asymmetry (a backfill only extends the streak when no award landed today yet — accepted, anti-gaming).
6. §3, the **"Manual path"** bullet: `(today only)` → the backfill window (`mezo.habit.backfill-days`, default 1); name the `missed → done` branch, the request-date `ensureRows`, and that a yesterday-uncheck's `pending` row is re-closed `missed` by the next `closePast` (intended).
7. §3 "soft-delete" verification (spec's one-line verify): open `backend/src/main/java/io/mrkuhne/mezo/feature/progression/entity/LevelUpEventEntity.java` — if it carries `@SQLDelete`, the doc's "soft-deletes the `level_up_event`" wording stands; if not, fix the wording to "deletes".
8. §4 API table rows for check/uncheck: `HABIT_NOT_TODAY` → `HABIT_TOO_OLD`, and the uncheck row's "same-day MANUAL un-check" → the window phrasing.
9. §8 Testing: mention the race-ordering ITs (both interleavings converge on done + single award).
10. §9: add a decision entry — mezo-x9c2 product decisions (XP → yesterday because the daily aggregate must not lie and mezo has no cross-user daily competition; surface → `/nap/rutin` per Streaks/Habitify prior art; hub stays read-only; `HABIT_TOO_OLD` covers both out-of-window sides; DERIVED backfill deferred to the follow-up issue filed in Task 7).

- [ ] **Step 2: Regenerate the codemap + lint docs**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```
Expected: codemap regenerated (front-matter `updated:` change alone already requires it); lint clean.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(habit): yesterday backfill — surfaces, window gate, race ITs (mezo-x9c2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Verification, bd close-out, PR

**Files:** none new — gates + bd + push.

- [ ] **Step 1: Focused backend gate, one last time**

```bash
cd backend && ./mvnw -q test -Dtest='HabitServiceIT,HabitApiIT,HabitJobIT,ProgressionHabitIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15
```

- [ ] **Step 2: FE gates, both modes + typecheck + build**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run 2>&1 | tail -5 && VITE_USE_MOCK=false pnpm test -- --run 2>&1 | tail -5 && pnpm exec tsc -b && pnpm build 2>&1 | tail -5
```

- [ ] **Step 3: File the DERIVED-backfill follow-up + close the driving issue**

```bash
bd create "Rutin: DERIVED habit re-derivation for backdated source logs" --body-file - <<'EOF'
Follow-up to mezo-x9c2 (MANUAL-only yesterday backfill). When a source log gains backdating
(sleep/meal/weight already partially have it), a past habit_day should re-derive so DERIVED
rows can flip missed->done for yesterday too. Needs: a re-derivation entry point over
closePast's evaluation classes for an already-closed day, scoped to the same backfill window.
Users will ask why yesterday's caffeine_cutoff cannot be fixed while morning_sunlight can.
EOF
bd close mezo-x9c2
bd dolt push
```

- [ ] **Step 4: Push + self-PR (CI is the authoritative gate)**

Follow `superpowers:finishing-a-development-branch`. Worktree-specific close-out (house rules): push the branch, open a self-PR, wait for CI green, then `gh pr merge <n> --merge`, then in a SEPARATE command `git push origin --delete feat/habit-backfill-yesterday`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review notes

- Spec coverage: gate+tunable (T1), missed-flip + absent-rows + uncheck semantics (T1), race IT (T2), HTTP branch (T2), contract (T3), mock projection + parity + XP date (T4), page surface + inert DERIVED + ADR tone (T5), docs incl. the three stale lines + soft-delete verify (T6), DERIVED follow-up + close-out (T7). XP attribution needs no task — pinned by T1's `findByCreatedByAndOccurredOn` assertion and the existing `ProgressionHabitIT` backdated case.
- Type consistency: `requireManualWithinBackfillWindow` name used in T1 only (private); `backfillDays()` matches the record accessor; `mockDayFor`/`runCheck` defined where used; DayNavigator props match `DayNavigator.tsx`.
- Known judgment calls the implementer may hit: (a) `HabitServiceIT` needs the `LevelUpEventRepository` import/autowire once (T1 step 1 says so; T2 reuses it); (b) the page-test helper names (`renderPage`) must be adapted to the file's real helper; (c) if `QueryWrapper` isolates clients per renderHook, mirror the file's shared-state pattern (called out in T4).
