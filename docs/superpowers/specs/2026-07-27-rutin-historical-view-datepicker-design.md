# Rutin historical read-only view + reusable DatePicker (design spec)

- **Date:** 2026-07-27 · **bd:** `mezo-mpd0` (this feature) · follow-up `mezo-x9c2` (retroactive yesterday-logging, deferred) · **Feature doc:** [habit.md](../../features/habit.md)
- **Source:** owner (Daniel) request — on the `/me/growth` „Rutin" tab you cannot look back at past days; you should default to today but jump between days with a date picker, to review how the routine went historically. Retroactive logging (separate concern) capped at the previous day, deferred.
- **Decided with Daniel in-session** (2 browser-mockup rounds via the visual companion, 2026-07-27): **B = day-focused past view** (aggregates replaced by an aznap-summary on past days); **arrows + a tappable themed calendar** date picker (not the OS-native input); quiet empty state for days with no data. Also: the date picker must be a **reusable shared primitive** (his standing preference — recurring widgets belong in `shared/ui`, identical behavior everywhere).
- Builds on the habit engine ([habit.md](../../features/habit.md)) and the data layer's already-date-parameterized `useHabitDay(date)` / `GET /api/habit/day/{date}`.

## 1. Goal

Make the Rutin tab (`features/me/components/RoutinesTab.tsx`) **date-navigable, read-only**: default to today, step day-by-day with prev/next, and jump to any past day via a tappable calendar. On a past day the view is **scoped to that day** (how the routine went), not the current-standing aggregates. Ship the calendar as a **reusable `shared/ui` primitive**. **No backend change** — the data layer is already date-parameterized.

## 2. Scope

**In scope (`mezo-mpd0`):**
- A reusable themed calendar primitive + a day-navigator composite in `shared/ui`.
- RoutinesTab date navigation + today/past-day/empty rendering branches (read-only).

**Out of scope (deferred → `mezo-x9c2`):**
- Retroactive logging/checking for yesterday (needs backend: re-derive a closed `habit_day`; relax `HabitService.requireManualToday`). The past-day view here is strictly read-only.
- Refactoring the 5 existing ad-hoc `<input type="date">` sites (LogDoseSheet, SleepLogSheet, BiometricSheet, GoalPlannerPage, MesocyclePlannerPage) to the new `DatePicker`. The primitive is *designed* drop-in for them, but swapping them is a separate cleanup.

## 3. New shared primitives (`frontend/src/shared/ui/`, domain-free)

### 3a. `DatePicker.tsx` — controlled themed calendar popover
The reusable core. **Not** the OS-native `<input type="date">` (platform-inconsistent, un-themable popover) — a custom mezo-themed month grid.

- **Props:** `value: string` (`YYYY-MM-DD`), `onChange(date: string)`, `maxDate?: string` (default `localDateString()` — days after are disabled), `minDate?: string` (optional floor), plus an optional `renderTrigger?` / `label?` so callers control the trigger's look (Rutin uses the DayNavigator's date label as trigger).
- **Behavior:** tapping the trigger opens a popover month grid; ‹ › switch month; today is ringed, `value` is filled; days `> maxDate` (and `< minDate`) are disabled/dimmed and non-selectable; selecting a day fires `onChange` and closes; closes on outside-click and `Esc`.
- **A11y:** `role="dialog"`/grid semantics, `aria-label`s on nav + days, focusable day buttons, `Escape` to close. Keyboard arrow-key day movement is a nice-to-have (include if cheap; not a blocker).
- **Theming:** mezo dark tokens (matches the approved mockup — filled selected in lavender, ringed today, dimmed disabled).
- **Self-contained:** no `@/data/*` import (domain-free per `shared/ui` rule). Date math via `@/shared/lib/dates` helpers (+ small local month-grid helper).

