# Train · Futás (interval running) slice — Design

**Date:** 2026-06-14
**Driving bd:** mezo-dy6
**Status:** approved-pending-review
**Driving need:** slot structured interval **running** into the weekly rhythm (alongside
3× volleyball + 3× gym). Running is unlike the ad-hoc volleyball log: it has a **progressive
multi-week plan** with per-session interval structure (warmup → sprint/walk rounds →
cooldown). The user wants to **plan and follow** blocks — the value is in scheduling ahead,
not in free-form "what did I just do" logging.

## Decisions (made with the user, incl. browser mockup rounds)

1. **New 6th Train tab: "Futás"** (`/train/futas`) — running earns its own home; the
   Sport tab stays clean for volleyball. (IA mockup, user picked own-tab over folding
   into Sport.) The Train subnav already scrolls horizontally (mask-image overflow), so
   6 tabs is fine.
2. **Plan-centric architecture, mirroring the mesocycle.** Running follows the *gym*
   pattern, not the *volleyball* pattern: a **plan ("Terv")** prescribes the sessions; you
   record **actuals against the prescribed session**. (User reframed mid-brainstorm — this
   supersedes an earlier "editable plan" framing.)

   | | **GYM (kondi)** | **Futás (new)** |
   |---|---|---|
   | Plan block | `Mesocycle` | **`RunningBlock`** ("Terv") |
   | Lifecycle | `planned → active → archived` | same |
   | Library | "Mesociklusok" tab | **"Tervek"** segment in Futás tab |
   | Builder | full-screen `/train/mesocycles/:id` | full-screen `/train/futas/:id` |
   | Weekly drive | active meso → gym days | **active block → week's run sessions** |
   | Logging | sets/reps/RIR vs prescribed day | **rounds/RPE/HR vs prescribed session** |

3. **Naming:** the plan/library is **"Tervek"** (a "Terv" each). Not "Blokk". (User picked
   over Programok / Ciklusok.)
4. **Creation = builder-first (no auto-generation).** `＋ Új terv` opens the full-screen
   Builder (blank or "duplicate & adjust" an existing block). No goal-preset planner yet,
   no AI generation (Phase 3). YAGNI. The current 8-week plan ships as **seeded demodata**
   (the active block).
5. **Futás tab = 3 segments (view-switcher):** `E heti edzés` (default) · `Napló` ·
   `Tervek`. The liked landing mockup *is* the "E heti edzés" segment.
6. **Mai = stacked hero cards** (user picked over a unified agenda card): on a multi-session
   day, gym (teal) + futás (blue) + röpi (pink) render as separate time-ordered hero cards;
   the weekly timeline rows gain a third running layer.
7. **Accent color: blue** (`--run` = the existing `--info` `#60A5FA` token) — distinguishes
   running from volleyball pink (`--cat-tendency`). No new token added to the palette;
   `--run` is an alias used in the Futás views.
8. **Cross-load → gym.** Sprint hamstring/quad eccentric load reduces gym leg volume
   (MAV −2), exactly like volleyball's existing cross-load. Surfaced in a Futás "Cross-load"
   sub-section and (Phase 3) fed into the volume engine. **For this slice it is presentational**
   (a derived, static note) — wiring it into live mesocycle volume targets is out of scope.
9. **Full-stack**, following the Phase 2 slice pattern: mock hooks first (FE untouched
   boundary in `src/data/hooks.ts`), then Spring Boot + Liquibase + OpenAPI contract-first.

## 1. Domain model

### Plan structure (the "Terv") — typed jsonb

A block's week→session→segment tree is **authored and read as a whole** (full-replace on
save, like `sport_schedule_slot`; never queried by individual segment). It is stored as
**typed jsonb** on the block, exactly the `MesocycleEntity.volumeRecompute` pattern
(`@JdbcTypeCode(SqlTypes.JSON)` onto a typed record, not `String`). This avoids a 3-table
week/session/segment hierarchy for data that is always loaded together.

```
RunningBlockStructure
  weeks: RunWeek[]
    weekNumber: int            // 1..N
    phaseLabel: string         // "Alapozás" | "Röpi-specifikus" | ...
    sessions: RunSession[]     // the *prescribed* sessions (usually 2)
      key: string              // stable within block, e.g. "tue-sprint" | "fri-pyramid"
      dayOfWeek: int           // 0=Hét..6=Vas (matches DAY_ORDER, like sport slots)
      label: string            // "Sprint-intervallum" | "Piramis-intervallum"
      kind: "sprint" | "pyramid" | "steady"
      rpeTarget: { min:int, max:int }   // 1..10
      segments: RunSegment[]   // ordered
        type: "warmup" | "work" | "rest" | "cooldown"
        durationSec: int
        label?: string         // optional override ("5 perc kocogás")
      rounds?: int             // for sprint kind: number of (work+rest) repeats
```

