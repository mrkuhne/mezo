---
title: Frontend structure refactor — explicit pages layer + consistent conventions
date: 2026-07-01
status: approved
bd: mezo-t2x4
type: design-spec
scope: frontend/src (behavior-preserving reorg, ~450 files)
---

# Frontend structure refactor — design spec

## 1. Context & goal

`frontend/src` grew organically across six vertical slices. A real convention set
already exists but is **implicit and inconsistent**, so the structure reads as
chaotic: features carry their sheets/logic at the root, `data/` is 69 flat files,
`lib/` is 32 flat files mixing REST clients with utils, and the routed-component
vocabulary (`Screen`/`View`) is undocumented.

**Goal:** make the existing system *explicit, uniform, and visible* — a stated
folder convention, an explicit "page" vocabulary, and a clean layering — **without
changing any runtime behavior**. The full test suite (both modes) and the build stay
green at every step; `pnpm parity` is the visual no-op proof.

This is a **reorganization**: file moves + symbol renames + import rewrites + a small
number of contained test-file splits. No feature logic, data flow, API, or route
changes.

### Approved decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| D1 | Refactor depth | Consistency **+ explicit pages layer** |
| D2 | Pages model | **Feature-cohesion** — `pages/` lives *inside* each feature; `app/router.tsx` stays the single route map |
| D3 | Route-component naming | **Rename to the Page vocabulary** — `*Screen`→`*Section`/`*Page`, `*View`→`*Page` |
| D4 | Module boundaries | **No barrels** — deep imports via the `@/*` alias (no per-feature `index.ts`) |
| D5 | Data + API clients | REST `*Api.ts` clients **move under `data/<domain>/`**; `lib/` keeps only pure utils/hooks → `shared/` |

## 2. Target architecture — four layers

```
src/
├─ app/        shell + routing (AppLayout, PhoneFrame, StatusBar, TabBar,
│              ThemeProvider, providers/QueryProvider, router.tsx)  ◀ the ONE route map
├─ features/   domains — every feature uses the SAME internal template
├─ shared/     domain-independent, reused (ex components/ui + lib util/hooks)
└─ data/       the whole FE↔BE boundary: hooks + mock + types + REST client, per domain
```

The `@/*` → `src/*` path alias is unchanged. Co-located tests stay next to their
source (they move *with* it). No `index.ts` barrels are introduced — imports are deep
(`@/features/train/pages/GymPage`, `@/shared/ui/Chip`, `@/data/fuel/hooks`).

## 3. Naming taxonomy — the stated system

| Suffix / kind | Role | Folder |
|---|---|---|
| `*Section` | tab-root that renders a `SubNav` + `<Outlet>` | `pages/` |
| `*Page` | **any routed leaf** — an `<Outlet>` child *or* a standalone full-page route | `pages/` |
| `*Sheet` (and the `*Modal` alias) | modal / bottom-sheet | `sheets/` |
| `*Skeleton`, `*SubNav`, `tabs.ts` | route-adjacent scaffolding | `pages/` |
| `*Card/Panel/Row/Hero/Stat/Bar/Grid/Chip/Cell` | presentational | `components/` |
| pure `.ts` logic / derivations / feature-local logic hooks | e.g. `planner.ts`, `agenda.ts`, `workoutState.ts`, `buildProtocol.ts`, `radarGeometry.ts`, `weightStats.ts` | `logic/` |
| non-routed app-shell overlay | `LevelUpProvider` / `LevelUpScreen` (progression) | feature root |

**One-line rule:** everything routed is either a `*Section` (it owns an `<Outlet>`) or
a `*Page` (a leaf). The `Screen`/`View` duality is retired.

### Feature template (identical for all 7 features)

```
features/<domain>/
├─ pages/        *Section · *Page · *SubNav · tabs.ts · *Skeleton   (routed layer)
├─ components/   presentational components + their small pure view-helpers
├─ sheets/       *Sheet / *Modal
└─ logic/        pure feature logic / derivations / feature-local logic hooks
```

Only folders that have content appear (`quickinput/` → just `sheets/`; `progression/`
→ overlay files at root + `logic/`).

## 4. `data/` layer — per-domain, with a shared core

```
data/
├─ _client/   useDualQuery.ts + (moved from lib/) api.ts, api.gen.ts, mode.ts, flags.ts, auth.ts
├─ hooks.ts   ◀ THIN re-export barrel (the documented single boundary is preserved)
├─ types.ts   ◀ cross-cutting type spine (stays at root)
├─ nova.ts · pantrySources.ts · kindMeta.ts   ◀ shared type/const modules types.ts depends on (stay at root)
├─ today/ · fuel/ · train/ · me/ · insights/ · progression/
│            each: hooks.ts · <mock>.ts · types.ts · <domain>Api.ts · pure derivations
```

