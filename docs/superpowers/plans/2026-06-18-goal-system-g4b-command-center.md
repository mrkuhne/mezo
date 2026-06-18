# Goal System — G4b Command-Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (per-task implementer + reviewer, ledger in `.git/sdd/progress.md`). Steps use checkbox (`- [ ]`) syntax. **This plan is intentionally structural** — each task names the files, behavior, and references; the executing session should do a short **pattern-extraction** first (Task 0) to ground the concrete code, exactly as slices G1/G3 did.

**Goal:** Turn `GoalsView` into the command-center: a **timeline lane view** of the goal's window (gym/run bars + gap-resolver + ambient volleyball band), a **plan attach/detach hub**, **goal management** (archive/delete/activate), retire the `toGoal` back-compat mapper, and fix the `rateTarget` display — plus a small backend inverted-date guard.

**Architecture:** Frontend-heavy. The data already flows: `useGoal()` returns `{ goal, linkedMesocycles, timeline }`-shaped data (see "Current state"); `goalLinkApi` (attach/detach/timeline), `goalApi` (create/update/activate/archive/remove), `biometricProfileApi`, and the `GoalTimelineResponse` (links + gaps) are all live (G1–G3). The existing planners `MesocyclePlanner` (`/train/mesocycles/new`) + `RunningBlockBuilder` (`/train/futas/:id`) are launched from the hub. One small backend change: a `targetDate >= startDate` validation on goal upsert.

**Tech Stack:** React 19 · react-router-dom · TanStack Query · Vitest + MSW · (backend) Spring Boot 4 + MapStruct + integration tests.

