# 0004 — Train owns the weekly training schedule; Fuel is a secondary editor

- **Status:** Accepted
- **Date:** 2026-07-02
- **Driver:** mezo-ut1 (Fuel roadmap P0a)

## Context

Two surfaces show the weekly training schedule. Train already OWNS the real one:
`gym_schedule_slot` + `sport_schedule_slot` tables, `GET/PUT /api/train/{gym,sport}-schedule`,
`useTrain().saveGymSchedule/saveSportSchedule`. Fuel's Terv page (`FuelPlanPage` +
`GymScheduleSheet`) edits a private, never-persisted mock (`fuelWeek.ts` `gymSchedule` +
`today.ts` `volleyballSessions`) — edits vanish on reload. The shapes differ: Fuel's
`GymScheduleDay` carries type+duration, Train's slots carry `dayOfWeek`+time
(`trainHooks.deriveGymSchedule` already bridges one direction).

Without a decision, the Fuel P4 (Terv) and P5 (Mai timeline) slices would be tempted to
create a duplicate `fuel_gym_schedule` table and silently fork the schedule.

## Decision

**Train is the single owner of the weekly training schedule.** Fuel is a secondary
editor/consumer: `GymScheduleSheet` writes through to Train's `PUT /api/train/gym-schedule`;
Fuel reads via `useTrain()` (bridging shapes with `deriveGymSchedule` or an extension of it).
No Fuel-owned schedule table, ever.

## Consequences

- P4 (Terv) and P5 (Mai merged timeline) consume Train's schedule directly; one edit surface
  updates every view (Terv grid, Mai timeline, Today).
- The `GymScheduleDay` (type+duration) ↔ `GymScheduleSlot` (day+time) shape bridge must be
  built/extended in P4 — if Fuel needs type+duration on the grid, `gym_schedule_slot` gets the
  columns (Train-owned migration), not a parallel table.
- Cross-feature read direction Fuel→Train is sanctioned (same direction as recipe→meal_item).
- `mezo-m1l` (real volleyball ambient into GoalTimeline) follows the same ownership rule.

## Alternatives considered

- **Fuel-owned `fuel_gym_schedule` copy** — rejected: two sources of truth for one fact; every
  edit surface would need sync logic.
- **Config-file schedule (no table)** — rejected: Train's schedule tables already shipped and are
  edited from the Train UI.