- The current 180-line `data/hooks.ts` god-file has its inline hook implementations
  moved into the per-domain `data/<domain>/hooks.ts`; `hooks.ts` becomes a **thin
  re-export barrel** so `hooks.reexport.test.ts` and the documented boundary stay valid.
- The 11 `*Api.ts` clients move from `lib/` into their domain folder.
- **Shared-core rule (avoids dependency inversion):** a data module moves into
  `data/<domain>/` **only if it is domain-owned**. Modules that `data/types.ts`
  imports (`nova.ts`, `pantrySources.ts`), the cross-cutting `types.ts`/`kindMeta.ts`,
  the aggregate barrel `hooks.ts`, and the aggregate tests (`hooks.test.tsx`,
  `hooks.reexport.test.ts`, `dualMode.guard.test.ts`, `useDualQuery` + test) **stay at
  `data/` root / `data/_client`** — never inside a domain folder. Cross-domain imports
  *between* domain folders (e.g. today's `retaDay` reading `data/fuel/medicationHooks`)
  are allowed and normal.

## 5. `shared/` layer

```
shared/
├─ ui/     ex components/ui (~25 domain-free primitives) — kept FLAT, no sub-grouping
├─ lib/    cn · dates · pct · theme · safeMarkdown   (pure utils)
└─ hooks/  useReducedMotion · useStickyTab
```

**`shared/ui` must be domain-free.** Two current `ui/` files import domain data and
are used by exactly one feature → they relocate into that feature (see §6, decision R14).

## 6. Resolved edge cases (from the inventory sweep)

The classification workflow (10 agents, 450 files, 100% coverage, 0 target
collisions) surfaced 15 ambiguities. Resolutions:

| Ref | File(s) | Decision |
|---|---|---|
| R1 | `today/AnchorModeView.tsx` | → `pages/AnchorModeView.tsx`, **name kept** (page-level composition TodayPage swaps in; not a router leaf, so no `*Page` rename). |
| R2 | `train/…/FeedbackModal.tsx` | → `sheets/`, **name kept** (`*Modal` is an accepted sheet alias). |
| R3 | `train.nav.test`, `train.emptyStates.test`, `insights.nav.test` | → their feature's `pages/` (they exercise Section+Pages navigation). |
| R4 | `SportLogSheet`'s `NumberStep`/`ScaleRow` sub-exports | move **with** the file into `sheets/` (relative import intact); no extraction now. |
| R5 | plural component tests (`kamraCards`, `weekWidgets`, `topSections`, `bottomSections`, `conditionalCards`) | → `components/`, no rename. |
| R6 | `me/GoalGate.tsx` | → `components/GoalGate.tsx` (non-routed full-screen guard component; not a sheet). |
| R7 | `KnowledgePage` (me) vs `KnowledgeListPage` (insights) | distinct symbols in distinct folders + deep imports ⇒ no clash; keep both. |
| R8 | data shared core | `types.ts`, `nova.ts`, `pantrySources.ts`, `kindMeta.ts`, `hooks.ts`, aggregate tests, `_client/*` **stay at root** (§4 rule). `mealTypes.test`/`recipeTypes.test` stay at root beside `types.ts`. |
| R9 | `biometricsApi.ts` (weight+sleep=me, checkin=today) | → whole file `data/me/biometricsApi.ts`; today imports `checkinApi` cross-domain. No file split (follow-up F2). |
| R10 | `medication.ts`/`medicationHooks.ts` | → `data/fuel/`; today's `retaDay` derivation imports cross-domain. |
| R11 | `goals.ts` (mixed goal+weight+biometric seed) | → whole `data/me/goals.ts`; finer split is follow-up F1. |
| R12 | `knowledge.ts` | → `data/insights/`; me imports cross-domain. |
| R13 | progression data (`progressionHooks`, `progressionMock`, `progressionApi`) | → `data/progression/`; me's radar/muscle cards import cross-domain. |
| R14 | `ui/SourceBadge.tsx`, `ui/NovaDot.tsx` | hard `@/data/*` import + single-feature (fuel) ⇒ → `features/fuel/components/`. Split `fuelPrimitives.test.tsx`: SourceBadge+NovaDot cases follow to fuel; `StatCell`/`MacroRow` cases stay in `shared/ui`. |
| R15 | `ui/MacroRow`, `ui/ScoreRing`, `ui/StatCell`, `ui/QuickStat`, `ui/RetaPhaseBar` | **stay in `shared/ui`** (domain-free or multi-feature; single current consumer ≠ feature-coupled). `MacroRow` appears dead → verify/remove is follow-up F3. |

## 7. Symbol renames (38 source symbols; co-located tests inherit → 73 files)

Sections (own an `<Outlet>`):
`TrainScreen→TrainSection` · `FuelScreen→FuelSection` · `InsightsScreen→InsightsSection` · `MeScreen→MeSection` (its `MeOutletContext` type moves too).

Standalone full-page routes → `*Page`:
`TodayScreen→TodayPage` · `ActiveWorkoutScreen→ActiveWorkoutPage` · `MesocyclePlanner→MesocyclePlannerPage` · `MesocycleBuilder→MesocycleBuilderPage` · `RunningBlockBuilder→RunningBlockBuilderPage` · `GoalPlanner→GoalPlannerPage` · `RecipeDetailView→RecipeDetailPage` · `RecipeEditorView→RecipeEditorPage`.

`<Outlet>`-child leaves `*View→*Page`:
`TrainTodayView→TrainTodayPage` · `GymView→GymPage` · `SportView→SportPage` · `RunningView→RunningPage` · `ExercisesView→ExercisesPage` · `MesocycleLibraryView→MesocycleLibraryPage` · `FuelMaiView→FuelMaiPage` · `FuelPlanView→FuelPlanPage` · `FuelStackView→FuelStackPage` · `FuelRecipesView→FuelRecipesPage` · `FuelKamraView→FuelKamraPage` · `KamraItemDetailView→KamraItemDetailPage` · `FuelMedicationView→FuelMedicationPage` · `PatternsView→PatternsPage` · `WeeklyView→WeeklyPage` · `MemoirView→MemoirPage` · `KnowledgeListView→KnowledgeListPage` · `ChatView→ChatPage` · `PredictionsView→PredictionsPage` · `ExperimentsView→ExperimentsPage` · `ProfileView→ProfilePage` · `GoalsView→GoalsPage` · `WeightView→WeightPage` · `SleepView→SleepPage` · `PeopleView→PeoplePage` · `KnowledgeView→KnowledgePage`.

`*Skeleton`, `*SubNav`, `*Sheet`, and all presentational components keep their names.

## 8. Execution strategy

**Isolated git worktree** off `main` (per request). Bottom-up so dependents move last:

1. **`shared/`** — `ui/`, `lib/`, `hooks/` (+ the R14 fuel relocations & test split).
2. **`data/`** — `_client/`, domain folders, thin `hooks.ts` barrel, `*Api.ts` from lib.
3. **`features/`** one at a time, simplest first: `quickinput` → `progression` → `today` → `insights` → `me` → `fuel` → `train`.

Per step: create target folders, `git mv` (preserve history), apply symbol renames,
rewrite imports, **run the gate**, commit with a conventional message carrying `mezo-t2x4`.

**The gate (must be green after every step):**
```
pnpm build                        # tsc -b — catches every broken import / missed rename
pnpm test                         # vitest, REAL mode
VITE_USE_MOCK=true pnpm test      # vitest, MOCK mode
```
Final acceptance: `pnpm parity` (Playwright screenshot diff) — must be a visual no-op.

**Import rewrite:** deterministic path/symbol substitution (codemod), with `tsc -b`
as the safety net and a `grep` sweep for each retired symbol name to catch strings in
tests/copy.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Broken import after a move | `tsc -b` (strict) fails the build — no silent breakage. |
| Missed symbol rename in a test `describe`/string | both test modes + a `grep` sweep per retired name. |
| Dependency inversion (`data/` root → domain folder) | §4 shared-core rule keeps the type spine at root; `tsc` would flag a cycle. |
| Circular imports | no barrels + deep imports structurally prevent them. |
| Visual regression | zero behavior change by construction; `pnpm parity` proves it. |
| Scope creep (seed splits, dead-code removal) | explicitly deferred to follow-ups F1–F3. |

## 10. Documentation deliverables (mandatory)

- **New ADR** `docs/decisions/0003-frontend-structure-conventions.md` — the *why* of the
  layering + naming taxonomy.
- **Update** `docs/features/_platform-design-system.md` — state the folder structure +
  naming taxonomy (the "visible system").
- **Update `file:line` pointers** in every `docs/features/*.md` that references a moved
  path, then run `node scripts/lint-docs.mjs` to clear staleness flags.

## 11. Out of scope — follow-up bd issues

- **F1** — split `data/me/goals.ts` seed into `me/{goals,weight,biometric}.ts`.
- **F2** — split `biometricsApi.ts` so `checkinApi` lives in `data/today/`.
- **F3** — verify & remove `MacroRow` if confirmed dead.
- **F4** — consider migrating domain interfaces out of the shared `data/types.ts` into
  per-domain `types.ts`.

---

*Inventory source: `fe-refactor-inventory` workflow (10 agents, 450 files classified,
0 collisions). This spec encodes the finalized rules + resolutions; the implementation
plan derives the concrete file operations from them.*
