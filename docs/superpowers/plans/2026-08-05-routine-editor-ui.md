# Routine Editor UI (mezo-n5e9.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full routine-editor page over the shipped admin API — edit/reorder/toggle built-ins, create custom habits (MANUAL or metric-palette DERIVED) and custom chains with a daypart anchor — plus catalog-driven chain bucketing on Today and the Growth Rutin tab (the hardcoded MORNING/EVENING maps die).

**Architecture:** New `data/habit/habitAdminApi.ts` + `habitAdminHooks.ts` (catalog read via `useDualQuery`, CRUD/reorder mutations with mock cache mutators — the `slotTemplateHooks` pattern). `todayItems.ts` and `RoutinesTab` consume the catalog read to bucket by `chain.daypart`/title. New full-screen `RoutineEditorPage` (the `GoalPlannerPage` sibling-route idiom) with `ChainEditSheet` + `HabitEditSheet` and the existing `SortableList` (@dnd-kit) for reorder.

**Tech Stack:** React 19 + TanStack Query + the mezo DS primitives (`Sheet`, `ItemRow`, `SortableList`, `Stepper`, `Toggle`, `GhostState`); generated types from `src/data/_client/api.gen.ts`.

**Spec:** `docs/superpowers/specs/2026-08-05-routine-editor-design.md` §5 (approved UX) · **bd:** `mezo-n5e9.2` · **Branch:** `feat/routine-editor-ui`

## Global Constraints

- Work in this worktree, branch `feat/routine-editor-ui`. Frontend only — NO backend/contract changes (the admin API shipped in mezo-n5e9.1; if the contract seems wrong, STOP and report).
- House conventions are binding (`docs/references/frontend_conventions.md`): hooks only via the `@/data/hooks` barrel; deep absolute `@/*` imports, no `../`, no new barrels; routed leaf = `*Page` in `features/me/pages/`; sheets = `*Sheet` in `features/me/sheets/` wrapping `@/shared/ui/Sheet` (conditional mount, render-prop `close`); `shared/ui` stays domain-free; dual-mode reads via `useDualQuery` with `realEmpty` (never mock fallback); mutation errors surface via the global mutation-cache toast (no swallowed `.catch()`); colocated tests.
- Per-task gate: the focused test files named in each task. Final gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — BOTH modes fully green.
- Behavior parity for the seed catalog: with the two seed chains untouched, Today must render byte-identically (labels come from chain titles „Reggeli rutin"/„Esti rutin" — the same strings `CHAIN_GROUP` hardcodes today). RoutinesTab card titles change from „Reggeli lánc"/„Esti lánc" to the chain titles — the ONLY user-visible copy change; if a Playwright golden covers /me/growth, regenerate darwin goldens locally (`pnpm test:visual:update -g "<name>"`) and note that linux goldens regenerate via the `update-visual-baselines.yml` workflow at PR time. Check first: `ls frontend/e2e/visual.spec.ts-snapshots/ | grep -i growth` (if no growth golden exists, nothing to do).
- Commits: conventional subject with `(mezo-n5e9.2)`; explicit `git add <paths>` + `git commit --no-verify`; never `git add -A`.
- Hungarian UI copy, English code/comments.

---

### Task 1: Data layer — admin API client, hooks, mock catalog

**Files:**
- Create: `frontend/src/data/habit/habitAdminApi.ts`
- Create: `frontend/src/data/habit/habitAdminHooks.ts`
- Modify: `frontend/src/data/habit/habitMock.ts` (add `mockHabitCatalog`)
- Modify: `frontend/src/data/types.ts` (add `HabitChainInfo`, `HabitDefInfo`, `HabitCatalog` FE types; widen `HabitChain`)
- Modify: `frontend/src/data/hooks.ts` (barrel line)
- Test: `frontend/src/data/habit/habitAdminHooks.test.tsx`

**Interfaces:**
- Consumes: generated `api.gen.ts` schemas `HabitCatalogResponse/HabitChainAdmin/HabitDefAdmin/HabitChainCreateRequest/HabitChainUpdateRequest/HabitDefCreateRequest/HabitDefUpdateRequest/HabitReorderRequest`; paths `/api/habit/catalog`, `/api/habit/chain`, `/api/habit/chain/{id}`, `/api/habit/chain/{id}/order`, `/api/habit/def`, `/api/habit/def/{id}`; `apiFetch` from `@/data/_client/api`; `useDualQuery`.
- Produces (via `@/data/hooks`):
  - `useHabitCatalog(): { catalog: HabitCatalog; isPending: boolean }` — dual-mode read, `queryKey: ['habitCatalog']`, `realStaleTime: 60_000`.
  - `useHabitCatalogActions(): { createChain, updateChain, deleteChain, reorderChain, createDef, updateDef, deleteDef, pending }` — each returns a Promise; real mode invalidates `['habitCatalog']`, `['habitDay']`, `['habitSummary']`; mock mode patches the `['habitCatalog']` cache via mutators (below).