Sprint sessions = `rounds` × a (work,rest) pair; pyramid sessions = an explicit ordered
`segments` list (rest auto-derived = work × 2 in the seed, but stored explicitly so the
Builder can edit freely). The Builder edits `rounds` (stepper) for sprint and the segment
list (pills + "＋ szakasz") for pyramid.

### Entities

**`RunningBlockEntity`** (`feature/train/entity`) — the mesocycle analog. Extends
`OwnedEntity` (`createdBy`, `is_deleted`, `created_at`); UUID PK; `@SQLDelete`/`@SQLRestriction`
soft delete.

| field | type | notes |
|---|---|---|
| `id` | UUID | `@GeneratedValue` |
| `title` | String | "Robbanékonyság 01" |
| `goal` | String? | "sprint-állóképesség röpihez" |
| `kind` | String | `interval` for now (DB CHECK) — room for `base`/`tempo` later |
| `status` | String | `planned`/`active`/`archived` (DB CHECK), like mesocycle |
| `startDate` / `endDate` | LocalDate | |
| `weeks` | Integer | |
| `currentWeek` | Integer | default 0; derived/advanced like mesocycle |
| `structure` | `RunningBlockStructure` | **typed jsonb** (`@JdbcTypeCode(SqlTypes.JSON)`) |
| `summary` | String? | archived score note ("7/10 · pulzus-megnyugvás −18mp") |

**Invariant:** at most one `active` block per owner (same rule the meso lifecycle enforces;
activating one archives/None-conflicts handled server-side).

**`RunSessionLogEntity`** (`feature/train/entity`) — the logged actuals, the
`WorkoutSession` analog. Extends `OwnedEntity`; UUID PK; soft delete.

| field | type | notes |
|---|---|---|
| `id` | UUID | |
| `blockId` | UUID | FK → running_block (the plan it was run against) |
| `weekNumber` | Integer | which plan week |
| `sessionKey` | String | which prescribed session (`tue-sprint`) |
| `date` | LocalDate | |
| `completedRounds` | Integer? | actuals vs prescribed `rounds` |
| `rpeActual` | Integer? | 1..10 (DB CHECK), nullable |
| `hrRecoverySec` | Integer? | optional pulse-settle measure |
| `sprintLandmark` | String? | free text ("túl a 2. lámpaoszlopon") |
| `durationMin` | Integer? | |
| `notes` | String? | |

> Naming note: the gym already has a `WorkoutSessionEntity`; to avoid "SportSession" vs
> "RunSession" confusion the log entity is **`RunSessionLogEntity`** (table `run_session_log`),
> while the *prescribed* session lives only inside the block's jsonb (`RunSession` record).

### Liquibase

Two versioned changesets, bd-id feature segment, 12-digit UTC prefix, explicit constraint
names, **seed data in Java `@Profile("demodata")` — never SQL**:

- `2026061x_mezo-dy6_create_running_block.sql` — `running_block` (+ `ck_running_block_status`,
  `ck_running_block_kind`, `created_by` index).
- `2026061x_mezo-dy6_create_run_session_log.sql` — `run_session_log`
  (`fk_run_session_log_block`, `ck_run_session_log_rpe`, indexes).

Seed: a `RunningBlockSeedData` Java populator under `@Profile("demodata")` builds the active
8-week block (the user's plan verbatim: Kedd sprint 5→6→8→8 rounds, Péntek pyramid small→big
+ rest tightening across the 2 months) plus one `planned` and one `archived` example. A
matching `*Populator` for integration tests; new tables added to `ResetDatabase` TRUNCATE list.

## 2. API contract (contract-first — `api/feature/train/...`)

Edit the OpenAPI fragment **before** code; merge (`api/generate`); backend implements the
generated `TrainApi`, FE types from `src/lib/api.gen.ts`. Tag **Train**, auth like everything
(owner principal; `created_by` server-side).

| method | path | body / returns |
|---|---|---|
| `GET` | `/api/train/running-blocks` | `RunningBlock[]` (all statuses; FE buckets active/planned/archived) |
| `POST` | `/api/train/running-blocks` | create (Builder save) → `RunningBlock` |
| `PUT` | `/api/train/running-blocks/{id}` | full-replace block incl. `structure` → `RunningBlock` |
| `POST` | `/api/train/running-blocks/{id}/activate` | lifecycle → `RunningBlock` |
| `POST` | `/api/train/running-blocks/{id}/close` | → archived `RunningBlock` |
| `DELETE` | `/api/train/running-blocks/{id}` | soft delete |
| `GET` | `/api/train/run-sessions` | `RunSessionLog[]` (Napló) |
| `POST` | `/api/train/run-sessions` | log actuals → `RunSessionLog` |

`structure` serializes as a nested JSON object matching the model above. Numbers are plain
`integer`/`number` in the contract. The block `PUT` mirrors the meso write path (full object
replace, server re-derives `currentWeek`).

## 3. Frontend

**Single data boundary stays `src/data/hooks.ts`.** New hook surface on the existing
`useTrain()` (or a sibling `useRunning()`), mock-first then swapped to the real API with
**unchanged signatures**:

