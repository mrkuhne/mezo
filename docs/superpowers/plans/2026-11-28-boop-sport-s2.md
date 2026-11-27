# Boop Sport S2 — the Sport read models (server) · `mezo-r36n9.202`

> Step S2 of [the slice map](2026-11-27-boop-sport-slice-map.md) (approved 2026-11-27, no extra owner OK), spec
> [`2026-11-27-boop-sport-design.md`](../specs/2026-11-27-boop-sport-design.md) §5.7, §6, §7. Backend only.
> Driven inline (TDD), one branch `feat/boop-sport-s2`.

**Goal:** five read-only endpoints under `/api/train/sport/…` that give the phone's Sport area (S3) everything it
draws: the week's two lanes, tonight's moment (incl. the unmatched Watch workout for pre-fill), 6-week load on one
scale, the body heat for gym + sport, the shoulder line, the rest gap between the two layers and Boop's hints.
**No invented numbers:** an unknown effort / duration / kind is `null` or "no heat", never a guess.

## Architecture

- Package `feature/train/service/sport/` (new): pure rule classes + one read service per endpoint group.
  - `SportWeek` (pure) — ISO week (Mon–Sun) of an instant in the owner's zone; `?week=` takes any date of the week.
  - `SportLoadRule` (pure) — **the one load scale (session-RPE × minutes, Foster 2001).** Sport: `rpe` (else the
    1–10 `intensity`) × `durationMin`; either missing → unknown. Gym: session RPE = mean of `10 − RIR` over the
    session's done working sets (logged RIR, else the exercise's target RIR), × the session's minutes (the same
    minutes rule as the energy model: active seconds → start/finish span → default). No done working set → unknown.
  - `SportMuscleTable` (pure) — sport kind → per-muscle weight 0–1 on the catalogue's fine tokens; `other` and any
    unknown kind → empty (no heat).
  - `SportWorkoutKinds` (pure) — moved from `boop/service/BoopWorkoutKinds` (train must not import boop) + the
    reverse `sportOf(activityType)`.
  - `SportInterference` (pure) — the heavy-session rule and the 14-day decline-pair count extracted from
    `character/detector/SportInterferenceDetector` (the detector now calls it) + the gap thresholds.
  - `SportReadService` — overview, load, body, shoulder, gaps; reads `WorkoutWindowQueryService.windowsFor(user,
    from, to)` (THE resolver — no second one), `PlannedSkipService.verdictsBetween` (SPORT skips), sport sessions,
    done gym instances + their sets, and Health workouts through a port.
- Port `train/port/SportHealthPort` (Health workouts of a range) — adapter `wearable/service/SportHealthAdapter`
  (wearable → train already exists; train → wearable would be a cycle).
- `WorkoutReconciler` SPORT branch fixed: a logged sport pairs with that sport's own Health type
  (`SportWorkoutKinds.fitsSport`) or Health `other` — no longer the strength set for non-volleyball.
- Controller `train/controller/SportReadController implements SportApi`; contract `api/feature/train/train-sport.yml`
  (tag `Sport`), appended to `api/generate/merge.yml`, `api/openapi.yml` regenerated.

## Rules decided here (written into `docs/features/train.md`)

- **Load:** session-RPE × minutes for both layers (above). Resistance-training session-RPE is validated (Day et al.
  2004; Sweet et al. 2004); the per-set `10 − RIR` mean is our stand-in for the session rating, documented as such.
- **Body heat:** per muscle, sport = weight × session load; gym = the session load split over its muscles by share of
  done working sets. Each layer's level = value ÷ the layer's top muscle; *together* = (gym + sport) ÷ the top
  combined muscle — one scale, capped at 1.
- **Gap hints (re-checked 2026-11-28):** Robineau et al. 2016 (JSCR, 0 / 6 / 24 h) — < 6 h between contradictory
  sessions should be avoided; the meta-analytic interference shows within short gaps (Sports Med 2021: < 20 min
  same-session, not beyond ~2–3 h). So: gap < 3 h → `GAP_TIGHT` (watch), 3–6 h → `GAP_SHORT` (info), ≥ 6 h nothing.
- **Leg morning:** a sport day followed by a gym session before 12:00 the next day whose plan hits quad / ham /
  glute / calf → `SPORT_BEFORE_LEG_MORNING`; `heavy` = the logged session met the detector's heavy rule.
- **Decline pattern:** ≥ 2 heavy-sport → next-day rep-decline pairs in the 14 days to the week's end →
  `SPORT_LOAD_DECLINE` (same numbers as the character detector).
- **Week count:** `null` when the week has no sport rhythm (no slot, no event, no log); planned = slot + event
  occurrences (a skipped one included), done = logged sport sessions.

## Tasks (TDD — failing test first each time)

1. Pure units: `SportWeekTest` (Sunday 23:30 local = this week, Monday 00:30 local = next week, even when UTC
   disagrees), `SportLoadRuleTest`, `SportMuscleTableTest`, `SportInterferenceTest` (+ detector still green),
   `SportWorkoutKindsTest` (moved).
2. Contract `train-sport.yml` → merge → regenerate → `SportReadController` stub; 401 IT.
3. `SportReadService` + port + adapter; `SportReadContractIT`: empty user on all five (200, week count null, lists
   empty), a fixture week (gym + volleyball) for lanes / totals / load / body / shoulder / gaps, pre-fill only for an
   unmatched volleyball workout of today, a logged one moves to `DONE`, a skip shows `SKIPPED` with its reason.
4. Golden unit test of `load` + `body` numbers for a fixed fixture (pure assembler).
5. Reconciler SPORT fix + test.
6. Docs: `train.md` (rules + endpoints), `boop-ios.md` pointer, `_funkciok.json` rows, `_jegyek.json`,
   `_kiadasok.json`, feature index row; gates; merge; deploy check; live check (401 without token, 200 read-only via
   a token-less health probe is not possible — check the route exists via 401 and the pod log).

## Kész, ha… (from the slice map §S2)

- [ ] each endpoint has a contract IT incl. an empty user (no rhythm → week count `null`, lists empty, never 500)
- [ ] week boundaries in the owner's zone (`mezo.wearable.zone`): Sunday 23:30 local is still this week (test)
- [ ] the pre-fill block appears only for an unmatched volleyball workout of today; a matched one moves to „done" (IT)
- [ ] `load` and `body` numbers are deterministic for a fixture week (golden unit test); the conversion rule is
      written in `docs/features/train.md`
- [ ] gates as S1 (focused ITs + `ArchitectureTest` with Testcontainers, `check-ios-contract`, `gen-codemap`,
      `lint-docs`); `_funkciok.json` rows for the new endpoints; merged + deployed
