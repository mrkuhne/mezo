# Habit backfill for yesterday (mezo-x9c2) — design

Date: 2026-09-05 · Driving issue: mezo-x9c2 (P2) · Depends on: mezo-mpd0 (read-only past view)

## Goal

Allow checking/unchecking MANUAL habits for **yesterday only** (max 1 day back), so a
forgotten log can be repaired. Today the past-day arm is read-only and the backend gate
(`requireManualToday`) rejects any non-today date.

## Product decisions (settled with Daniel, 2026-09-05)

1. **XP attributes to YESTERDAY.** The daily gamification aggregate stays truthful:
   yesterday's chart/summary heals together with the chain and perfect-day counters.
   This is already the wired behavior — `complete()` passes `row.getHabitDate()` as
   `HabitSignal.occurredOn` (mezo-huzd plumbing) and `GamificationService.getDay` sums
   `level_up_event` by `occurred_on`. No progression-side code change.
2. **The interactive surface is the /nap/rutin date header** (Streaks pattern: backfill
   lives on the canonical logging surface). The hub's past arm stays read-only.
3. **Error code:** out-of-window dates get a new `HABIT_TOO_OLD` code, replacing
   `HABIT_NOT_TODAY` (whose name would lie once yesterday is allowed).

## Scope

- **In:** MANUAL habit check/uncheck for yesterday, backend gate + row-flip semantics,
  contract description updates (no shape change), FE date header on /nap/rutin,
  date-aware mock arm, ITs incl. the closePast race.
- **Out:** DERIVED habits (re-deriving yesterday's `bed_on_time`/`caffeine_cutoff` etc.
  from backdated source logs — no source can backdate today; follow-up bd issue),
  arbitrary N-day backfill, streak retro-extension changes, hub-arm interactivity.

## Backend design

`HabitService.java`:

- **Gate:** replace `requireManualToday(def, date)` with
  `requireManualWithinBackfillWindow(def, date)`. Rules: not MANUAL → 409
  `HABIT_NOT_MANUAL` (unchanged); the window is `today - backfillDays <= date <= today`;
  any date outside it — older than the window **or in the future** — 409s
  `HABIT_TOO_OLD` (one code for both sides; a future date is a client bug, the slightly
  lying name there is accepted for simplicity). Window size comes
  from a new `HabitProperties` tunable `mezo.habit.backfill-days` (default `1`), never a
  code constant.
- **check():** `ensureRows(userId, date)` for the *request* date instead of the
  hardcoded `LocalDate.now()` — yesterday's rows legitimately may not exist (user never
  opened the app); the existing race-guarded reconcile idiom materializes them, and the
  current bare `orElseThrow` 500 disappears. Status branch: `pending → done` (today's
  path, unchanged) **and** `missed → done` (yesterday's cron-closed row); `done` still
  409s `HABIT_ALREADY_DONE`. `done_at` is honestly "now"; `occurredOn` rides
  `habit_date` (yesterday), so XP lands on yesterday's aggregate.
- **uncheck():** symmetric — same window gate; a yesterday `done`+`SOURCE_MANUAL` row
  reverts XP via `progressionService.revertHabit` and resets to `pending`; the next
  `closePast` honestly re-closes it `missed`. This is intended semantics, not a bug.
- **closePast race:** benign by construction — `closePast` only closes `pending` rows
  and skips `done`; both interleavings of a midnight-adjacent check end in `done`.
  Still pinned by IT (see Testing).
- **Self-correcting derived numbers:** 30-day perfect-day counters and chain strength
  recompute from rows per read — no code change needed.
- **Streak nuance (accepted, documented):** `GamificationAccountAdapter`'s rollover
  guard means a backfill only extends the streak when no award has landed today yet;
  once `lastStreakDate` is today, the chain does not retro-extend. Anti-gaming stance
  (Apple/Duolingo direction); we do not touch it.

## Contract (`api/feature/habit/habit.yml`)

No shape change: `POST /api/habit/{key}/check` already carries a required
`HabitCheckRequest{date}` body and `DELETE …/check` a required `date` query param.
Update endpoint descriptions to state the yesterday window and the `HABIT_TOO_OLD`
code (error codes live in `SystemMessage`, not the yml schema). Contract-drift CI gate
will fire on the description change — expected.

## Frontend design

- **/nap/rutin (`NapRutinPage.tsx`):** the hardwired `localDateString()` becomes a
  date state with a header toggle between today and yesterday (Streaks
  "Yesterday or Today" pattern; no general date picker — the window is 1 day).
  `useHabitDay(date)` / `useHabitActions(date)` are already date-parametrized, so the
  change is page-level. Past-yesterday visual language follows ADR 0010: `missed` is
  dim and silent; the backfill affordance is a normal check, never framed as "fixing a
  failure" (match RutinHubPage's past copy voice).
- **Hub (`RutinHubPage.tsx`):** untouched; past arm stays read-only.
- **Mock arm (`habitHooks.ts` / `habitMock.ts`):** `useHabitDay` mock currently returns
  the static `MOCK_DAY` for any date — add a date-aware seed so yesterday renders a
  plausible closed day (some `missed`). Mock `check` mirrors the backend: yesterday
  `missed → done` flips, `HABIT_TOO_OLD` thrown as `Error('HABIT_TOO_OLD')` for older
  dates (mock-error-string parity convention), and the mock gamification credit keys
  the request date so the streak/ledger doesn't lie in mock mode. `patchMock` already
  keys per-date.

## Testing

- **Backend ITs (CI is the authoritative gate; run focused locally with
  testcontainers):**
  - `HabitServiceIT`: rewrite the `HABIT_NOT_TODAY` assertion → yesterday passes,
    day-before-yesterday 409s `HABIT_TOO_OLD`; new case "cron-closed `missed` row flips
    to `done` on yesterday check, XP awarded with `occurredOn` = yesterday"; uncheck
    symmetry (revert + re-close by next `closePast`); yesterday-row-absent case
    (materialized via `ensureRows`, no 500).
  - **closePast race IT** (`HabitJobIT` or `HabitServiceIT`): both orderings —
    check-then-close (close skips `done`) and close-then-check (`missed → done`) —
    end in `done` with exactly one XP award.
  - `ProgressionHabitIT`: backdated `occurredOn` apply/revert idempotency.
  - `HabitApiIT`: HTTP 409 branch for `HABIT_TOO_OLD`.
- **FE:** both modes explicitly (`VITE_USE_MOCK=true|false pnpm test`) + `tsc -b`;
  hook tests pin the date-aware mock seed and the `HABIT_TOO_OLD` mock error.
- TDD throughout: failing test first, verified failing for the right reason.

## Docs

`docs/features/habit.md` §2/§3/§9/§10 + front-matter `updated:`. Three now-false lines
flagged by recon: `:66` and `:70` (past view read-only / mezo-x9c2 deferred), `:133`
("checks are today-only … no observable behavior change" for `occurredOn` plumbing).
Verify §3's "soft-delete" wording for `revertHabit` (code calls `repository::delete`;
presumably entity-level `@SQLDelete` — one-line verify). Regenerate codemap.