**Driving issue:** `mezo-tji` (G4b), child of epic `mezo-2hp`. **Folds in:** `mezo-5om` (rateTarget display) + `mezo-b0k` (inverted-date 500). **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md` (§2 timeline coupling, §5 prescription, decisions D3–D6). **Mockups:** `.superpowers/brainstorm/8732-1781770664/content/goal-timeline.html` (the lane view — bars per week + gap-resolver) + `goal-funnel.html` (the hub slots).

## Current state (what G4b builds on — already shipped G1–G4a + 2 fixes)

- **Backend (live):** `feature/goal/` — `GoalEntity` (trajectory cut|bulk|maintain + guards text[] + window start_date/target_date + weights + rate, **NO `weeks` field** — window length is `ChronoUnit.WEEKS.between(startDate,targetDate)`), `GoalService` (CRUD + activate/archive + link cascade on delete), `GoalPlanLinkEntity`/`GoalPlanLinkService` (attach/detach/list, `end_week` derived), `GoalTimelineService` (links + gym-lane gaps), `GoalController` (`/api/goals*` + `/api/goals/{id}/timeline|plans`). `BiometricProfile` aggregate. Endpoints: list/get/create/update/delete/activate/archive goals; timeline/attach/detach plans; get/upsert profile.
- **Frontend (live):** `frontend/src/data/goalHooks.ts` — `useGoal()` returns `{ goal: Goal | null, linkedMesocycles }` (real-mode no-goal → `goal:null`; mock → mockGoal). It internally fetches the goal's timeline (`goalLinkApi.timeline`) and builds `linkedMesocycles` + `goal.mesocycles` from `GoalTimelineResponse.links`. `useGoalCreation()` (PUT profile → POST goal → optional activate). `goalApi` (`list/get/create/update/remove/activate/archive`), `goalLinkApi` (`timeline/attach/detach`), `biometricProfileApi` (`get/upsert`).
- **GoalsView** (`frontend/src/features/me/views/GoalsView.tsx`): empty-state guard when `!goal` (GhostState + `＋ Új cél`); otherwise the goal hero (uses the back-compat `Goal` shape via `toGoal`), Mezo insights, Factors, and a "Cél alatt fut" linked-mesos cards section (`goal.mesocycles.map(mid => linkedMesocycles[mid])` → `LinkedMesoCard`). `EditGoalSheet` (read-only display). `＋ Új cél` header chip → `/me/goals/new` wizard (`GoalPlanner`).
- **WeightView** (`/me/weight`) reads `useGoal()` null-safe for the chart reference lines. **GoalPlanner** wizard at `/me/goals/new` (G4a). Súly tab (G2). Plan-links (G3).
- **Prod:** `demodata` profile = OWNER ONLY now (demo goal/training seeds moved to `demofixtures`). So a real prod user starts with no goal → empty state.

## Global Constraints

- **House standards:** FE — match the existing inline-style idiom + design tokens (CSS vars), Hungarian UI, dual-mode (`isMockMode()` in hook bodies; mock seeds synchronously). Backend — UUID/OwnedEntity/soft-delete/`@Transactional`-on-writes/`SystemMessage` errors/contract-first/integration-first tests (see `docs/references/`).
- **Reuse, don't rebuild:** `goalLinkApi`/`goalApi`/`biometricProfileApi`, `useGoal`, `GoalPlanner`, `MesocyclePlanner`/`RunningBlockBuilder` (launched, not modified), `GhostState`, `LinkedMesoCard` (or a new timeline component). The timeline lane should consume the SAME `GoalTimelineResponse` `useGoal` already fetches (expose `timeline` from `useGoal`, or a `useGoalTimeline()` sibling) — don't refetch redundantly.
- **`toGoal` retirement:** as GoalsView migrates to render the real `GoalResponse` + `GoalTimelineResponse` directly, remove the `toGoal` back-compat mapper where it's no longer needed. Keep `WeightView`/`FuelStackView` working (they read `linkedMesocycles`/weight — adjust if the `useGoal` shape changes; update their tests).
- **Deploy gotcha (CRITICAL):** when merging to main, the **merge commit MUST be the push HEAD with NO `[skip ci]`** — GitHub natively skips the whole run if the push's head commit message contains `[skip ci]`. Order: merge → push (triggers deploy) → THEN bd-close `[skip ci]` commits. (Recorded in bd memory `deploy-gotcha-never-put-skip-ci-on-the`.)
- **Gates:** backend `cd backend && ./mvnw clean test` (always `clean`); contract (if changed) `cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`; frontend `pnpm test` (both modes) + `pnpm build`; `node scripts/lint-docs.mjs` PASS.
- **Scope boundary:** G4b is the command-center + goal management + the two folded follow-ups. The **TDEE/recept engine is G5** (do NOT build the prescription/TDEE compute here — the hero may show a recept *placeholder* per the mockup, but no real engine).

---

### Task 0: Pattern-extraction (read-only, ground the concrete code)

Run a short pattern-extraction (parallel read-only agents or inline reads) to capture, with `file:line` + excerpts, the concrete patterns the later tasks need:
1. The **current `GoalsView.tsx`** in full (post-empty-state) — the hero, the "Cél alatt fut" section, the EditGoalSheet usage, the header — so the restructure is surgical.
2. The **`goal-timeline.html`** mockup (the lane view: week ruler, per-lane bars positioned by grid-column, the gap-resolver chips, the recept-segment strip) — the target design.
3. **`useGoal`/`goalHooks.ts`** (current return shape) + `goalLinkApi`/`goalApi` signatures (attach/detach/timeline/archive/remove/activate) + `GoalTimelineResponse`/`GoalResponse` generated types.
4. How **`MesocyclePlanner`/`RunningBlockBuilder`** are launched (routes, navigate) + how the train hooks list the user's existing mesos/running (for the attach picker) — `useTrain()`/`useRunning()`.
5. A **sheet/menu pattern** for goal management (the `Sheet` component + how other features do an action menu) + the `EditGoalSheet` to extend.
6. Backend: `GoalService.applyUpsert` (where the inverted-date guard goes) + the `SystemMessage.field(...)` error idiom + an existing field-validation IT.

Write the findings to a file the later tasks reference. (No commit — this is research.)

---

### Task 1: Backend — inverted-date guard (`mezo-b0k`)

**Files:** `feature/goal/service/GoalService.java` (validate in `applyUpsert` or `createGoal`/`updateGoal`); test `GoalServiceIT` / `GoalContractIT`.

- Validate `targetDate >= startDate` on goal upsert; on violation throw `SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "targetDate").build(), HttpStatus.BAD_REQUEST)` (confirm the exact code/idiom via Task 0). This closes the `GoalTimelineService` 500 on inverted dates.
- IT: creating a goal with `targetDate < startDate` → 400 field error on `targetDate`; the happy path still works.
- `./mvnw clean test -Dtest=GoalServiceIT,GoalContractIT` → PASS. Commit `feat(goal): reject inverted goal window (targetDate >= startDate) (mezo-b0k via mezo-tji)`.

---

### Task 2: Expose the timeline from `useGoal` (data-layer prep)

**Files:** `frontend/src/data/goalHooks.ts`; tests.

- `useGoal()` already fetches `timeline` internally — expose it in the return: `{ goal, linkedMesocycles, timeline, goalId }` (so the timeline lane + hub can render gaps/links + attach to the right goal). Keep mock mode returning a static/empty `timeline` (add a mock timeline to `data/goals.ts` mirroring the static `linkedMesocycles`, OR `timeline: null` in mock and have the lane fall back to `linkedMesocycles`).
- Add goal-management mutations: a `useGoalActions()` (or extend a hook) exposing `archive(id)`/`remove(id)`/`activate(id)` (→ `goalApi.*`) + `attachPlan`/`detachPlan` (→ `goalLinkApi.*`), each invalidating `['goals']` + `['goal', goalId, 'timeline']` in real mode (mock optimistic/no-op). Re-export from `hooks.ts`.
- Tests: real-mode `useGoal` exposes `timeline`; the actions call the right endpoints + invalidate. Both modes green + build. Commit.

---

### Task 3: `GoalTimeline` lane component (the signature view)

**Files:** `frontend/src/features/me/components/GoalTimeline.tsx` (+ test).

- Render the `GoalTimelineResponse` as the `goal-timeline.html` mockup: a week ruler (1..weeks), a **gym lane** (mesocycle-type links as bars positioned by `startWeek..endWeek` via CSS grid-columns) with the **gap chips** (from `timeline.gaps`, e.g. "W7–8 fedezetlen" + resolver affordances — for G4b the resolver chips can navigate to the meso planner / be informational), a **running lane** (running_block links, episodic), and an **ambient volleyball band** (from `useTrain().sport` schedule, constant — read-only). Use `color-mix` tokens (gym=brand-glow, run=info, volleyball=cat-tendency) per the mockup.
- Props: `{ timeline: GoalTimelineResponse, onDetach?: (linkId) => void }`. Pure presentational + an optional detach affordance per bar.
- Test: renders bars for links + gap chips for gaps (mock a `GoalTimelineResponse`). Commit.

---

### Task 4: `GoalsView` restructure — timeline + goal management

**Files:** `GoalsView.tsx`; `EditGoalSheet.tsx` (make it a real manage sheet: edit entry + **Archiválás** + **Törlés** actions → `useGoalActions`); tests.

- Replace the "Cél alatt fut" cards section with `<GoalTimeline timeline={timeline} onDetach={...} />` (keep the goal hero + insights + factors; the hero may show a **recept placeholder** card per mockup — NO real engine, that's G5).
- `EditGoalSheet` (opened from the hero) gains **Archiválás** (`archive`) + **Törlés** (`remove`, with a confirm) → on success, the goal list refetches → if no active goal remains, GoalsView shows the empty state. This gives the user goal-deletion (the demo-goal removal need).
- **Retire `toGoal` where redundant:** migrate the hero to read the real `GoalResponse` fields directly where it cleanly can (trajectory/guards/window/weights), removing the back-compat mapper's now-unneeded fields. (Pragmatic: retire incrementally — keep what `WeightView`/`FuelStackView` still need; update those + their tests if the `useGoal` shape changes.)
- Tests: GoalsView renders the timeline lane (real mode with a goal+links); the manage sheet's archive/delete call the actions + the empty state appears after delete; mock mode still renders. Both modes + build. Commit.

---

### Task 5: Attach/detach hub — plan slots

**Files:** a hub section in `GoalsView` (or a `GoalPlanSlots.tsx` component) + an attach picker sheet (`AttachPlanSheet.tsx`); tests.

- Under the timeline, **plan slots**: "Mesociklus" + "Futóblokk" slots. Each: if the gym/run lane is empty → a `＋ Tervezd` CTA launching the existing planner (`navigate('/train/mesocycles/new')` / the running builder) AND a `＋ Csatolj meglévőt` opening `AttachPlanSheet`.
- `AttachPlanSheet`: lists the user's existing owned mesos (`useTrain().mesocycles`) / running blocks (`useRunning().runningBlocks`) NOT already linked, + a start-week input → `attachPlan(goalId, { planType, planId, startWeek })`. Detach is the per-bar affordance from Task 3 (`detachPlan`).
- Volleyball is NOT attachable (ambient) — the lane shows it read-only.
- Tests: the attach sheet lists candidate plans + attach calls `goalLinkApi.attach` with the right body; detach calls `goalLinkApi.detach`. Both modes + build. Commit.

---

### Task 6: `rateTarget` display fix (`mezo-5om`)

**Files:** `GoalsView.tsx` / `EditGoalSheet.tsx` (wherever `rateTarget` renders); tests.

- The contract carries `rateTargetPctPerWeek` (%BW/week). Display it correctly as `%/hét` (and/or convert to kg/week using `currentWeight` if the design prefers kg) — decide per the hero design; ensure mock + real agree. Remove the stale `kg/hét` label assumption from `toGoal`. Closes `mezo-5om`.
- Tests updated. Commit.

---

### Task 7: Full gates + docs

- Backend `./mvnw clean test` (G4b backend = just Task 1) → SUCCESS. Frontend both modes + build. `node scripts/lint-docs.mjs` PASS.
- Update `docs/features/me.md` (the Cél command-center: timeline lane, attach/detach hub, goal management, retired toGoal) + `_platform-data-layer.md`/`_platform-api-backend.md` if the surface changed. `file:line` pointers, no pasted code. Bump incidentally-drifted docs' `updated:` only if verified-current.
- Commit. Then the **final whole-branch review (opus)** + **merge to main (`--no-ff`, merge commit = push HEAD, NO `[skip ci]`) + deploy** + close `mezo-tji`/`mezo-5om`/`mezo-b0k`.

---

## Post-G4b

- **G5** — the TDEE/recept **engine**: formula-TDEE from `BiometricProfile` (captured in G4a) + heuristic eval (feasibility: rate realism, guard satisfiability, conflicts) + the **segmented `GoalPrescription`** (kcal/protein → Fuel, sleep → Sleep, deload/rest → Train) per the grounded §6 numbers (`docs/research/queries/2026-06-18-goal-engine-numbers.md`). The **adaptive** part needs **Fuel calorie-logging (Slice C)** — sequence Fuel first or build formula-only and gate adaptive.
- **Phase 3** — AI brain: adaptive TDEE refit, AI evaluation (Spring AI), pattern engine.
- **Remaining cleanups:** `mezo-4nu` (G1 polish), `mezo-jal` (research ingestion), `mezo-ksh` (docs drift).
