# Goal System G6 — Derived rate + Profile biometrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (per-task implementer + reviewer, ledger in `.git/sdd/progress.md`). Steps use checkbox (`- [ ]`) syntax. **This plan is intentionally structural** (like G1/G3/G4b/G5) — each task names files, behavior, interfaces, and references; the executing session does a short **pattern-extraction (Task 0)** first to ground the concrete code 1:1.

**Goal:** Make the weekly rate **server-derived** from target weight + target date (with a live feasibility preview that suggests a realistic date when the pace is unsafe), and move biometrics out of goal creation into a **Profile "Biometria" section** the engine always reads from (with a hard gate on goal creation).

**Architecture:** Backend derives `rateTargetPctPerWeek` on goal upsert (no longer a client input) + a new stateless `feasibility-preview` endpoint (reuses the G5 rate-band logic) + a derived base-TDEE on the biometric-profile response + a profile-change recompute trigger. Frontend collapses the goal wizard to 2 steps (drops the biometric step + the manual rate), adds a live preview to the cél step, adds a Biometria card + edit sheet to the Profil view, and hard-gates goal creation on a complete profile. No DB migration — every field already exists (G1/G3/G5).

**Tech Stack:** Spring Boot 4 · Java 21 · Maven · MapStruct + Lombok · integration-first ITs (`ApiIntegrationTest`/populators, fixed `mezo_test` :15432) · React 19 + TanStack Query + Vitest/MSW · contract-first OpenAPI.

**Driving issue:** `mezo-06n` (G6), child of epic `mezo-2hp`. **Spec:** `docs/superpowers/specs/2026-06-22-goal-system-g6-derived-rate-and-profile-biometrics-design.md`. **Validated mockups:** `.superpowers/brainstorm/40167-1782123470/content/` (`goal-wizard-v2.html`, `profile-biometria-v2.html`, `hard-gate.html`). **Surface maps (Task 0 grounding):** `.git/sdd/g6-surface-fe.md` + `.git/sdd/g6-surface-backend.md` (+ the G5 `.git/sdd/g5-surface-*.md`).

## Current state (verified surface — what G6 edits)

- **Rate set today:** `GoalService.applyUpsert` (`backend/.../feature/goal/service/GoalService.java:100-117`) line `:115` `e.setRateTargetPctPerWeek(req.getRateTargetPctPerWeek())` — covers create + update. `startWeightKg`/`targetWeightKg`/`startDate`/`targetDate`/`trajectory` are all on the request/entity.
- **Rate-realism (reuse):** `GoalEvaluationService.gradeRate(goal)` (`:156-187`) grades `goal.getRateTargetPctPerWeek().abs()` vs the band; verdict constants `feasible`/`feasible-with-warnings`/`aggressive` (`:57-59`). Both `gradeRate` + `RateGrade` are **private** → extract a pure band→verdict helper for reuse. Config: `GoalEngineProperties.Rate` (`:104-110`) — `props.rate().targetPctPerWeek()` 0.7, `.capPctPerWeek()` 1.0, `.bandLow()` 0.5, `.bandHigh()` 1.0.
- **Contract:** `GoalUpsertRequest.rateTargetPctPerWeek` is at `api/feature/goal/goal.yml:216` and **listed `required` at `:207`**; `GoalResponse` keeps `rateTargetPctPerWeek` (`:137`). The goal `TdeeBootstrap` schema is `goal.yml:142`. Biometric response is `api/feature/biometrics-profile/biometrics-profile.yml` (`BiometricProfileResponse` ~`:31`). Generated FE types in `frontend/src/lib/api.gen.ts` (`GoalUpsertRequest` `:1284`). **No feasibility-preview type/endpoint exists.**
- **TDEE compute (reuse):** `TdeeBootstrapService.compute(BiometricProfileEntity profile, BigDecimal currentWeightKg)` (`feature/goal/engine/service/TdeeBootstrapService.java:71`). Latest weight: `weightLogRepository.findAllOwned(userId)` (date-ascending, `OwnedRepository:18`) → last element, null when empty.
- **Recompute (reuse):** `GoalEngineService.evaluate(UUID userId, UUID goalId)` (`:76`, `@Transactional`, graceful on missing profile); active goal `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId,"active")` (`:19`). Trigger pattern: `WeightLogService.recomputeActiveGoal` (`:48-55`).
- **`BiometricProfileService`:** `getProfile` (`:29`) + `upsertProfile` (`:36`).
- **GoalPlanner.tsx** (`frontend/src/features/me/GoalPlanner.tsx`): manual rate input in `Step1` (`:422-432`, a number input) + state `rate/setRate` (`:52`); biometric `Step2` (component `:449-600`, call-site `:246-250`, state `:55-59`, `ACTIVITY_LEVELS`/`ActivityLevel` `:8-21`); `STEP_COUNT`/`STEP_TITLES` (`:10-11`); `canNext` `step===2` clause (`:68`); nav split `:254/:281`; `save()` profile block (`:74-80`).
- **`useGoalCreation`** (`frontend/src/data/goalHooks.ts:182-209`): `{ profile, goal, activate }` → `biometricProfileApi.upsert(profile)` → `goalApi.create(goal)` → optional `activate` → invalidate `['goals']`.
- **"Új cél" launch:** `navigate('/me/goals/new')` at `GoalsView.tsx:67` (empty-state CTA) + `:91` (header chip); routed flat at `frontend/src/app/router.tsx:102`.
- **ProfileView.tsx:** hero + IdentityGoal (`:64-85`) + EntryCards/shortcuts (`:111-133`); **no sheet state yet** (add a `useState` toggle mirroring `GoalsView.tsx:47 & 316-318`).
- **Sheet idiom:** `frontend/src/components/ui/Sheet.tsx` children-as-function `(close)=>...` (`:8,131`); copy `WeightLogSheet.tsx` skeleton + call the mutation inside the sheet like `EditGoalSheet.tsx` (`mutate(...).then(close)`).

