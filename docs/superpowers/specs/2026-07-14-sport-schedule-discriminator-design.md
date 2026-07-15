# Sport discriminator on the weekly sport schedule — Design

**Date:** 2026-07-14
**Driving bd:** mezo-05v6
**Status:** approved-pending-review
**Driving need:** `sport_session` was generalized to 3 kinds in mezo-lmox (volleyball | cross | trx)
and `SportLogSheet` can log all three, but the **weekly plan side never followed**:
`sport_schedule_slot` has no sport field (its `kind` is only training | match), and the whole FE
chain — `SportScheduleSheet`'s one-draft-per-day model, `toSportSchedule`, the agenda's single
`WeeklyAgendaDay.volleyball` field — assumes **max one slot per day, always volleyball**. So the
user's real weekly rhythm (recurring **Tue/Thu 12:00–13:00 TRX at Life1 Corvin**, alongside
volleyball on other days) cannot be scheduled and never appears in `Heti terv` or the `Mai` agenda.
The user also wants **multiple sports on the same day** to be schedulable.

## Decisions (made with the user)

1. **Model = extend the existing discriminator pattern, not per-sport child entities.** (User picked
   over "per-sport detail tables" and "sport reference table + jsonb effort".) `sport_session`
   already works this way — one table, `sport` discriminator, sport-specific fields optional
   (volleyball: `sets_played`/`shoulder_strain`; cross/trx: `rounds`). The schedule slot gets the
   same treatment: a `sport` column on `sport_schedule_slot`, default `volleyball`. For a
   single-user app with 3 sports, table-per-sport is overkill; a new sport later = CHECK extension
   + optional columns.
2. **Editor UI = per-day slot list.** (User picked over a flat week-wide slot list.) The
   `SportScheduleSheet` keeps its day-by-day frame, but each day holds a **list of slots** with a
   "+ Sport hozzáadása" button; every slot carries its own sport selector (Röpi | Cross | TRX, the
   `SportLogSheet` chip idiom), time, duration, location, intensity. The week-at-a-glance mental
   model survives, and a day can hold any number of slots (including two of the same sport).
3. **`kind` (training | match) stays volleyball-only.** No DB change; cross/TRX slots always send
   `training` and the selector is hidden for them. (Claude's call, user-vetoable — not vetoed.)
4. **No renames in this change.** The `SportSchedule.volleyball` container key and the
   `VolleyballSession` type name stay, even though the plan is now mixed-sport — renaming is
   cosmetic churn across the mock fixture + 4-5 files, deferred as a possible follow-up. (Claude's
   call, user-vetoable — not vetoed.)
5. **Done-state matches by date AND sport.** A day's TRX slot flips to `✓ Kész` only when a
   `sport === 'trx'` session is logged on that date. The current date-only matching would produce
   false positives on mixed days.

## Data model (DB + backend)

- New changeset `{YYYYMMDDHHMM}_mezo-05v6_sport_schedule_slot_sport.sql` (12-digit UTC timestamp
  assigned at implementation time):
  `ALTER TABLE sport_schedule_slot ADD COLUMN sport TEXT NOT NULL DEFAULT 'volleyball'` +
  `ck_sport_schedule_slot_sport` CHECK (`volleyball|cross|trx`) — the exact token set of
  `ck_sport_session_sport`. Existing rows become volleyball via the default; no backfill.
- **Multiple slots per day need no DB work** — the table has no per-day unique constraint; only the
  FE chain limited it.
- `SportScheduleSlotEntity` gains the `sport` field. `replaceSchedule` (full soft-delete +
  re-insert via `PUT /api/train/sport-schedule`) is mechanically unchanged; the service defaults a
  null input sport to `volleyball` (mirroring `SportSessionCreateRequest.sport`).

## API contract (contract-first: `api/feature/train/train.yml`)

- `SportScheduleSlotInput.sport?` — optional, pattern `volleyball|cross|trx`, server-default
  volleyball.
- `SportScheduleSlotResponse.sport` — required.
- Regenerate: merge (`api/generate`) → FE `api.gen.ts` → BE generated DTOs.

## FE data layer

- `VolleyballSession` gains an **additive optional** `sport?: 'volleyball' | 'cross' | 'trx'`
  (absent = volleyball) — the Phase-1 mock fixture stays byte-identical, same idiom as the earlier
  `flex?` addition.
- `toSportSchedule` passes `sport` through onto each mapped session.

## Editor (`SportScheduleSheet`)

- Day draft model becomes **day → slot list**: each day renders its slots + "+ Sport hozzáadása";
  a slot row = sport chip selector (Röpi | Cross | TRX) · `type="time"` input · duration stepper ·
  location · intensity.
- The **training | match selector renders only when `sport === 'volleyball'`**; cross/TRX slots
  submit `kind: 'training'`.
- Save stays full-replace; mock-gating unchanged (entry points hidden in mock mode).

## Mai agenda + Heti terv views

- `WeeklyAgendaDay.volleyball: VolleyballSession | null` → **`sport: VolleyballSession[]`** (the
  `running[]` pattern). This is a component-local interface field, not the domain type — it does
  not conflict with decision 4. `agenda.ts` `daySessions` flattens the array; time-of-day ordering
  is untouched.
- `TrainTodayPage`: one sport hero / weekly-row entry **per slot**; the tag label derives from the
  sport (Röpi / Cross / TRX) while the `.typetag-sport`/`.stag-sport` styling stays shared.
- Done-state per decision 5 (date + sport matching), both for today's hero and past weekly rows.
- A slot's log CTA opens `SportLogSheet` **pre-selected to the slot's sport** (new `initialSport`
  prop).
- `SportPage` `SportWeekView`: `sessions.find(day)` → `filter(day)` — multiple rows per day, each
  tagged with its sport.

## Testing

- **BE IT** (`ApiIntegrationTest` level): schedule replace with sport (default applied when
  omitted; invalid sport → 400; mixed-sport multi-slot day round-trips); `SportSchedulePopulator`
  extended.
- **FE** (both modes green + build): `SportScheduleSheet` (multiple slots per day, sport selector,
  kind hidden for TRX), agenda flattening of a multi-sport day, done-state date+sport matching.

## Documentation

- `docs/features/train.md` §2 (Sport page, Mai agenda) + §4 (sport tables/DTOs) updated in the same
  change; `node scripts/lint-docs.mjs` green.

## Out of scope

- Renaming `SportSchedule.volleyball` / `VolleyballSession` (decision 4 — possible follow-up).
- Any change to `sport_session` / logging (already generalized in mezo-lmox).
- Per-sport slot detail tables, sport master-data table (decision 1 alternatives, rejected).
