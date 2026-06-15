# Weekly gym times + time-ordered Mai agenda — Design

**Date:** 2026-06-15
**Driving bd:** mezo-auk
**Status:** approved-pending-review
**Driving need:** On the **Mai** tab the weekly agenda combines gym + futás + sport, but
**gym days have no time-of-day** (`deriveGymSchedule` hardcodes `time: null`) and the within-day
order is a fixed `gym → volleyball → running`. So a morning run (08:00) renders *below* an evening
gym, and the user has no way to say *when* they train. The user wants to (a) set their gym times and
(b) have the day ordered by actual time, with each session's time shown.

## Decisions (made with the user)

1. **Scope = full** (user picked over "just gym time" / "just agenda fix"): editable gym time **+**
   show running time on the agenda **+** order each day by time-of-day.
2. **Gym time lives in a standalone weekly schedule, not on the mesocycle day** (user picked
   **Option Y** over Option X after a side-by-side mockup). Rationale: gym *content* changes per
   mesocycle (Plyo Power now, something else next block) but the *time* (e.g. evening) is a stable
   habit. A standalone schedule **persists across mesocycles** — set once. This mirrors the existing
   **volleyball** `SportScheduleSlot` recurring-schedule pattern, not the running "time on the plan"
   pattern.
3. **The gym schedule is lean: weekday → time only.** The gym *content/duration/whether-you-train*
   comes from the active mesocycle; the slot only answers "*when* on this weekday". So
   `GymScheduleSlot = { dayOfWeek, time }` — no duration/kind/location (unlike `SportScheduleSlot`,
   whose volleyball sessions are standalone).
4. **Join model:** `deriveGymSchedule(meso, gymSlots)` — the meso day (what) is matched to the gym
   slot (when) by weekday. A slot with no meso gym day that weekday shows nothing (the meso decides
   *whether* you train); a meso gym day with no slot shows with `time: null` (graceful).
5. **Untimed sessions sort to the bottom** of the day (string compare on `HH:mm`, null last).

## Architecture & data flow

```
GymScheduleSheet (edit weekly times)
  └─ PUT /api/train/gym-schedule  (replace-all, owner-scoped)
        └─ gym_schedule_slot table

Mai agenda:
  useTrain() → gymSchedule = deriveGymSchedule(activeMeso, gymSlots)   // join meso-days × slots
  TrainTodayView:
    daySessions(agendaDay) → [{kind, timeOfDay, …}]  sorted by time    // shared ordering helper
      • today heroes  (gym / volleyball / running) rendered in time order
      • weekly rows   (WeeklyDayRow) rendered in time order, running time shown
```

`GymScheduleSlot` mirrors `SportScheduleSlot` (an owner-scoped, weekday-keyed recurring schedule),
minus the volleyball-specific columns.

## Backend (house standards: liquibase / spring / contract-first / integration-test refs)

- **Liquibase** `{ts}_mezo-auk_create_gym_schedule_slot.sql`: table `gym_schedule_slot` with
  `OwnedEntity` columns (`id uuid PK default gen_random_uuid()`, `created_by uuid NOT NULL`
  FK→`app_user`, `is_deleted boolean`, `created_at`) + `day_of_week int NOT NULL`
  (`ck_gym_schedule_slot_day_of_week` CHECK 0–6) + `time varchar(5) NOT NULL`. **Unique**
  `uq_gym_schedule_slot_created_by_day_of_week (created_by, day_of_week)` (one slot per weekday).
  Explicit constraint names per `liquibase_conventions.md`.
- **Entity** `GymScheduleSlotEntity extends OwnedEntity` (mirror `SportScheduleSlotEntity`):
  `dayOfWeek`, `time`. **Repository** `findByCreatedByAndDeletedFalseOrderByDayOfWeekAsc`.
- **Service** `GymScheduleService` (or method on the relevant train service): `list(userId)` and a
  **replace-all** `replace(userId, List<GymScheduleSlotInput>)` — delete-then-insert the owner's
  slots in one `@Transactional` write, mirroring how sport-schedule PUT works. Ownership stamped
  server-side; never from the client.
