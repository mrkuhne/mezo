---
title: Life goals
type: feature-domain
status: in-progress
updated: 2026-09-03
tags: [me, growth, companion, backend, data-layer, frontend]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalProposePort.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LifeGoalProposeLlmAdapter.java
  - api/feature/lifegoal/lifegoal.yml
  - frontend/src/data/lifegoal
  - frontend/src/features/me/pages/CelokPage.tsx
  - frontend/src/features/me/pages/CelPage.tsx
  - frontend/src/features/me/pages/CelWizardPage.tsx
related: [goal-engine, growth, companion, me, today]
---

# Life goals — Feature Documentation

> One-line: general-purpose life goals ("Célok") at route `/me/goals` (tab "Én"), tagged to a
> PERMAH dimension and measured by 1–5 pillars drawn from a closed signal catalog.
> **Status: slice 1 of 3 (`mezo-iizd.1`) — ✅ backend CRUD/lifecycle/catalog/AI-propose done,
> ✅ FE hub/detail/wizard done (both modes); the scoring engine, the nightly job, and every
> derived number (arrows, "today" tile, XP, trigger firing) are 🔴 not built — every numeric
> slot in the FE is an honest `—` until slice 2.**

## 1. Summary

A life goal is free text ("Kockahas", "Side hustle az appból", "Az utolsó barátnő") the user
assigns to one of the six **PERMAH** dimensions (positive emotion · engagement · relationships
· meaning · accomplishment · health — health is PERMA's practical extension, kept under that
label) and backs with 1–5 **pillars**, each pointing at a signal the user is *already* logging
(sleep, meals, workouts, weight, check-ins, habits, ritual close, chat-derived activity log,
mentioned people) — there is no new logging surface. This is the general-purpose sibling of the
existing body-weight "Cél" (now at `/me/goals/weight`, see [`goal-engine.md`](goal-engine.md)),
which a life goal can reference as a `linked` pillar.

Driving design spec: [`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`](../superpowers/specs/2026-09-02-lifegoal-system-design.md)
(binding decisions D1–D10, prior art, the three-slice plan). Implementation plan:
[`docs/superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md`](../superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md).
Approved prototype (visual truth): [`docs/design_2.0/prototypes/celok.html`](../design_2.0/prototypes/celok.html).
ADR: [`0034-measurable-life-goals.md`](../decisions/0034-measurable-life-goals.md) — see §9.

**Status per layer, slice 1:**
- **Backend:** ✅ real — three tables (`life_goal`, `life_goal_pillar`, `life_goal_pillar_day` —
  the last exists but is unwritten until slice 2's job), full CRUD + status lifecycle (draft →
  active/parked/done/archived, **no cap on active goals**, D7), the closed 28-entry signal
  catalog + pillar validation, AI propose (companion port + LLM adapter + deterministic
  template fallback), a `demofixtures` seed of three goals + one parked.
- **FE:** ✅ the Célok hub (`CelokPage`), the goal detail page (`CelPage`), the five-step
  creation wizard (`CelWizardPage`) — both `pnpm test` (real) and `VITE_USE_MOCK=true pnpm test`
  (mock) green.
- **Deferred to slice 2/3** (§9): `LifeGoalScorer`, `SignalSource` port, `LifeGoalEvalJob`,
  `progress`/`today`/`signals`-liveness endpoints, the `JelekPage`, per-pillar/per-goal
  ↗/→/↘ arrows, XP award, if–then trigger evaluation + notifications, the Nap "Célok · ma"
  tile, the Heti goals card, the `[Célok]` companion prompt block, the knowledge-graph `GOAL`
  node, the Growth skill-row chip, and the Én-hub hero's goal-count line.

## 2. User-facing behavior

- **`/me/goals` → `CelokPage`** (`frontend/src/features/me/pages/CelokPage.tsx`) — the Célok
  hub. Hero: a six-arc `PermahRing` (`components/PermahRing.tsx`, one arc per dimension, lit
  where an active goal exists, center = active-goal count) + one Hungarian line (empty-state
  copy when there are no active goals, an honest "the arrow lands in slice 2" line otherwise).
  A dimension-chip band (`DIMENSION_ORDER`, empty dimensions render grey — no fabricated value).
  A `Mosaic` of one `LifeGoalTile` per **active** goal (`components/LifeGoalTile.tsx`) plus a
  dashed "＋ Új cél" tile. A parked-goals row below (`status='parked'` or `'draft'`) with a
  one-tap "Vissza" button that reactivates (`changeStatus(id, 'active')`). No "Jelek" row yet
  (`/me/goals/signals` is a slice-2 page per the spec, not linked from the hub in this slice).