```
runningBlocks: RunningBlock[]
activeRunningBlock: RunningBlock | null     // derived
saveRunningBlock(block)                     // create/update (Builder)
activateRunningBlock(id) / closeRunningBlock(id)
logRunSession(actuals)
runSessions: RunSessionLog[]
```

**Routes & views** (mirror the mesocycle file layout under `features/train/`):

- `tabs.ts` — add `{ id:'futas', to:'/train/futas', label:'Futás' }` (6th tab).
- `views/RunningView.tsx` — the Futás tab shell: own `.page-header` (`Train · Futás` eyebrow
  + `INTERVALLUM` title + `＋ Új terv` chip), 3-button `--run`-accented view switcher.
  - **`E heti edzés`** (default): active block's current-week 2 session cards (interval pills,
    RPE tag) + cross-load note + per-session log entry. Ghost state when no active block.
  - **`Napló`**: `runSessions` list (RPE, rounds, HR-recovery), newest first.
  - **`Tervek`**: library — active hero (week strip + status + "Builder ▸"), planned cards
    (+ dashed `＋ Új terv` CTA), archived cards (summary score). Mirrors `MesocycleLibraryView`.
- `RunningBlockBuilder.tsx` — full-screen sibling route `/train/futas/:id` (NO subnav, own
  `← Futás` back header, status-aware eyebrow, `Hetek / Beállítás / Cross-load` switcher,
  status actions Duplikál / Aktiválás / Lezárás). Week list with the current week expanded;
  sprint sessions edit `rounds` via a stepper, pyramid sessions edit the segment pills
  (`＋ szakasz`). Mirrors `MesocycleBuilder`.
- `components/`: `RunSessionCard`, `RunIntervalPills`, `ActiveRunBlockCard`,
  `PlannedRunBlockCard`, `ArchivedRunBlockCard`, `RunLogSheet`, `RunWeekStrip` (the
  reta-bar-style 8-segment strip).

**Mai integration** (`TrainTodayView` + `WeeklyDayRow`): extend the agenda model with a
`running: RunSessionPrescribed | null` lane derived from the active block's current week
matched by `dayOfWeek`.
- Today: add a **blue `--run` hero card** (stacked, time-ordered with the existing gym +
  volleyball heroes) when a run session is scheduled today; CTA `＋ Naplózd a futást`.
- `WeeklyDayRow`: add a third stacked session row (run icon, `--run`), same divider pattern
  as the gym↔volleyball split. A triple-session day shows three rows in one day card.

## 4. Cross-load

Running contributes the same **muscle-load carryover** volleyball already does. The existing
mock `crossLoad` rows ("Sprintek + ugrások hamstring eccentric load") become **partly
running-attributed**. For this slice:
- Futás "Cross-load" builder sub-section + the "E heti edzés" note present a **derived static
  row** ("sprint eccentric → láb-volumen MAV −2").
- **Out of scope:** writing running load into live `volumePerMuscle` targets / the recompute
  engine. That joins the Phase 3 pattern engine, like the volleyball cross-load already does.

## 5. Scope

**In:** the 6th Futás tab (3 segments), full-screen Builder, RunningBlock + RunSessionLog
entities + Liquibase + demodata seed, the 8 REST endpoints (contract-first), mock hooks then
real API, Mai stacked-hero + weekly-row integration, presentational cross-load, both test
modes green + parity capture.

**Out (YAGNI / later):**
- Live interval **timer / "run mode"** (explicitly dropped — user chose follow+log, no timer).
- Goal-preset **planner** / AI plan generation (Phase 3).
- Cross-load **writing into** volume targets (Phase 3 engine).
- Device/watch HR & GPS import — `hrRecoverySec`/`sprintLandmark` are manual for now.
- PR/▒progression analytics over run logs.

## 6. Build sequence (slice map → becomes the plan)

1. **R0 · Contract + entities + migrations + seed** — OpenAPI fragment, `RunningBlockEntity`
   + `RunSessionLogEntity` + structure jsonb record, Liquibase, demodata seed + test populators,
   `ResetDatabase` update. Service + `TrainController` endpoints. Integration tests
   (`AbstractIntegrationTest`/`ApiIntegrationTest`).
2. **R1 · Mock hooks + Futás tab read** — `src/data/running.ts` mock + `hooks.ts` surface;
   `RunningView` with the 3 segments (read-only): E heti edzés + Napló + Tervek library.
3. **R2 · Builder + lifecycle write** — `RunningBlockBuilder`, create/duplicate, activate/close,
   `PUT` structure save; swap mock → real API (signatures unchanged).
4. **R3 · Mai integration** — running lane in the agenda, blue hero card, weekly-row third
   layer; `RunLogSheet` wired from Mai + Futás.
5. **R4 · Cross-load presentation + polish** — derived cross-load row, ghost/empty states,
   parity capture, both test modes green.

Each R-step is one bd issue under mezo-dy6 + one `feat/` branch.