- **Controller**: implement the generated `GET /api/train/gym-schedule` (list) + `PUT` (replace-all),
  using `api.dto` models. **Mapper** (MapStruct) entity↔DTO.
- **Seed**: optional `@Profile("demodata")` demo slots (a couple of weekday times). **Tests**: new
  `GymSchedulePopulator` + add `gym_schedule_slot` to `ResetDatabase` TRUNCATE list
  (`integration_test_framework.md`).

## API contract (contract-first — edit YAML before code)

`api/feature/train/train.yml`:
- `GymScheduleSlotResponse` = `{ id uuid, dayOfWeek int 0–6, time '^\d{2}:\d{2}$' }`.
- `GymScheduleSlotInput` = `{ dayOfWeek int 0–6, time '^\d{2}:\d{2}$' }`.
- `GET /api/train/gym-schedule` → `array<GymScheduleSlotResponse>`; `PUT` body
  `array<GymScheduleSlotInput>` → returns the new list. Mirror the `sport-schedule` paths.

Merge (`api/generate`) → regen FE (`pnpm generate:api`) + BE (generate-sources).

## Frontend

- **Types**: `GymScheduleSlot = { dayOfWeek: number; time: string }` (+ the API adapter in a
  `gymScheduleApi`-style client, or fold into the existing train client).
- **Data layer** (`trainHooks.ts`): fetch gym slots (real via the client / mock static),
  expose a `saveGymSchedule` mutation (mirror `saveSportSchedule`), and change
  `deriveGymSchedule(meso)` → `deriveGymSchedule(meso, gymSlots)` so the weekly slot's `time` fills
  `weeklyTimes[].time` (replacing the hardcoded `null`). Mock mode mirrors with a static slot list.
- **Editor**: new `frontend/src/features/train/components/GymScheduleSheet.tsx` (mirror
  `SportScheduleSheet`) — 7 weekday rows, each a `type="time"` input (16px to avoid the iOS zoom we
  already disabled globally); save → `saveGymSchedule`. **Entry point**: an "Időpontok" chip in the
  `GymView` page-header. (NB: a `fuel/GymScheduleSheet.tsx` already exists in the **fuel** domain —
  keep the new one under `train/`; no name clash across folders, but verify imports.)
- **Agenda ordering**: a pure helper `daySessions(day: WeeklyAgendaDay): AgendaItem[]` that flattens
  `{gym, volleyball, running[]}` into typed items carrying `timeOfDay` and sorts ascending (null
  last). Consumed by:
  - `WeeklyDayRow` — render the sorted items (instead of fixed gym→vb→run JSX); the running item now
    shows its `timeOfDay`.
  - `TrainTodayView` — render today's hero cards in the same sorted order (morning run hero above
    evening gym hero).

## Testing

- **Backend IT** (`ApiIntegrationTest`): `gym-schedule` GET empty, PUT replace-all round-trip, PUT
  overwrites prior slots, ownership isolation, day-of-week CHECK / pattern validation. Via
  `GymSchedulePopulator`.
- **Frontend** (both modes green): `deriveGymSchedule` join (slot time fills the matching meso day;
  no slot → null; slot without meso day → absent), the `daySessions` ordering helper (time sort,
  null last), `GymScheduleSheet` save, `WeeklyDayRow` renders items in time order with running time
  shown.
- Full backend suite + FE both modes + build green before push.

## Out of scope / known limitations

- Gym **duration** in the agenda stays `null` (today's behavior) — not part of this feature.
- The today **hero** for gym still requires the `/today` workout to exist (unchanged); only its
  ordering relative to other heroes changes.
- No per-week gym time overrides (the schedule is one time per weekday, by design).

## Docs to update on completion

- `docs/features/train.md` — gym schedule slot aggregate, the join, agenda time-ordering.
- `docs/features/_platform-api-backend.md` / `_platform-data-layer.md` — new endpoint + hook wiring.
- This spec is the record of the X-vs-Y decision (no separate ADR).