- **`/me/goals/:id` → `CelPage`** (`pages/CelPage.tsx`) — the goal detail page. Hero: dimension
  icon, title, an em-dash in place of the (slice-2) arrow, and a subtitle line (dimension(s) ·
  date range · status). Pillar cards (`components/PillarCard.tsx`) — label, skill, kind chip,
  source description; no value/target/heatmap yet (`PillarCard`'s own honest-`—` contract). A
  "＋ Pillér" header action opens `PillarCatalogSheet` (`sheets/PillarCatalogSheet.tsx`) to add
  a pillar from the catalog (capped at 5, button disables at the cap). A "Miért · ha–akkor"
  section renders `whyText`, `obstacleText`, and each `ifThenPlans[]` entry — a plan with a
  `trigger` shows "Mezo figiyeli (\<source>)", a manual plan shows "nincs hozzá jel" (D9).
  Status actions at the bottom: Parkolás / Aktiválás / Lezárás / Archiválás, gated by the
  current status (see the status machine in §4).
- **`/me/goals/new` → `CelWizardPage`** (`pages/CelWizardPage.tsx`) — the five-step
  creation wizard (D8): **Cél** (title + why + optional target date) → **Keret** (fires
  `useLifeGoalPropose` exactly once on step 1→2 using title+why; shows Mezo's frame reading,
  an SDT reframe offer when `frame='extrinsic'`, and an editable dimension/secondary-dimension
  chip band seeded by the AI) → **Pillérek** (the AI's suggested pillars as on/off toggle cards,
  plus "＋ Pillér a katalógusból", capped at 5) → **Ha–akkor** (obstacle chips + editable
  ha/akkor plan cards, each footer naming its trigger or "nincs hozzá jelem · ezt te tartod") →
  **Összegzés** (a preview of the goal page — title, dimension chips, why quote, pillar list,
  plan list, and a prose "Aktiválás után" paragraph — never a computed number, per the
  honest-state house rule). Two CTAs on the last step: "Mentés tervezettként" (`activate=false`)
  and "Aktiválás" (`activate=true`, immediately calls `changeStatus(id, 'active')` after create).
- **`/me/goals/weight` (+ `/me/goals/weight/new`)** — the pre-existing body-weight goal
  (`GoalsPage`/`GoalPlannerPage`), unchanged in behavior, moved here in Task 8 so `/me/goals`
  could become the Célok hub. See [`goal-engine.md`](goal-engine.md) §2 and [`me.md`](me.md) §2.

## 3. Architecture & data flow

New backend slice `io.mrkuhne.mezo.feature.lifegoal` (`entity / repository / service /
controller / mapper / catalog / config`), gated end-to-end on `LIFEGOAL_SWITCH`
(`FeaturesConfiguration`). Read path: `view → useLifeGoals()/useLifeGoal(id) → useDualQuery →
lifegoalApi (real) | MOCK_LIFE_GOALS (mock) → LifeGoalController → LifeGoalService →
LifeGoalRepository → life_goal/life_goal_pillar`. Write path (create/update/status/pillars):
`useLifeGoalMutations() → lifegoalApi.<op> → LifeGoalController → LifeGoalService /
LifeGoalPillarService → repository`, with mock mode patching an in-memory
`['lifeGoals']` query-cache list instead (`lifegoalHooks.ts`).

**Dependency direction (spec §3, ArchUnit `feature_slices_are_cycle_free`):** `lifegoal` may
import `companion`, `progression` (`ProgressionTaxonomy` — skill-key validation), and `habit`
(`HabitCatalogService`, via `ObjectProvider`, for habit-key validation — degrades to "cannot
verify" → reject, rather than a hard Spring-context dependency, when `HABIT_SWITCH` is off).
**Nothing may import `lifegoal` back** — the AI propose seam is a port owned by `companion`
(`companion/LifeGoalProposePort.java`, implemented by `companion/llm/LifeGoalProposeLlmAdapter`)
that `lifegoal/service/LifeGoalProposeService` calls through an `ObjectProvider`, never the
other direction. This mirrors the `QuestLedgerSource`/`WeekReviewSource` port idiom used
elsewhere in the codebase (see [`_platform-api-backend.md`](_platform-api-backend.md)).

**Catalog validation** (`SignalCatalog`, `LifeGoalPillarService.validate`): every pillar's
`source` (type+key/skillKey+measure/ring) must exact-match one of the 28 closed
`SignalCatalogEntry` rows, and its `kind` must be one of that entry's allowed `kinds` — an
unknown source/skill/kind is rejected with a dedicated `SystemMessage` code (§4). This is the
**only** place a pillar can originate a signal; there is no free-text metric or external
integration (D3).

**AI propose, port-first-then-template** (`LifeGoalProposeService.propose`): if
`LifeGoalProposePort` has no bean (any of `LIFEGOAL_AI_PROPOSE_SWITCH` /
`COMPANION_SWITCH` / `LIFEGOAL_SWITCH` off) or the LLM call/parse fails or every proposed
pillar fails catalog validation, the service falls through to `LifeGoalTemplateProposer` — a
deterministic, dimension-keyed rule-based proposal. **The response is never empty** (spec §7).

**The propose response must be a LEGAL create request.** The wizard feeds it into
`POST /api/life-goals` verbatim, so anything the model over-produces would answer 200 on propose
and then 400 on save, dead-ending the wizard. `LifeGoalProposeLlmAdapter` therefore clamps
`pillars` to `maxPillars` and BOTH `plans` and `obstacles` to 5 (`LifeGoalUpsertRequest`'s
`maxItems`), and truncates the model's strings to the schema maxima (`label` 80, `ha`/`akkor`
240, obstacle 300); `LifeGoalProposeService.toResponse` re-checks each proposed `kind` against
its catalog entry's allowed `kinds()` — the same check `LifeGoalPillarService.validate` applies
on save — and drops a pillar that would fail it. A plan's `triggerSource` is whitelisted to
`sport_session_logged` / `checkin_energy_lte` / `ritual_missed`; anything else **nulls the
trigger but keeps the plan**, so the UI falls through to its honest "nincs hozzá jel" label
instead of promising „Mezo figyeli (<source>)" for a trigger nothing will ever evaluate.

## 4. Data model & API

Three tables (`db/changelog/1.0.0/script/…life_goal…sql`), all `OwnedEntity` (soft-deleted,
`created_by`-scoped):

- **`life_goal`** — `title`, `why_text`, `frame` (`intrinsic|extrinsic|unset`), `dimension` +
  nullable `secondary_dimension` (`ck_life_goal_dimension`, the six PERMAH keys:
  `positive_emotion|engagement|relationships|meaning|accomplishment|health`), `status`
  (`ck_life_goal_status`: `draft|active|parked|done|archived`, **no active-count cap**, D7),
  `start_date`, nullable `target_date` (`ck` target ≥ start), `activated_at`, `closed_at`,
  `obstacle_text`, `if_then_plans jsonb` (list of `{ha, akkor, trigger: {source, condition,
  delayHours} | null}` — `IfThenPlanJson`/`PlanTriggerJson`).
- **`life_goal_pillar`** — `goal_id` fk, `label`, `skill_key` (validated against
  `ProgressionTaxonomy` LIFE+ATHLETIC+MUSCLE+ROBUSTNESS), `kind` (`habit|average|target|
  baseline|linked` — the Strides-inspired taxonomy, D10), `weight int 1..3`, `position`,
  `active bool`, `source jsonb` (`PillarSourceJson`: `{type: metric, key}` ·
  `{type: activity, skillKey, measure: minutes|count|huf}` · `{type: habit, habitKey}` ·
  `{type: weight_goal}` · `{type: needs_ring, ring}` · `{type: social_mentions}`), `rule jsonb`
  (`PillarRuleJson`, shape depends on `kind`: habit `{threshold, comparator, daysPerWeek}` ·
  average `{threshold, comparator, windowDays}` · target `{startValue, targetValue, startDate,
  targetDate, direction}` · baseline `{windowDays=28, minDataDays=14, direction}` · linked `{}`).
- **`life_goal_pillar_day`** — `uq(pillar_id, day)`, `value`/`target`/`baseline numeric`,
  `status` (`hit|partial|miss|no_data`), `computed_at`. **Table + entity + repository exist;
  nothing writes to it yet** — that is `LifeGoalScorer`/`LifeGoalEvalJob`, slice 2.

**Contract** — `api/feature/lifegoal/lifegoal.yml`, nine operations:

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/life-goals` | `LifeGoalResponse[]` | newest first, non-deleted |
| POST | `/api/life-goals` | `LifeGoalResponse` (201) | creates in `draft`; 400 on validation |
| GET | `/api/life-goals/{id}` | `LifeGoalResponse` | 404 if not found/owned |
| PUT | `/api/life-goals/{id}` | `LifeGoalResponse` | editable fields only — status/pillars untouched |
| DELETE | `/api/life-goals/{id}` | 204 | soft-delete goal + pillars |
| POST | `/api/life-goals/{id}/status` | `LifeGoalResponse` | lifecycle transition; 409 on illegal one |
| PUT | `/api/life-goals/{id}/pillars` | `LifeGoalResponse` | replaces the whole list, `maxItems: 5` |
| GET | `/api/life-goals/signals` | `SignalCatalogResponse` | the 28-entry closed catalog |
| POST | `/api/life-goals/propose` | `LifeGoalProposeResponse` | AI-or-template draft, never empty |

**Error codes** (`messages.properties`): `LIFE_GOAL_INVALID_STATUS_TRANSITION`,
`LIFE_GOAL_UNKNOWN_SIGNAL`, `LIFE_GOAL_UNKNOWN_SKILL`, `LIFE_GOAL_TOO_MANY_PILLARS`,
`LIFE_GOAL_KIND_NOT_ALLOWED`. **Gotcha (§9):** the contract's `maxItems: 5` on both
`LifeGoalUpsertRequest.pillars` and `LifeGoalPillarsRequest.pillars` intercepts a 6th pillar
with a generic bean-validation error *before* `LifeGoalPillarService.validate`'s
`LIFE_GOAL_TOO_MANY_PILLARS` check ever runs — `LifeGoalProperties.maxPillars` (also capped at
5 by `@Max(5)`) exists only for future non-HTTP callers; raising the cap means raising both.

**Signal catalog** (`SignalCatalog`, 28 entries, seven Hungarian groups): Alvás (3: sleep
duration/quality, bedtime variability), Fuel (5: protein, kcal, water, late-meal hour, meal
score), Edzés (5: gym volume, sport load, ACWR, HR recovery, the `weight_goal` linked entry),
Elme (6: check-in energy/mental/stress, habits-done, ritual-closed, daily-XP), Activity
(5: productivity/learning/financial/connection/cooking, each keyed by an `activity_log.skill_key`
+ `measure`), Emberek (1: social mentions), Életjel (3: mozgás/pihenés/lélek needs rings).
`GET /api/life-goals/signals` exposes it verbatim; slice 2 adds per-entry liveness (`JelekPage`,
spec §6).

**FE types & mocks** — `frontend/src/data/lifegoal/lifegoalApi.ts` (generated-DTO-shaped
hand-written types, mirroring the contract), `lifegoalMock.ts` (`MOCK_LIFE_GOALS`,
`MOCK_SIGNAL_CATALOG`, `mockPropose`).

## 5. Integrations

- **← Companion** (port, real one-way). *Contract:* `LifeGoalProposePort.Proposal` — dimension
  (+ secondary), frame + frame note + optional reframe, pillars, obstacles, if–then plans.
  `lifegoal/service/LifeGoalProposeService` calls it through an `ObjectProvider`; `companion`
  never imports `lifegoal`. See §3.
- **← Progression** (`ProgressionTaxonomy`). *Contract:* the static skill-key sets (LIFE,
  ATHLETIC, MUSCLE, ROBUSTNESS) `LifeGoalPillarService` validates every pillar's `skillKey`
  against. No write path yet — the XP award (slice 2) will call `ProgressionService.award`.
- **← Habit** (`HabitCatalogService`, via `ObjectProvider`). *Contract:* habit-key existence
  check for `source.type=habit` pillars; a missing bean (feature off) degrades to reject, not
  a hard dependency.
- **← Goal / goal-engine** (the `weight_goal` catalog entry + `linked` pillar kind). *Contract:*
  today this is a labeled placeholder (`SignalCatalogEntry("weight_goal", …, kinds=[linked])`)
  — the actual read of the weight goal's on-pace verdict (`WeightGoalSignalSource` per the
  spec) is slice 2. See [`goal-engine.md`](goal-engine.md) §5 for the weight-goal side.
- **🟣 Deferred seams (slice 2/3, spec §5–§7):** `companion/LifeGoalSource` port feeding the
  `ContextSnapshotAssembler` `[Célok]` prompt block + a `get_life_goals` chat tool; the
  knowledge-graph `GOAL` node (`GraphPromotionService`, blocked on `mezo-06o0.5`); the Nap
  "Célok · ma" tile; the Heti `WeekGoalsCard`; the Growth skill-row `goalchip`; the Én-hub
  hero's goal-count line. None of these read or write anything today.

## 6. How to use it (consume)

```ts
import { useLifeGoals, useLifeGoal, useLifeGoalMutations, useLifeGoalPropose, useSignalCatalog } from '@/data/hooks'

const { goals, isPending, isError, refetch } = useLifeGoals()          // LifeGoalResponse[]
const { goal, isPending, isError, refetch, goalCount } = useLifeGoal(id) // one goal or null, derived from the list
const { create, update, changeStatus, replacePillars, remove, pending } = useLifeGoalMutations()
const { entries } = useSignalCatalog()                       // the 28-entry catalog
const { propose, pending: proposing } = useLifeGoalPropose() // AI/template draft
```

All hooks are dual-mode (`isMockMode()`), never reach into `lifegoalApi.ts` or
`lifegoalHooks.ts` directly, and follow the `_platform-data-layer.md` ghost-guard convention —
nothing renders while `useLifeGoals()`/`useLifeGoal()` is pending. `useLifeGoal(id)` derives
from the same `['lifeGoals']` query the hub reads, so there is no second network round trip on
navigating hub → detail.

**Both pages render the full loading/empty/error triad, never two of the three.** `isPending`
returns a `ScreenSkeleton` (the hub used to print a fabricated "0 aktív · 0 parkol" during the
real-mode loading window), and `isError` with an empty list renders a terminal `GhostState` +
"Újra" retry — a failed fetch must never read as "you have no goals" / "no such goal".
`useLifeGoal` also exposes `goalCount` for exactly that distinction: a resolved-but-absent id is
the only real not-found. Because `useLifeGoal` derives from the LIST query and
`invalidateQueries` does **not** refetch an inactive query, `create`'s real arm writes the
created goal into the `['lifeGoals']` cache before returning — without it the wizard's
navigation to `/me/goals/{id}` flashed "Nincs ilyen cél.".

**A pillar added from `PillarCatalogSheet` goes through `features/me/logic/pillarFromCatalog.ts`**
(both the Cél-oldal `＋ Pillér` flow and the wizard's step 3 use it, so the two cannot drift).
It picks the kind by preference order — the first of `average`/`baseline`/`habit`/`target`/
`linked` the entry allows, NOT `kinds[0]` — and attaches a real default rule for each
parameterisable kind (habit: `gte`/`threshold 1`/`5× per week`). `kinds[0]` sent `rule: {}` for
the 13 of 28 entries whose first kind is `habit`, which `PillarCard` rendered as a literal `?`
and slice 2's scorer could not score.

## 7. How to extend it

**Add a catalog entry** (a new signal a pillar may point at): add one `SignalCatalogEntry` to
`SignalCatalog.ENTRIES` (backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/catalog/SignalCatalog.java)
naming its `source`, Hungarian `label`/`group`, allowed `kinds`, `unit`, and `defaultSkillKey`
— then mirror it in `frontend/src/data/lifegoal/lifegoalMock.ts`'s `MOCK_SIGNAL_CATALOG` so mock
mode's `PillarCatalogSheet` offers the same option. No migration or contract change needed (the
catalog is code, not a table). If the new signal is a `metric` source, its `MetricKey` must
already exist in `companion/service/MetricSeriesService`.

**Add an endpoint / change the contract:** contract-first per
[`_platform-api-backend.md`](_platform-api-backend.md) §3 — edit
`api/feature/lifegoal/lifegoal.yml`, `cd api/generate && npm run generate:api`, implement the
generated `LifeGoalApi` method in `LifeGoalController`, add the service logic, a Liquibase
migration if the data model changes (`docs/references/liquibase_conventions.md`), a dual-mode
FE hook, an MSW handler, and green tests in both `pnpm test` and `VITE_USE_MOCK=true pnpm test`.

**Mock-only extension:** a new wizard step or hub affordance that has no backend counterpart yet
can be prototyped by extending `lifegoalMock.ts` alone — see `mockPropose` for the shape of a
pure-mock branch that never touches `lifegoalApi.ts`.

## 8. Testing

**Backend** (`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/`), all requiring
`-Dmezo.test.use-testcontainers=true`:
- `LifeGoalEntityIT` — entity/repository round-trip (`AbstractIntegrationTest`).
- `LifeGoalApiIT` — CRUD + status-transition matrix (draft→active→parked→active, done,
  archive) + the too-many-pillars 400 (`ApiIntegrationTest`).
- `LifeGoalPillarApiIT` — `PUT /pillars` catalog/skill/kind/cap validation.
- `LifeGoalProposeIT` — AI-branch (`[fake-lifegoal-propose:{…}]` sentinel), malformed-JSON
  degrade, and the template fallback when the port is absent.
- `LifeGoalSeedDataIT` — the `demofixtures` seed, `@ActiveProfiles({"demodata",
  "demofixtures"})` (see the `AbstractIntegrationTest` gotcha in §9): row counts, the four
  titles/statuses/`createdBy`, `activatedAt` on the three active goals, and every seeded pillar
  run through `SignalCatalog.find` + its entry's allowed `kinds` (D4's closed-catalog guarantee).

**Frontend**: `CelokPage.test.tsx`, `CelPage.test.tsx`, `CelWizardPage.test.tsx` (page-level,
both test modes — each also covers its real-mode loading/error state), `logic/pillarFromCatalog.test.ts`
(every catalog entry yields an allowed kind + a populated rule), `data/lifegoal/lifegoalHooks.test.tsx`
(hook-level: mock-cache patching, the real-mode create cache-seed, `isError`/`refetch`). All five
life-goal write endpoints have MSW handlers resolving the goal by id (`test/msw/handlers.ts`) —
`setup.ts` runs MSW with `onUnhandledRequest: 'bypass'`, so a missing handler would let a
real-mode write escape to the network and pass silently. Run both `pnpm test` (real, MSW-backed) and
`VITE_USE_MOCK=true pnpm test` (mock) — see [`_platform-data-layer.md`](_platform-data-layer.md)
§8 for the dual-mode test convention. The two structural CSS guards in
`shared/ui/mozaik/prototypeCssStructure.test.ts` / `mozaikCssTokens.test.ts` also cover the
`lg-*` rules this slice added to `styles/prototype.css` (§9).

## 9. Decisions, gotchas & deferred

- **D1–D10** (spec §1) are the ten binding decisions behind every shape in this doc: D1
  (measurable/visible goals, overriding the old PRD's PERMA-widget prohibition — ADR 0034,
  below), D2 (PERMAH + skill hybrid), D3 (existing signals only, no new logging, no GitHub/
  external import), D4 (AI proposes from a closed catalog, user approves), D5 (`/me/goals` +
  `/me/goals/weight` split, this slice), D6 (nightly job + stored daily rows — slice 2), **D7
  (no cap on active goals — implemented as written; the earlier 3-goal 409 gate was dropped
  before this slice)**, D8 (the five-step wizard, implemented as written), D9 (if–then plans as
  trigger rules — the plan *shape* ships now, the *evaluation* is slice 2), D10 (the five-kind
  pillar taxonomy).
- **The contract cap intercepts the service cap** — see §4's gotcha box; raise
  `maxItems: 5` and `LifeGoalProperties.maxPillars`/`@Max(5)` together or the property change is
  a no-op over HTTP.
- **The fake-LLM sentinel lives in `whyText`, not `title`.** `title` is capped at 120 chars by
  the contract — too tight for a scripted JSON payload — while `whyText`'s 600-char cap has
  room. `FakeCompanionLlm.LIFEGOAL_PROPOSE_SENTINEL` matches `[fake-lifegoal-propose:{…}]`
  inside the adapter's `whyText`-carrying context, not the title.
- **`AbstractIntegrationTest` does not activate the `demodata` owner profile** — only
  `ApiIntegrationTest` does. A seed-data IT (`LifeGoalSeedDataIT`) that extends
  `AbstractIntegrationTest` directly must add `@ActiveProfiles({"demodata",
  "demofixtures"})` itself, or the owner the seed keys off of never exists.
- **Two frontend CSS guard tests constrain `styles/prototype.css`** and this slice's `lg-*`
  rules live inside the region they police: `mozaikCssTokens.test.ts` forbids raw light-surface
  hex codes inside the Mozaik region (tokens only) and `prototypeCssStructure.test.ts`/the
  Mozaik-section scan assumes the **Today** section is the last one in the file — new rules for
  this feature must land before it, not after.
- **Mock/real parity, `closedAt`:** the mock `changeStatus` arm
  (`frontend/src/data/lifegoal/lifegoalHooks.ts`) now stamps `closedAt` on `done`/`archived`
  alongside `activatedAt` on activation, matching the backend — the earlier divergence (and the
  "no UI may read `closedAt`" embargo it forced) is resolved. Note `done → archived` still
  OVERWRITES `closedAt` on both sides; a completed-goals surface (slice 3) must not present it
  as the completion date without fixing that first.
- **ADR:** [`0034-measurable-life-goals.md`](../decisions/0034-measurable-life-goals.md) —
  records that this feature overrides the old PRD's IDENT-5 / anti-pattern D38 prohibition
  ("PERMA is never a widget", identity-goal progress is "never a UI progress bar") with D1's
  rationale (Harkin et al. 2016 on recorded, visible progress monitoring; the SDT framing
  nudge), and fixes the guardrails that survive the override (no loss mechanics, a declining
  trend is never red, `no_data` is never a miss, minimum-data gates before any trend, XP as
  feedback and never a penalty).
- **Deferred to slice 2** (spec §5, §9): `LifeGoalScorer` (daily hit/partial/miss/no_data +
  weighted goal score + 7-vs-21-day arrow with a 5-data-day gate), the `SignalSource` port (six
  implementations), `LifeGoalEvalJob` (nightly, 3-day re-write for late logging, idempotent),
  `GET /{id}/progress` and `GET /today`, `GET /signals` liveness, the `JelekPage`, XP award
  (`source_type=LIFE_GOAL`), if-then trigger evaluation + `LIFE_GOAL_PLAN` notifications,
  goal-conflict detection.
- **Deferred to slice 3** (spec §6–§7): the Nap "Célok · ma" tile, the Heti `WeekGoalsCard`,
  the companion `[Célok]` prompt block + `get_life_goals` chat tool, the knowledge-graph `GOAL`
  node (blocked on `mezo-06o0.5`), the Growth skill-row chip, the Én-hub hero's goal line.

## 10. Key files

**Backend** — `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/` (entity, repository,
service, controller, mapper, catalog, config); `feature/companion/LifeGoalProposePort.java` +
`feature/companion/llm/LifeGoalProposeLlmAdapter.java` (the AI port + adapter);
`feature/lifegoal/LifeGoalSeedData.java` (`demofixtures` seed, `@Order(125)`, after
`GoalSeedData`).

**Tests** — `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/{LifeGoalEntityIT,
LifeGoalApiIT, LifeGoalPillarApiIT, LifeGoalProposeIT, LifeGoalSeedDataIT}.java`.

**Contract** — `api/feature/lifegoal/lifegoal.yml`.

**Frontend data** — `frontend/src/data/lifegoal/{lifegoalApi.ts, lifegoalHooks.ts,
lifegoalMock.ts}`, re-exported from `frontend/src/data/hooks.ts`.

**Frontend UI** — `frontend/src/features/me/pages/{CelokPage,CelPage,CelWizardPage}.tsx`;
`frontend/src/features/me/components/{PermahRing,LifeGoalTile,PillarCard}.tsx`;
`frontend/src/features/me/sheets/PillarCatalogSheet.tsx`;
`frontend/src/features/me/logic/lifegoalLabels.ts` (dimension/status/kind label + icon tables).

**Docs** — this file; spec
[`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`](../superpowers/specs/2026-09-02-lifegoal-system-design.md);
plan [`docs/superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md`](../superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md);
prototype [`docs/design_2.0/prototypes/celok.html`](../design_2.0/prototypes/celok.html);
[`goal-engine.md`](goal-engine.md) and [`me.md`](me.md) for the weight-goal sibling and the
route map.
