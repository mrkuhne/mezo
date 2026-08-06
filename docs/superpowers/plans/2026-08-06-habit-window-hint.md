# Habit Out-of-Window Hint (mezo-czol) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an out-of-window sleep log, the `wake_on_time` Today row explains itself („06:30 — a célablakon kívül (05:30 ± 45′)") instead of dumbly re-offering „Logolás".

**Architecture:** Server-computed nullable `hint` on `HabitResponse` (the server is the only party that knows the wakeup, the goal anchor AND the `wake-window-min` config): `HabitService.getDay` fills it for a still-pending `wake_on_time` whose day HAS a sleep log with a non-null wakeup. FE: a row with a server `hint` behaves like `bed_on_time`'s precedent — `habitAction` returns `'none'`, the hint renders as the subtitle (extend `habitHint` to prefer `h.hint`).

**Live repro (root cause evidence):** sleep log 2026-08-06 wakeup 06:30 logged 08:08; goal WAKE 05:30, window ±45′ = 04:45–06:15 → honestly pending; the evaluator ran (weigh-in went done in the same read). The row's CTA gave no feedback. · **bd:** `mezo-czol` · **Branch:** `feat/habit-window-hint`

## Global Constraints

- Contract-first: `api/feature/habit/habit.yml` → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`; never hand-edit generated files.
- **NEVER the full backend suite locally**; focused: `cd backend && ./mvnw clean test -Dtest='HabitApiIT,HabitServiceIT,HabitEvaluatorIT' -DargLine=-Xmx3g`; ALWAYS `clean`; compose PG on :15432. FE gates both modes.
- Hungarian user copy; the hint copy format exactly: `%s — a célablakon kívül (%s ± %d′)` with (wakeup, goalWake `HH:mm`, windowMin). No hardcoded copy in Java beyond this format? — user-facing text normally lives in messages.properties, BUT the habit domain's HU copy precedent is the catalog/`habitHint` (FE) and `anchorCopy` (catalog JSON); this hint is dynamic server copy — put the format string in `messages.properties` as `HABIT_WAKE_OUT_OF_WINDOW=%s — a célablakon kívül (%s ± %d′)` and load via the existing message-resolution idiom IF one exists for non-error copy; if the codebase has NO non-error message precedent, a `private static final String` in `HabitService` with a comment is acceptable — check first, follow the house pattern, report which.
- Commits `(mezo-czol)`, explicit `git add` + `--no-verify`; archunit_store check after backend runs.

---

### Task 1: The whole fix (contract + service + FE + tests)

**Files:**
- Modify: `api/feature/habit/habit.yml` (`HabitResponse` gains `hint: { type: string, nullable: true, description: "Server-computed explainer for a row that cannot tick right now (e.g. out-of-window wakeup)" }`) + regenerated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitService.java` (compute in the getDay mapping path), `mapper/HabitMapper.java` (`toResponse` gains a nullable `String hint` param; existing callers pass null)
- Modify: `frontend/src/data/types.ts` (`HabitItem.hint?: string | null`), `frontend/src/data/habit/habitApi.ts` (map it)
- Modify: `frontend/src/features/today/logic/habitAction.ts` (`habitAction`: `if (h.status === 'pending' && h.hint) return { kind: 'none' }` BEFORE the MANUAL branch is NOT correct — hints only apply to DERIVED rows; place it after the MANUAL check; `habitHint(h)`: server `h.hint` takes precedence over the static `bed_on_time` copy)
- Tests: `backend/.../HabitServiceIT` (or `HabitApiIT`) new cases; `frontend/src/features/today/logic/habitAction.test.ts` (or the file that tests it — find it); `TodayPage` test only if the row-rendering path needs one (the `bed_on_time` hint rendering is already covered — the same mechanism runs).

**Server logic (in `getDay`'s response-building loop):** for the row with `habit_key == "wake_on_time"` whose status is `pending` after evaluation: look up the day's sleep log (the evaluator's `sleepLog(userId, date)` shape — reuse via a small package-private helper on `HabitEvaluator` or duplicate the two-line repository read in `HabitService`, whichever is cleaner; prefer exposing `Optional<String> wakeupOf(userId, date)` on the evaluator); if a wakeup exists → hint = format(wakeup, `habitTargets.resolve(userId).wake()` as HH:mm, `properties.wakeWindowMin()`). All other rows: null hint. (Do NOT hint `bed_on_time` — its FE static hint already covers it; do not remove that.)

**Test cases (write first, RED):**
- Backend: (a) sleep log with out-of-window wakeup (goal WAKE 05:30 via `SleepGoalPopulator`, log wakeup 06:30) → getDay's `wake_on_time` row: status pending, `hint == "06:30 — a célablakon kívül (05:30 ± 45′)"`; (b) in-window wakeup → status done, hint null; (c) no sleep log → pending, hint null (the CTA must keep offering Logolás).
- FE: `habitAction` on a pending habit WITH `hint` → `{kind:'none'}`; `habitHint` returns the server hint; a pending DERIVED row without hint keeps its CTA; MANUAL rows unaffected by the new branch.

**Steps:** contract edit + regens → failing backend tests → implement service/mapper → green focused gate (`HabitApiIT,HabitServiceIT,HabitEvaluatorIT`) → failing FE tests → implement types/api/habitAction → `pnpm test src/features/today src/data/habit` both modes + `pnpm build` + full FE both modes → docs: `docs/features/habit.md` §2 (the wake row's post-log explainer) + §4 (`hint` field) + §9 (the gotcha: out-of-window log ≠ not-logged), lint → TWO commits: `fix(habit): server-computed out-of-window hint on the wake row (mezo-czol)` + `docs(habit): out-of-window hint in living docs (mezo-czol)`.

---

### Task 2: Ship (maintainer/main-loop — NOT for a subagent)

- [ ] Final gates on final tree; fetch/back-merge if main moved (bd union recipe); push; PR; CI table; worktree-safe `--no-ff` merge; verify; `bd close mezo-czol`; cleanup; main CI green.