- FE types in `data/types.ts`:

```ts
export type HabitDaypart = 'MORNING' | 'DAY' | 'EVENING'
export interface HabitChainInfo {
  id: string
  chainKey: string
  title: string
  daypart: HabitDaypart
  position: number
  isActive: boolean
  defs: HabitDefInfo[]
}
export interface HabitDefInfo {
  id: string
  habitKey: string
  chainKey: string
  position: number
  title: string
  why: string | null
  anchorCopy: string | null
  mode: HabitMode
  metric: string
  skillKey: string
  xp: number
  linkUrl: string | null
  isActive: boolean
}
export interface HabitCatalog {
  chains: HabitChainInfo[]
}
```

Also change `export type HabitChain = 'MORNING' | 'EVENING'` → `export type HabitChain = string` (the wire widened in mezo-n5e9.1; `habitApi.ts:20`'s cast keeps compiling — afterwards run a quick `grep -rn "HabitChain" frontend/src` and fix any comparison the widening breaks; `RoutinesTab`/`todayItems` still compare against the literal strings, which stays valid).

- [ ] **Step 1: Write the failing hook tests** — in `habitAdminHooks.test.tsx`, following `slotTemplateHooks`' test structure and this file's sibling `habitHooks.test.tsx` (MSW server, `sharedWrapper`): (a) mock mode: `useHabitCatalog` serves `mockHabitCatalog` (2 chains, 9+6 defs); `createChain` appends a chain with a generated key + daypart to the cache; `updateDef({isActive:false})` flips the cached def; `deleteChain` removes it; `reorderChain` reorders cached defs. (b) real mode: `useHabitCatalog` returns `realEmpty` (`{chains: []}`) while unresolved, then MSW-served data; `createDef` POSTs `/api/habit/def` and invalidates `['habitCatalog']` + `['habitDay']` + `['habitSummary']` (invalidateSpy pattern from `weightHooks.test.tsx:88-110`). MSW handlers: add defaults for the 6 admin paths in `src/test/msw/handlers.ts` (echoing minimal valid bodies) — mirror the file's existing style.
- [ ] **Step 2: Run to verify failing** — `cd frontend && pnpm test src/data/habit/habitAdminHooks.test.tsx` → FAIL (module missing).
- [ ] **Step 3: Implement** — `habitAdminApi.ts`: thin `apiFetch` wrappers typed off `api.gen.ts` with `satisfies` on request bodies (the `slotTemplateApi.put` precedent) + `toChainInfo`/`toDefInfo` wire→domain mappers. `habitAdminHooks.ts`: `useHabitCatalog` via `useDualQuery` (`mockData: mockHabitCatalog`, `realEmpty: { chains: [] }`); one `useMutation` per action, `onSuccess: mock ? undefined : invalidateAll`; mock arms call cache mutators (`mockCreateChain(qc, …)` etc. — the `slotTemplateHooks.mockPut/mockDelete` shape; generated mock ids via `crypto.randomUUID()`, keys `chain_`/`custom_` + first 8 chars). `mockHabitCatalog` in `habitMock.ts`: derive the def list from `mockHabitDay` (same keys/titles/xp) + hand-written seed-chain wrappers (`MORNING`/„Reggeli rutin"/daypart MORNING/pos 1; `EVENING`/„Esti rutin"/EVENING/2) — keep it consistent with the mock day so the editor and Today agree offline.
- [ ] **Step 4: Green + barrel** — add `export { useHabitCatalog, useHabitCatalogActions } from '@/data/habit/habitAdminHooks'` to `data/hooks.ts`; run the test file green, then `pnpm test src/data/habit` both modes.
- [ ] **Step 5: Commit** — `git add` the six files + msw handlers; `git commit --no-verify -m "feat(habit): admin catalog hooks — dual-mode read + CRUD/reorder mutations (mezo-n5e9.2)"`.

---

### Task 2: Catalog-driven bucketing — todayItems + RoutinesTab

**Files:**
- Modify: `frontend/src/features/today/logic/todayItems.ts` (+ its callers passing the new arg: grep `todayItems(` / `buildTodayItems` call sites in `features/today`)
- Modify: `frontend/src/features/me/components/RoutinesTab.tsx`
- Test: existing `todayItems`/`TodayPage`/`RoutinesTab` test files (extend, don't fork)

**Interfaces:**
- Consumes: Task 1's `useHabitCatalog` (`HabitChainInfo.daypart/title/chainKey/isActive`).
- Produces: `todayItems`' habit bucketing takes a `chains: HabitChainInfo[]` parameter (empty array = current fallback behavior); the `CHAIN_FACE`/`CHAIN_GROUP` constants and the unknown-chain skip guard are REPLACED by catalog lookup.

- [ ] **Step 1: Extend the todayItems tests first** — a DAY-daypart custom chain's def lands on the `nap` face with its chain title as group; a chain missing from the catalog (stale row) is skipped (the guard's semantics survive); the seed chains produce byte-identical output to the current snapshot (feed the two seed `HabitChainInfo`s and assert the same groups/tags as before: „Reggeli rutin"/„Esti rutin", faces `reggel`/`este`). Run → FAIL.
- [ ] **Step 2: Implement todayItems** — daypart→face map `{ MORNING: 'reggel', DAY: 'nap', EVENING: 'este' }`; per-habit: find its chain by `chainKey` in the passed catalog chains (build a `Map` once); missing chain → skip (replaces the mezo-n5e9.1 guard, keep a one-line comment); group label = `chain.title`, tag = `chain.title.toUpperCase()`. The MORNING-chain hero promotion keys on `chain.daypart === 'MORNING'` && `chain.chainKey === 'MORNING'`? — NO: keep the hero rule as „the first MORNING-daypart chain's first open step" (seed-compatible; multiple morning chains: only the first by position gets the hero). `DEDUP_PAIRS` untouched. Callers (`TodayPage`/faces — wherever `useHabitDay` feeds the builder) additionally read `useHabitCatalog()` and pass `catalog.chains`.
- [ ] **Step 3: RoutinesTab dynamic chains** — replace the two hardcoded `chainCard(…, 'MORNING'/'EVENING', …)` calls with a map over `useHabitCatalog().catalog.chains` filtered `isActive`, ordered by `position`: emoji by daypart (`🌅/☀️/🌙`), card title = `chain.title`, filter `habits.filter(h => h.chain === chain.chainKey)`; the per-day/past-day branches keep their existing rendering. The perfect-day counters stay summary-driven (unchanged). Add a test: a third (DAY) chain renders its own card; seed-only catalog renders exactly the previous two cards with the new titles.
- [ ] **Step 4: Gates** — `pnpm test src/features/today src/features/me/components/RoutinesTab.test.tsx src/features/today/logic` both modes + `pnpm build`. Then the visual-golden check from Global Constraints (growth golden? today goldens must NOT change — if they do, STOP and diff why before regenerating anything).
- [ ] **Step 5: Commit** — `fix(today,me): catalog-driven chain bucketing — dayparts replace the hardcoded maps (mezo-n5e9.2)`.

---

### Task 3: The editor — page, sheets, route, entry

**Files:**
- Create: `frontend/src/features/me/pages/RoutineEditorPage.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/sheets/ChainEditSheet.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/sheets/HabitEditSheet.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/me/logic/habitMetricPalette.ts` (+ `.test.ts`)
- Modify: `frontend/src/app/router.tsx` (one sibling route)
- Modify: `frontend/src/features/me/components/RoutinesTab.tsx` (entry button)

**Interfaces:**
- Consumes: Task 1 hooks; `@/shared/ui/{Sheet,SortableList,ItemRow,Toggle,Stepper,Icon,GhostState,Chip}`; `useProgressionProfile` from `@/data/hooks` for the LIFE-skill picker options (grep its shape first — the Growth Skillek tab consumes it; options = its LIFE skills' `{key, name}`).
- Produces: route `me/routines/edit` (full-screen sibling, the `me/goals/new` idiom); „Szerkesztés" button in RoutinesTab's header row navigating there.

- [ ] **Step 1: `habitMetricPalette.ts`** — the enumerated DERIVED palette with Hungarian labels (keep in sync with backend `HabitEvaluator.SUPPORTED_METRICS`; comment says so):

```ts
/** DERIVED metric palette for custom habits — MUST mirror HabitEvaluator.SUPPORTED_METRICS
 *  (minus "manual"). Labels describe the real signal the evaluator reads. */
export const HABIT_METRIC_PALETTE: { metric: string; label: string }[] = [
  { metric: 'weight_logged_today', label: 'Aznapi súlylogolás' },
  { metric: 'stim_intake_today', label: 'Aznapi stim-bevitel (pl. gombakávé)' },
  { metric: 'training_done_today', label: 'Aznapi edzés (gym vagy futás)' },
  { metric: 'breakfast_protein', label: 'Fehérjés reggeli (protein-cél a reggeli slotban)' },
  { metric: 'sleep_wake_window', label: 'Ébredés a cél-ablakban' },
  { metric: 'no_stim_after', label: 'Nincs stim a koffein-cutoff után' },
  { metric: 'last_meal_before', label: 'Konyha zárva (utolsó étkezés időben)' },
  { metric: 'intention_focus_set', label: 'Napi szándék kitűzve' },
  { metric: 'intention_reflected', label: 'Esti szándék-reflexió' },
  { metric: 'ritual_closed', label: 'Napzárás megtörtént' },
  { metric: 'bedtime_next_day', label: 'Lefekvés időben (másnap reggel derül ki)' },
]
```

Test: unique metric keys, non-empty labels, no `manual` entry.
- [ ] **Step 2: Sheets (test-first per sheet)** — both wrap `@/shared/ui/Sheet` with the render-prop close + conditional mount by the opener (the `SleepGoalSheet` skeleton).
  - `ChainEditSheet({ chain?, onClose })`: title text input; daypart pick (three `Chip`-style buttons 🌅 Reggel / ☀️ Napközben / 🌙 Este); create calls `createChain({title, daypart})`, edit calls `updateChain(id, {…changed})`; delete button only for an EDITABLE existing chain (custom + empty; disable with an explainer otherwise — the API 409s on seed/non-empty, surface its toast).
  - `HabitEditSheet({ chainKey, def?, onClose })`: title, miért (textarea), horgony-szöveg, skill picker (LIFE skills from `useProgressionProfile`), XP `Stepper` (5–15), link URL input; CREATE mode additionally: mode toggle (Pipa/MANUAL default ↔ DERIVED) and — when DERIVED — a metric select from `HABIT_METRIC_PALETTE`; EDIT mode shows mode+metric as read-only chips (contract: immutable). Save → `createDef`/`updateDef`; per-field state as local `useState` (house form idiom); disabled CTA while `pending`.
  - Tests: render + save-calls-the-right-mutation-with-the-right-body per sheet (mock mode, jsdom).
- [ ] **Step 3: `RoutineEditorPage` (test-first)** — full-screen page (`PageTitle` „Rutinok szerkesztése", back link to `/me/growth`): chains ordered by position; per chain a `card` with header (daypart emoji + title + active `Toggle` + edit ✏️ opening `ChainEditSheet`) and a `SortableList` of its defs (`renderItem`: `ItemRow`-style row — title, XP chip, MANUAL/DERIVED chip, active `Toggle`, tap → `HabitEditSheet`); `onReorder(ids) => reorderChain(chain.id, ids)`; „+ Új habit" row per chain (opens `HabitEditSheet` create); „+ Új rutin" CTA at the bottom (opens `ChainEditSheet` create); `GhostState` while `isPending` with empty catalog. Inactive chains render dimmed (`is-inert`), still editable. Tests: renders seed catalog (2 chains, 9+6 rows), reorder calls the mutation with the id list, add-habit opens the sheet.
- [ ] **Step 4: Route + entry** — router: `{ path: 'me/routines/edit', element: <RoutineEditorPage /> }` next to `me/goals/new`; RoutinesTab header row gains a trailing „Szerkesztés" ghost button (`cta-ghost`, ✏️) → `useNavigate()('/me/routines/edit')` — only on the today view (past-day view stays read-only-clean). Test: the button navigates (router test idiom used by sibling tests).
- [ ] **Step 5: Gates** — `pnpm test src/features/me src/features/today` both modes; `pnpm build`.
- [ ] **Step 6: Commit** — `feat(me): routine editor page — chains, habits, reorder, sheets (mezo-n5e9.2)`.

---

### Task 4: Living docs

**Files:** `docs/features/habit.md` (§2 surfaces, §5 integrations, §6 consume, §10 key files), `docs/features/today.md` (bucketing source note), `docs/features/me.md` (Growth Rutin tab entry + editor page).

- [ ] Update the three docs (overwrite in place, keep voice): the editor surface + route, the catalog-driven bucketing (CHAIN_FACE/CHAIN_GROUP retired), the new hooks (`useHabitCatalog`/`useHabitCatalogActions` via the barrel), the metric-palette sync note, mock parity. Run `node scripts/lint-docs.mjs` — habit.md/today.md/me.md clean.
- [ ] Commit: `docs(habit): routine editor surface + catalog-driven bucketing in living docs (mezo-n5e9.2)`.

---

### Task 5: Ship (maintainer/main-loop — NOT for a subagent)

- [ ] Full FE gate on the final tree (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`); backend focused habit gate once (`cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g` — FE-only branch, but cheap insurance)
- [ ] Visual goldens: if darwin goldens moved (growth/today), verify each diff is the intended copy change; commit them; linux via `gh workflow run update-visual-baselines.yml -r feat/routine-editor-ui` after push, approve the bot run (`gh api --method POST repos/mrkuhne/mezo/actions/runs/<id>/approve`), `git pull` the bot commit
- [ ] `git fetch origin`; back-merge origin/main if moved (bd union recipe); push; PR; MERGEABLE check; CI table read; worktree-safe `--no-ff` merge; verify bd ids + memories on main; `bd close mezo-n5e9.2`; delete branches; detach at fresh origin/main