## Global Constraints

- **Grounded constants from `GoalEngineProperties.rate.*` (single source):** `targetPctPerWeek` 0.7, `capPctPerWeek` 1.0, `bandLow` 0.5, `bandHigh` 1.0 (%BW/week). NO FE-hardcoded thresholds — the preview's verdict + suggested date come from the backend.
- **Rate derivation:** `weeks = ChronoUnit.WEEKS.between(startDate,targetDate)` (>0, guarded by the G4b inverted-date validation); `magnitude = |startWeightKg − targetWeightKg| / startWeightKg * 100 / weeks` (%BW/week); store the **unsigned magnitude** (`maintain` → 0); the engine applies the sign by trajectory downstream (G5 — unchanged).
- **Suggested date:** present only when the derived rate `> capPctPerWeek`; `suggestedTargetDate = startDate + ceil(weeksAtCap)`, `weeksAtCap = |startWeight − targetWeight| / startWeight * 100 / capPctPerWeek`. Earliest still-safe date. Maintain/no-target → null.
- **Verdict (reused band logic):** `≤ targetPctPerWeek (0.7)` → `feasible`; `≤ capPctPerWeek (1.0)` → `feasible-with-warnings`; `> cap` → `aggressive`. Never blocks (guards soft, D9).
- **Biometric "complete"** = `sex` + `heightCm` + `birthDate` present. Optional: `bodyFatPct` (→ Katch-McArdle), `activityLevel` (default MODERATE).
- **House standards (`docs/references/`):** contract-first (edit `api/feature/*.yml` first, merge, never hand-write boundary DTOs); constructor DI + `@Transactional` on writes; integration-first ITs (extend `AbstractIntegrationTest`/`ApiIntegrationTest`, populators, AssertJ, no mocks/H2); errors via `SystemMessage`; tunables in `mezo.goal.*` (never `@Value`/hardcode); dual-mode FE (`isMockMode()`, mock seeds synchronously). UUID PKs, `created_by` server-side, soft-delete.
- **No DB migration** — all columns exist. **Scaffold-stub** convention for any contract method whose impl lands later in the same task (`throw new UnsupportedOperationException("G6 Task N: mezo-06n")`, replaced before the task's commit).
- **Deploy gotcha (CRITICAL):** merge commit = push HEAD, NO `[skip ci]`. Order: merge → push (deploy) → THEN bd-close `[skip ci]`.
- **Gates (each task + final):** backend `cd backend && ./mvnw clean test` (always `clean`; Postgres :15432 via `cd backend && docker compose up -d`); contract changed → `cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`; frontend `pnpm test` (both modes) + `pnpm build`; `node scripts/lint-docs.mjs` PASS.

**Natural checkpoint:** backend (Tasks 1–3) is HTTP-verifiable on its own; the FE (Tasks 4–7) consumes it; Task 8 ships.

---

### Task 0: Pattern-extraction (read-only, ground the concrete code)

Reuse `.git/sdd/g6-surface-fe.md` + `.git/sdd/g6-surface-backend.md` (already written) + the G5 `.git/sdd/g5-surface-*.md`. Confirm/refresh (no commit): the exact `GoalService.applyUpsert` rate line + the weeks/start-weight reads; `GoalEvaluationService.gradeRate` + `RateGrade` (what to extract into a pure helper) + the `Rate` config accessors; the `goal.yml` GoalUpsertRequest `required` list + the `TdeeBootstrap` schema; `biometrics-profile.yml` response shape; `TdeeBootstrapService.compute` + the latest-weight read; `WeightLogService.recomputeActiveGoal`; the `GoalPlanner` step/rate/biometric line ranges; `useGoalCreation`; the `Sheet`/`WeightLogSheet`/`EditGoalSheet` idiom; `ProfileView` mount point; the `ApiIntegrationTest` helpers + a biometric/goal populator. Write any gaps to `.git/sdd/g6-surface-supplement.md`.

---

### Task 1: Backend — derive the rate + remove it from the goal-upsert input

**Files:** `api/feature/goal/goal.yml` (remove `rateTargetPctPerWeek` from `GoalUpsertRequest` props `:216` + the `required` entry `:207`); regen (`api/generate` + `frontend pnpm generate:api`). `backend/.../feature/goal/service/GoalService.java` (`applyUpsert` `:115` → derive). Tests: `GoalServiceIT` + `GoalContractIT` (update the request builders that send `rateTargetPctPerWeek`).

**Interfaces — Produces:** goal upsert no longer accepts `rateTargetPctPerWeek`; the entity's `rateTargetPctPerWeek` is server-derived. `GoalResponse.rateTargetPctPerWeek` still carries the derived value.

- **Pair the contract removal with the GoalService change in this one task** (removing the input breaks `:115`'s `req.getRateTargetPctPerWeek()` read → fix it here, compile-safe).
- Derivation (Global Constraints): `weeks = ChronoUnit.WEEKS.between(goal.startDate, goal.targetDate)`; `magnitude = |startWeightKg − targetWeightKg| / startWeightKg * 100 / weeks` (`BigDecimal`, scale + `RoundingMode.HALF_UP` like the G5 sibling divides); `maintain` (or null `targetWeightKg`) → `BigDecimal.ZERO`. Guard `weeks > 0` (the G4b inverted-date validation already rejects `targetDate < startDate`; equal dates → guard against divide-by-zero, treat as 0 or reject per the existing validation).
- ITs: create a **cut** goal (start 84, target 78, 17 wks) → `rateTargetPctPerWeek ≈ 0.42` (`(84−78)/84*100/17`); **bulk** (target > start) → positive magnitude; **maintain** (no target) → 0; updating target/date re-derives. The happy path + the existing eval still work (the derived rate flows to the G5 engine).
- Update `GoalContractIT`/`GoalServiceIT` request builders to NOT send `rateTargetPctPerWeek`.
- `cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`; `cd backend && ./mvnw clean test -Dtest=GoalServiceIT,GoalContractIT` PASS; `cd frontend && pnpm build` (regen valid). Commit `feat(goal): derive rateTargetPctPerWeek from target weight+date; drop it from goal-upsert input (mezo-06n)`.

---

### Task 2: Backend — feasibility-preview endpoint

**Files:** `api/feature/goal/goal.yml` (add `POST /api/goals/feasibility-preview` + `FeasibilityPreviewRequest`/`FeasibilityPreviewResponse`); regen. Create `backend/.../feature/goal/engine/service/GoalFeasibilityService.java`. `GoalEvaluationService.java` (extract the band→verdict + the rate-derivation into a shared pure helper both it and the preview use — keep `gradeRate` behavior). `GoalController.java` (implement the endpoint). Tests: `GoalFeasibilityServiceIT` + a `GoalContractIT`/`FeasibilityPreviewContractIT` HTTP case.

**Interfaces — Consumes:** `GoalEngineProperties.rate.*`. **Produces:** `GoalFeasibilityService.preview(FeasibilityPreviewRequest) → FeasibilityPreviewResponse{ derivedRatePctPerWeek, withinSafeBand, verdict, suggestedTargetDate? }`; a reusable `verdictForRate(BigDecimal ratePctPerWeek) → String` (feasible/with-warnings/aggressive) shared with `GoalEvaluationService`.

- Request `FeasibilityPreviewRequest { trajectory, startWeightKg, targetWeightKg?, startDate, targetDate }`. Stateless — no goal, no persistence, no ownership needed (still resolve `currentUserId.get()` per controller convention but the compute ignores it).
- `derivedRatePctPerWeek` — the SAME derivation as Task 1 (share the helper). `withinSafeBand = derivedRate ≤ capPctPerWeek`. `verdict = verdictForRate(derivedRate)`. `suggestedTargetDate` — only when `derivedRate > cap`: `startDate + ceil(weeksAtCap)` (Global Constraints); maintain/no-target → null.
- Refactor: extract `verdictForRate` (and optionally the derivation) so `GoalEvaluationService.gradeRate` and `GoalFeasibilityService` share one band definition (no divergence). Keep `gradeRate`'s existing behavior + its IT green.
- If the regen makes `GoalController` implement an abstract `feasibilityPreview` method, implement it in this task (no surviving stub).
- ITs: within-band (rate 0.6) → `withinSafeBand=true`, verdict `feasible`, `suggestedTargetDate=null`; aggressive (target+date forcing 1.3%/wk) → `withinSafeBand=false`, verdict `aggressive`, `suggestedTargetDate` = the cap-paced date (verify the math: `weeksAtCap = (84−78)/84*100/1.0 ≈ 7.14 → 8 wks → startDate+8wk`); maintain → rate 0, null suggestion. HTTP: `POST /api/goals/feasibility-preview` (owner auth) → 200 with the body.
- Gates as above. Commit `feat(goal): stateless feasibility-preview (derived rate + verdict + realistic-date suggestion) (mezo-06n)`.

---

### Task 3: Backend — biometric profile derived base-TDEE + recompute on profile change

**Files:** `api/feature/biometrics-profile/biometrics-profile.yml` (add nullable `tdeeBootstrap` to `BiometricProfileResponse`, cross-`$ref` the goal `TdeeBootstrap` schema); regen. `BiometricProfileService.java` (`getProfile` → compute `tdeeBootstrap`; `upsertProfile` → recompute active goal) + the mapper. Tests: `BiometricProfileServiceIT` / `BiometricProfileContractIT`.

**Interfaces — Consumes:** `TdeeBootstrapService.compute(profile, currentWeightKg)`; `GoalEngineService.evaluate(userId, goalId)`; `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId,"active")`; `weightLogRepository.findAllOwned(userId)`. **Produces:** `BiometricProfileResponse.tdeeBootstrap` (derived, nullable); a profile-save recompute trigger.

- `getProfile`: latest weight = `findAllOwned(userId)` last element (null when empty); if both profile + weight present → `tdeeBootstrap = TdeeBootstrapService.compute(profile, latestWeight)` mapped onto the response; else `tdeeBootstrap = null`. Derived, NOT persisted.
- `upsertProfile`: after the save, recompute the active goal (copy `WeightLogService.recomputeActiveGoal` `:48-55` — find the active goal, if present `goalEngineService.evaluate(userId, activeGoalId)`; no-op when none; never break the save — the G5 graceful contract holds). Beware DI: `BiometricProfileService` gains `GoalEngineService` + the goal/weight repos — verify no cycle (the engine depends on repos, not on `BiometricProfileService`).
- ITs: profile GET with a profile + a weigh-in → `tdeeBootstrap` non-null (bmr/tdee match the worked numbers); no weigh-in → `tdeeBootstrap=null`; upserting a profile with an active goal → the goal's `prescription` recomputes (was null → populated, or `generatedAt` changes); no active goal → upsert succeeds, no crash. Full `./mvnw clean test` once (DI/context).
- Gates as above. Commit `feat(goal): derived base-TDEE on biometric profile + recompute active goal on profile change (mezo-06n)`.

---

### Task 4: FE — reshape the goal wizard (2 steps, drop biometrics + manual rate)

**Files:** `frontend/src/features/me/GoalPlanner.tsx` (remove Step 2 + the rate input; `STEP_COUNT` 3→2; `canNext`/nav fixes; `save()` drops the `profile` block + the `rateTargetPctPerWeek`). `frontend/src/data/goalHooks.ts` (`useGoalCreation` drops the `profile` PUT + the `profile` field of `GoalCreationInput`). Tests: `GoalPlanner.test.tsx`, `goalCreation.test.tsx` (both modes).

**Interfaces — Consumes:** the Task-1 contract (no `rateTargetPctPerWeek` in the create body). **Produces:** a 2-step wizard (trajectory+guards → cél: title+targetWeight+targetDate); `useGoalCreation({ goal, activate })` (no `profile`).

- Delete the `Step2` component + call-site + state (`:55-59`, `:8-21`, `:246-250`, `:449-600`); delete the rate input + `rate` state (`:52`, `:422-432`); `STEP_COUNT`=2, drop `STEP_TITLES[2]`; fix `canNext` (drop the `step===2` clause; step 1 is now the final/save step) + the prev/next nav split (`:254/:281`). `save()` no longer sends `profile` or `rateTargetPctPerWeek` (`:74-80`, `:89`).
- `useGoalCreation`: drop `biometricProfileApi.upsert(profile)` + the `profile` field; chain becomes `goalApi.create(goal)` → optional `activate` → invalidate `['goals']`.
- Tests: the wizard shows exactly 2 steps, no rate input, no biometric fields; creating a goal calls `goalApi.create` with NO `rateTargetPctPerWeek`/`profile`; mock mode renders. (The live preview is Task 5.)
- `pnpm test` (both modes) + `pnpm build` green. Commit `feat(goal): 2-step goal wizard — drop manual rate + biometric step (mezo-06n)`.

---

### Task 5: FE — live feasibility preview in the cél step

**Files:** `frontend/src/lib/goalApi.ts` (add `feasibilityPreview(body) → FeasibilityPreviewResponse`). `frontend/src/features/me/GoalPlanner.tsx` (the cél step renders the preview panel). Mock: `frontend/src/data/goals.ts` (a static mock preview for mock mode). Tests: `GoalPlanner.test.tsx` (both modes).

**Interfaces — Consumes:** `POST /api/goals/feasibility-preview` (Task 2). **Produces:** the wizard's live rate panel + the suggested-date accept.

- `goalApi.feasibilityPreview({ trajectory, startWeightKg, targetWeightKg, startDate, targetDate })` → the generated `FeasibilityPreviewResponse`. Real mode calls it (debounced) on targetWeight/targetDate change; mock mode returns a static preview (`data/goals.ts`).
- Render (mockup `goal-wizard-v2.html`): a feasibility panel — `withinSafeBand` → brand-tinted "X %BW/hét · ✓ Reális" + the kg/weeks summary; `aggressive` → warning-tinted "X %BW/hét · ⚠ Agresszív" + a "↦ Reális dátum: <suggestedTargetDate> — Elfogadom" action that sets `targetDateIso` to the suggestion (→ re-previews). The CTA stays enabled (soft — the user may proceed). HU labels; the app token/inline-style idiom (`var(--brand-glow)`/`var(--warning)`).
- Tests: feasible state renders the rate + verdict; aggressive state renders the warning + the accept sets the target date (assert the new date + re-preview); the preview body is sent correctly (assert via MSW); mock mode renders a static preview.
- `pnpm test` (both modes) + `pnpm build` green. Commit `feat(goal): live feasibility preview + realistic-date suggestion in the cél step (mezo-06n)`.

---

### Task 6: FE — Biometria card + BiometricSheet (Profil)

**Files:** Create `frontend/src/features/me/components/BiometricCard.tsx` + `frontend/src/features/me/BiometricSheet.tsx`. `frontend/src/data/` — a `useBiometricProfile()` hook (real: `biometricProfileApi.get()`, **404 → null**; mock: a static profile). `frontend/src/features/me/views/ProfileView.tsx` (mount the card + the sheet toggle). Tests: `BiometricCard`/`BiometricSheet`/`ProfileView` (both modes).

**Interfaces — Consumes:** `biometricProfileApi.get()`/`.upsert()`; `BiometricProfileResponse.tdeeBootstrap` (Task 3). **Produces:** `useBiometricProfile() → { profile|null, isComplete, ... }` (reused by the Task-7 gate); the Profil Biometria card + editor.

- `useBiometricProfile()`: real-mode fetch (handle the 404→null for an absent profile — `biometricProfileApi.get()` 404s when none); expose `isComplete = !!(profile && profile.sex && profile.heightCm && profile.birthDate)`. Mock mode → a static complete profile. Re-export from `data/hooks.ts`.
- `BiometricCard` (mockup `profile-biometria-v2.html`): notch-clipped card with the brand accent — sex/height/age(from birthDate)/bodyFat/activity + the derived base-TDEE line (from `profile.tdeeBootstrap`, omit when null); "Szerkesztés ›" opens the sheet; empty-state ("Állítsd be a biometriád") when no profile.
- `BiometricSheet` (`Sheet` children-as-function, copy `WeightLogSheet`/`EditGoalSheet`): Nem (segmented M/F), Magasság (cm), Születési dátum (date), Testzsír% (optional), Aktivitási szint (5 options → PAL, default MODERATE) → `biometricProfileApi.upsert` → on success invalidate `['biometricProfile']` (+ `['goals']` since the active goal recomputes server-side) → `close()`.
- `ProfileView`: mount `<BiometricCard>` after the IdentityGoal block (`:85`) + a sheet-toggle `useState` (mirror `GoalsView.tsx:47 & 316-318`).
- Tests: card displays the profile + base TDEE (and the empty state when none); the sheet upserts (assert the body + the invalidations); mock mode renders.
- `pnpm test` (both modes) + `pnpm build` green. Commit `feat(goal): Biometria card + editor sheet in the Profil view (mezo-06n)`.

---

### Task 7: FE — hard gate on goal creation

**Files:** `frontend/src/features/me/views/GoalsView.tsx` (the "Új cél" entries `:67`/`:91` — gate on `useBiometricProfile().isComplete`); a small gate interstitial (in `GoalsView` or a `GoalGate` component) OR route the wizard through a guard. Tests: `GoalsView.test.tsx` (both modes).

**Interfaces — Consumes:** `useBiometricProfile().isComplete` + the `BiometricSheet` (Task 6). **Produces:** goal creation is reachable only with a complete biometric profile.

- On "Új cél" tap: if `isComplete` → `navigate('/me/goals/new')` (the wizard). If not → show the gate interstitial (mockup `hard-gate.html`: "Előbb: a biometriád" + the missing-field chips + "Biometria beállítása →") which opens the `BiometricSheet`; on save + now-complete → continue into the wizard (navigate). Never drop into the wizard without a usable profile.
- Both entry points (`:67` empty-state CTA + `:91` header chip) go through the gate.
- Tests: incomplete profile → "Új cél" shows the gate (not the wizard) + opens the sheet; after upsert → routes to the wizard; complete profile → straight to the wizard; mock mode (complete static profile) → straight to the wizard.
- `pnpm test` (both modes) + `pnpm build` green. Commit `feat(goal): hard-gate goal creation on a complete biometric profile (mezo-06n)`.

---

### Task 8: Full gates + docs + ship

- Backend `cd backend && ./mvnw clean test` SUCCESS (full suite). Contract regen in sync. Frontend `pnpm test` both modes + `pnpm build`. `node scripts/lint-docs.mjs` PASS.
- **Docs:** update `docs/features/me.md` (the 2-step wizard + live preview; the Profil Biometria card + sheet + hard gate), `docs/features/goal-engine.md` (derived rate + the feasibility-preview endpoint + the suggested-date logic + the profile-change recompute trigger; base-TDEE on the profile), `docs/features/_platform-api-backend.md` (the new endpoint + the dropped upsert field + the derived profile field), `_platform-data-layer.md` (`useBiometricProfile`, `goalApi.feasibilityPreview`, `useGoalCreation` no longer PUTs the profile). **Also clear the pre-existing G5-residue stale flags** on `_platform-api-backend.md` + `me.md` (verify-then-bump or content-update — they drifted from the G5 fix commit). `file:line` pointers, no pasted code. `lint-docs` PASS.
- Then the **final whole-branch review (opus)** + **merge to main (`--no-ff`, merge commit = push HEAD, NO `[skip ci]`) + deploy (push-to-deploy + ArgoCD)** + verify the deploy (CI run + `kubectl`/public URL) + close `mezo-06n`. File follow-ups for any deferred Minors. Commit `docs(goal): G6 feature + platform docs (mezo-06n)`.

---

## Post-G6

- The goal-system Phase-2 surface is then complete: derived-rate creation + profile-driven biometrics + the live engine. Remaining: Phase 3 (adaptive TDEE on Fuel Slice C, AI evaluator, weekly recompute) + the open follow-ups (`mezo-m1l` ambient band, `mezo-nde` config tunables, `mezo-sxg` hero projection, `mezo-k7d` flaky timer, `mezo-3ny`, `mezo-ojk`).