## Prior art

- **Streaks** ([Streaks 5](https://crunchybagel.com/streaks-5-now-available/)) —
  adopted: yesterday-only backfill as a first-class action on the daily logging
  surface ("Yesterday or Today"); same 1-day window as ours.
- **Loop Habit Tracker** ([FAQ](https://github.com/iSoron/uhabits/discussions/689)) —
  adopted the semantics (flip recomputes that day's state, attribution to the
  historical date); rejected the placement (edit mode buried in per-habit history —
  the discoverability anti-pattern).
- **Habitify** ([feedback thread](https://feedback.habitify.me/p/ux-improvement-quick-log-habits-for-previous-days-without-date)) —
  users ask for one-tap yesterday without date-hopping; supports the date-header
  approach over a picker.
- **Duolingo** ([Streak wiki](https://duolingo.fandom.com/wiki/Streak)) — rejected its
  XP-to-today attribution: mezo is single-user, no leaderboard/quest comparison, so
  truthful yesterday attribution wins; its no-retro-streak stance matches our accepted
  rollover nuance.
- **Apple Fitness** ([support](https://support.apple.com/en-us/101952)) — rejected the
  hard refusal of retroactive credit (widely hated), but its "closed rewards stay
  append-only" instinct informs the streak nuance we accept.

## Codebase terrain

- Gate + flow: `backend/.../habit/service/HabitService.java` — `requireManualToday`
  :388-395, `check()` :142-159 (trap: `ensureRows(now)` :146 + bare `orElseThrow`
  :149 + `HABIT_ALREADY_DONE` on any non-pending :150), `uncheck()` :161-180,
  `complete()` :296-308 (occurredOn already row-borne), `ensureRows` :314-349,
  `closePast` :227-276; `HabitJob.java` :28-38 (nightly cron; also inline on today
  `getDay`).
- Progression/gamification: `ProgressionService.java` `applyHabit` :227-236, `award`
  :425-490 (idempotent per habit_day row; `occurred_on` written :482),
  `revertHabit` :273-283; `GamificationService.getDay` :64-97 (sums by occurred_on);
  `GamificationAccountAdapter` :51-97 (streak rollover guard).
- Contract: `api/feature/habit/habit.yml` :22-56 (date already on the wire).
- FE: `NapRutinPage.tsx` :63-69 (hardwired today), `RutinHubPage.tsx` :57-60/:90/:184
  (read-only past arm, untouched), `habitHooks.ts` :49-61 (date-agnostic mock day),
  :97-160 (actions already date-threaded; mock check credits today's ledger).
- Tests: `HabitServiceIT.java` :185/:211/:232/:247, `HabitJobIT.java`,
  `HabitApiIT.java`, `ProgressionHabitIT.java`, `support/populator/HabitPopulator.java`.
- Conventions: tunables in `HabitProperties` (`mezo.habit.*`); 409 via
  `conflict(code)`; mock mirrors error codes as `Error('<CODE>')`; ArchUnit layer
  subpackages; codemap freshness gate; FE both test modes.
