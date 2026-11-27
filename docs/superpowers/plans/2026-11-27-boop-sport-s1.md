# Boop Sport S1 — gym and sport as two layers, eleven kinds (build plan)

> Step S1 of [`2026-11-27-boop-sport-slice-map.md`](2026-11-27-boop-sport-slice-map.md) (owner OK on the map,
> 2026-11-27 — no separate plan OK). Spec: [`2026-11-27-boop-sport-design.md`](../specs/2026-11-27-boop-sport-design.md)
> §5.7 + §8. Issue `mezo-r36n9.201`, branch `feat/boop-sport-s1`. Backend only — nothing visible changes in the app
> until S3, except that a logged volleyball no longer ticks the gym on the morning brief.

## Decisions taken while planning (builder's call, spec §6)

- **The eleven kinds** = the log's ten (`volleyball cross trx bike swim football basketball tennis hike other`) +
  **`running`** (spec Q1 „running = journal + schedule", §5.8 „running as a kind everywhere"). The same CHECK and the
  same API pattern on `sport_session`, `sport_schedule_slot` and `sport_event`. `running` gets its own MET row
  (copy of `run`) so a logged run is not billed at the `other` fallback.
- **Kind matching for done** (pure `BoopWorkoutKinds`): gym ← Health `strength` / `traditionalstrengthtraining` /
  `functionalstrengthtraining`; sport ← the sport's own Health type (`volleyball`; `running`; `bike`→`cycling`;
  `hike`→`hiking|walking`; `swim`→`swimming`; `football`→`soccer`; `basketball`; `tennis`;
  `cross|trx`→`hiit|highintensityintervaltraining|crosstraining`). Health `other` ticks neither — too ambiguous to
  tick a plan with.
- **`BoopDay.sport[]`** comes from `WorkoutWindowQueryService.windowsFor` (the one resolver of slots + events − skips,
  logged session = done); a not-logged window turns done on a fitting Health workout ≥ 20 min overlapping ±2 h.
- **„Sport today" on the Edzés day** = `WorkoutTodayResponse.sportToday[]` (sport, time, durationMin, done), filled
  in the controller from the same resolver (WorkoutService ↔ WorkoutWindowQueryService would be a cycle).
- **Menu**: `DayFrame` / `DayBudget` carry every sport start; `MenuPlanner.withPreSession` marks or adds one
  pre-session snack per window (a window already pre-marked is not reused).

## Tasks (TDD — failing test first each time)

1. **Kinds widened.** Test: `SportContractIT` / `SportEventContractIT` — slot + event with `running`, `football`,
   `other` save and read back; `race` is 400; a sport log with `running` saves. Then: Liquibase
   `1.1.0/script/202611271200_mezo-r36n9.201_sport_kinds_widen.sql` (drop + re-add the three CHECKs) + master entry;
   `train.yml` patterns + descriptions; entity comments; `met.running`; regenerate `api/openapi.yml`.
2. **Gym and sport tick apart.** Test: `BoopSportLayerIT` — gym 07:00 + volleyball slot 18:00: logged volleyball →
   `sport[0].done`, `session.done == false`; finished gym instance → `session.done`, `sport[0].done == false`;
   volleyball Health workout 18:00–19:30 → sport done, gym not; strength workout 07:00–08:10 → gym done, sport not.
   Unit `BoopWorkoutKindsTest`. Then: `BoopDay.Sport` + `sport` field (old constructors kept), `markDone` by kind,
   `sport(...)` in the assembler, `BoopSport` in `boop.yml` + `BoopDay.sport`, MapStruct maps it, brief hash covers it.
3. **Every sport window feeds the menu.** Test: `MenuPlannerTest` — two sport starts → two pre-session snacks;
   `MenuServiceDayTest` (or in `MenuPlannerTest`) — a `DayFrame` with two windows maps to a `DayBudget` with both.
   Then: `DayFrame.sports`, `DayBudget.sports`, adapter collects all, planner loops.
4. **Sport today on the Edzés day.** Test: `TodaySportIT` — rest day with a volleyball slot today →
   `GET /api/train/workouts/today` has `sportToday[0].sport == volleyball`, time, not done. Then: contract + controller.
5. **Gates + docs.** Focused ITs + `ArchitectureTest` (`-Dmezo.test.use-testcontainers=true`),
   `check-ios-contract`, `gen-codemap`, `lint-docs`; `docs/features/train.md`, `docs/features/boop.md` (or the boop
   section that documents the brief day), `_funkciok.json` if a row changes, `_kiadasok.json` at merge.

## Kész, ha… (copied from the slice map §S1)

- [ ] a slot and an event with kind `running`, `football`, `other` save and read back (contract IT); an unknown kind is 400
- [ ] a day with gym 07:00 + volleyball 18:00: logging the volleyball leaves the gym session not done, and vice versa (IT)
- [ ] a volleyball Health workout ticks the sport, a strength workout ticks the gym (IT with fixtures)
- [ ] a day with two sport windows gives two pre-session snacks in the menu source (unit test)
- [ ] focused ITs + `ArchitectureTest` green with `-Dmezo.test.use-testcontainers=true`; `check-ios-contract` green;
      codemap regenerated; `lint-docs` 0/0; `docs/features/train.md` + `boop` doc updated
- [ ] merged, `deploy` green for the commit, prod `\d sport_schedule_slot` shows the widened CHECK