### 3b. `DayNavigator.tsx` — day-stepping composite
- **Props:** `date: string`, `onChange(date: string)`, `maxDate?: string` (default today), `minDate?: string`.
- **Renders:** `‹ prev | <tappable date label> | next ›`. `prev` steps −1 day (respects `minDate`), `next` steps +1 day and is **disabled at `maxDate`** (no future). The date label is the `DatePicker` trigger (tap → calendar). Label shows a friendly HU date (e.g. „Ma", or „júl. 20., hétfő") — „Ma" when `date === today`.
- Domain-free; used by RoutinesTab now, reusable by any day-scoped surface later.

## 4. `RoutinesTab` behavior

- Lift state: `const [date, setDate] = useState(localDateString())`; `const today = localDateString()`.
- Top: `<DayNavigator date={date} maxDate={today} onChange={setDate} />`.
- Chains driven by `useHabitDay(date)` (already date-parameterized). `useHabitSummary()` (aggregate, date-less) is only consumed when `date === today`.
- **Today (`date === today`) — unchanged:** the two perfect-day counters (`Tökéletes reggelek/esték · 30 nap`) + per-habit 28-day strength bars + status marks.
- **Past day (`date < today`) — day-scoped (mockup B):** replace the two counters with a per-day **summary chip** — `Reggel {done}/{n} · Este {done}/{n} · +{xp} XP` — computed FE-side from `habits` (count `status==='done'` per chain; `xp` = Σ of done habits' `xp`). Rows render **status mark + title only** (no strength bar). Missed rows dim (ADR 0010 tone — no red).
- **Empty day (`habits.length === 0`, past date):** quiet ghost „Nincs rutinadat erre a napra" (reuse the `GhostState` primitive if it fits).
- Read-only throughout — no check/log affordances on any day (matches current RoutinesTab, which is already display-only; interactivity is Today's `RoutineCard`).

## 5. Data flow — pure FE, no backend

- `useHabitDay(date)` real-mode → `GET /api/habit/day/{date}`; past days are returned **read-as-is** (already closed by the nightly `HabitJob`). Everything the past-day view needs (`status`, `xp`, `chain`) is on `HabitItem`.
- The summary chip is a pure FE reduction over `habits` — no new endpoint, no API-contract change, no backend work.
- **Mock-mode caveat:** `useHabitDay(date)` in mock ignores `date` (returns the static seed), so navigating in mock shows today's seed for every date. Accepted (mock has no history — consistent with the existing documented mock deviations). Tests assert the navigation + rendering branches, not mock history fidelity.

## 6. Testing (TDD; both modes green + build)

- `shared/ui/DatePicker.test.tsx`: renders the month grid for `value`; disables days `> maxDate`; selecting a day fires `onChange` with the ISO date and closes; closes on `Esc`/outside-click; respects `minDate`.
- `shared/ui/DayNavigator.test.tsx`: `prev`/`next` step ±1 day; `next` disabled when `date === maxDate`; tapping the label opens the picker; label reads „Ma" on today.
- `features/me/RoutinesTab.test.tsx` (extend/add): today shows aggregates + strength bars; a past date shows the day-summary chip + status-only rows (no strength bar); an empty past day shows the ghost; changing the nav date changes the `useHabitDay` argument (queried date).
- Gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

## 7. Docs

- Update [habit.md](../../features/habit.md): §2 (Rutin tab is now date-navigable with a day-focused past view) and §10 (file map += `shared/ui/DatePicker.tsx`, `shared/ui/DayNavigator.tsx`).
- Note the two new primitives in [_platform-design-system.md §1a](../../features/_platform-design-system.md) (shared/ui inventory).
- Run `node scripts/lint-docs.mjs`.

## 8. Deferred follow-up (`mezo-x9c2`)

Retroactive logging for **yesterday only** (max 1 day back): backend re-derivation of a closed `habit_day` on a backdated log + relaxing `requireManualToday` to allow yesterday; FE makes the yesterday view interactive. Explicitly out of this spec.
