# Goal System G6 — Derived weekly rate + Profile biometrics — Design

**Status:** Approved (brainstorm 2026-06-22, mockups validated). **Driving issue:** `mezo-06n` (G6), child of epic `mezo-2hp`. **Builds on:** G1–G5 (engine live, v0.15.0). **Mockups (validated, app design-system):** `.superpowers/brainstorm/40167-1782123470/content/` — `goal-wizard-v2.html` (smart rate), `profile-biometria-v2.html` (Profil card + sheet), `hard-gate.html` (biometrics-first gate).

## 1. Context & motivation

Two UX corrections to the shipped goal-system, surfaced by the user after using G1–G5:

1. **The weekly rate is entered manually today** (`GoalPlanner` Step 1, `rate` slider default 0.7 → `rateTargetPctPerWeek`). That is wrong: the user should give a **target weight + target date**, and the app should **compute the required pace** — and when the implied pace is unsafe, **suggest a realistic target date**.
2. **Biometrics (sex/height/birthDate/bodyFat/activityLevel) are captured inside goal creation** (`GoalPlanner` Step 2). That is wrong: they belong in a **one-time Profile section** the engine always reads from; goal creation should not re-ask them.

Neither changes the engine *core* (TDEE/projection/eval/prescription from G5) — only **where the rate comes from** (derived, not entered) and **where biometrics live** (Profile, not the wizard).

## 2. Approved decisions

| # | Decision |
|---|---|
| **D1** | **Rate is server-derived** from `(startWeight, targetWeight, weeks)`. `rateTargetPctPerWeek` stays in the data model but is **no longer a client input** — the goal upsert computes + stores it. |
| **D2** | **Infeasible pace → warn + suggest a realistic date.** A stateless **feasibility-preview** endpoint returns the derived rate, a verdict, and (when the derived rate exceeds the safe cap) the **earliest realistic `targetDate`** computed from the cap (`mezo.goal.rate.cap-pct-per-week`, 1.0 %BW/wk). The wizard shows it live with a one-tap "Elfogadom". |
| **D3** | **Biometrics → a first-class "Biometria" card in the Profil view** (`/me`) + a `BiometricSheet` editor. The card also shows the derived **base TDEE**. |
| **D4** | **Hard gate:** goal creation requires a **complete** biometric profile (sex + heightCm + birthDate). If incomplete, the "Új cél" entry routes to the Biometria editor first, then returns to goal creation. |
| **D5** | **Wizard collapses to 2 steps:** ① trajectory + guards → ② cél (title + target weight + target date, with the live feasibility preview). The biometric step and the manual rate input are **removed**. |

**Out of scope (non-goals):** the G5 engine internals (TDEE/projection/eval/prescription/guards) are unchanged; no adaptive TDEE; no manual-rate override (pure-derived per the user); no new persisted columns (all fields already exist).

## 3. Change 1 — Derived weekly rate

### 3.1 Derivation (backend, on goal create/update)
On goal upsert, the backend derives and persists `rateTargetPctPerWeek` instead of accepting it from the client:

```
weeks      = ChronoUnit.WEEKS.between(startDate, targetDate)   // > 0, guarded (G4b)
magnitude  = |startWeightKg − targetWeightKg| / startWeightKg / weeks * 100   // %BW/week
rate       = trajectory == maintain ? 0
           : trajectory == cut      ? +magnitude   // stored magnitude; sign semantics per existing engine
           : /* bulk */               +magnitude
```
- `maintain` has no `targetWeightKg` → rate `0`.
- The stored value feeds the G5 engine unchanged (projection, eval gate, prescription). The eval gate's existing rate-realism check still flags `aggressive` when the derived rate exceeds the cap.
- `startWeightKg` is the activation-time snapshot (latest weigh-in), exactly as today.

### 3.2 Feasibility-preview endpoint (new, stateless)
The wizard needs the derived rate + realism **before** committing, so it can show the live preview + the suggested date. A stateless preview (no persistence, no goal):

- **`POST /api/goals/feasibility-preview`**
- Request `FeasibilityPreviewRequest { trajectory, startWeightKg, targetWeightKg?, startDate, targetDate }`
- Response `FeasibilityPreviewResponse { derivedRatePctPerWeek, withinSafeBand, verdict, suggestedTargetDate? }`
  - `derivedRatePctPerWeek` — §3.1.
  - `withinSafeBand` — `derivedRate ≤ mezo.goal.rate.cap-pct-per-week` (1.0).
  - `verdict` — reuses the G5 eval-gate rate-realism logic: `feasible` (≤ target 0.7) / `feasible-with-warnings` (0.7–1.0) / `aggressive` (> 1.0).
  - `suggestedTargetDate` — present **only when `!withinSafeBand`**: `startDate + ceil(weeksAtCap)` where `weeksAtCap = |startWeight − targetWeight| / startWeight / (cap/100)`. This is the **earliest realistic** date (the cap is the fastest still-safe pace). Maintain/no-target → null.
- Single source of truth for the cap/band constants: the existing `GoalEngineProperties` (`mezo.goal.rate.*`). No FE-hardcoded thresholds.

### 3.3 Wizard preview UX (mockup `goal-wizard-v2.html`)
Step 2 (cél), on target-weight/target-date change (debounced), calls the preview and renders a feasibility panel:
- **Within band:** brand-tinted — "0,6 %BW/hét · ✓ Reális" + "≈X kg · N hét". CTA enabled.
- **Aggressive:** warning-tinted — "1,3 %BW/hét · ⚠ Agresszív" + a warning sub-action **"↦ Reális dátum: <suggestedTargetDate> — Elfogadom"** that sets `targetDate` to the suggestion (one tap → re-previews → green). CTA de-emphasized but not blocked (guards are soft, D9 — the user may still proceed).

### 3.4 Contract change
- `GoalUpsertRequest`: **remove `rateTargetPctPerWeek`** from the input (server-derived). `GoalResponse` keeps carrying the derived value.
- Add `FeasibilityPreviewRequest`/`FeasibilityPreviewResponse` + the `POST /api/goals/feasibility-preview` operation.

## 4. Change 2 — Profile biometrics

### 4.1 Biometria card in ProfileView (mockup `profile-biometria-v2.html`)
A new first-class card in `ProfileView` (`/me`), notch-clipped with the brand accent:
- Read-only display of `sex` / `heightCm` / `age` (from `birthDate`) / `bodyFatPct` / `activityLevel`.
- A derived **base TDEE** line (≈ kcal/nap) — see §4.4.
- A "Szerkesztés ›" affordance opening the `BiometricSheet`.
- **Empty state** (no profile yet): the card shows a "Állítsd be a biometriád" prompt opening the sheet.

### 4.2 `BiometricSheet` editor
A `Sheet` (the app's bottom-sheet idiom) editing the biometric profile → `biometricProfileApi.upsert`:
- **Nem** (segmented M/F), **Magasság** (cm), **Születési dátum** (date), **Testzsír %** (optional → enables Katch-McArdle, labelled "→ pontosabb TDEE"), **Aktivitási szint** (5 options → PAL, default MODERATE).
- **Mentés** → upsert → invalidate the profile query (and any goal prescription, since TDEE changed → the active goal recomputes via the G5 weight-log/activate triggers; an explicit profile-change recompute is added — see §4.5).
- **Required for "complete":** `sex` + `heightCm` + `birthDate`. **Optional:** `bodyFatPct`, `activityLevel` (defaults MODERATE).

### 4.3 Hard gate (mockup `hard-gate.html`)
Tapping **"Új cél"** checks the biometric profile:
- **Complete** → goal wizard opens (2 steps).
- **Incomplete** → a gate interstitial ("Előbb: a biometriád" + the missing-field chips + "Biometria beállítása →") opens the `BiometricSheet`; on save, the flow continues into the goal wizard. The user is never dropped into goal creation without a usable profile.

### 4.4 Base TDEE on the profile
`BiometricProfileResponse` gains a **derived, non-persisted** `tdeeBootstrap` (computed on GET via the existing `TdeeBootstrapService.compute(profile, latestWeight)`), so the Biometria card can show the base TDEE independent of any goal. Null when no weigh-in exists yet (card omits the TDEE line).

### 4.5 Wizard reshape + flow separation
- `GoalPlanner`: **delete Step 2 (biometrics)** and the **manual rate input** in Step 1. New shape: Step 0 trajectory+guards → Step 1 title + targetWeight + targetDate + the live preview (§3.3).
- `useGoalCreation` no longer PUTs the biometric profile (that now happens in the `BiometricSheet`); it becomes POST goal (with derived rate) → activate. The biometric profile is a precondition (the hard gate), not a wizard payload.
- A profile change (`BiometricSheet` save) triggers a recompute of the active goal's prescription (extend the G5 recompute triggers: activate/attach/detach/weight-log **+ biometric-profile-change**).

## 5. Data & contract summary

- **No schema/migration change** — `goal.rate_target_pct_per_week`, `goal.target_weight_kg`, `goal.target_date`, `biometric_profile.*` (incl. `activity_level`, `body_fat_pct`) all exist (G1/G3/G5).
- **Contract:** drop `rateTargetPctPerWeek` from `GoalUpsertRequest`; add `tdeeBootstrap` (derived) to `BiometricProfileResponse`; add `FeasibilityPreview` request/response + `POST /api/goals/feasibility-preview`. Regenerate FE/BE types.

## 6. Components & file map

**Backend**
- `GoalService` — derive + persist `rateTargetPctPerWeek` on upsert (drop the client value); add a profile-change recompute hook for the active goal.
- New `GoalFeasibilityService` (or extend `GoalEvaluationService`) — the stateless derive + verdict + suggested-date computation; reuses `GoalEngineProperties`.
- `GoalController` — implement `POST /feasibility-preview`.
- `BiometricProfileService`/mapper — compute the derived `tdeeBootstrap` on GET (via `TdeeBootstrapService`).
- `BiometricProfileService` save → trigger active-goal recompute (`GoalEngineService.evaluate`).

**Frontend**
- `GoalPlanner.tsx` — remove Step 2 + the rate input; Step 1 calls the preview + renders the feasibility panel + the suggested-date accept.
- `goalApi.ts` — add `feasibilityPreview(body)`.
- New `BiometricCard.tsx` (in `ProfileView`) + `BiometricSheet.tsx`; a `useBiometricProfile()` hook (or reuse `biometricProfileApi`) for the card + the gate check.
- `ProfileView.tsx` — mount the Biometria card.
- The "Új cél" entry (in `GoalsView`) — the hard-gate check → route to the sheet or the wizard.
- `goalHooks.ts` (`useGoalCreation`) — drop the profile PUT.

## 7. Testing approach

- **Backend ITs:** rate derivation (cut/bulk/maintain, incl. maintain→0) on upsert; feasibility-preview (within-band → no suggestion; aggressive → `suggestedTargetDate` at the cap, verified math); profile GET carries the derived `tdeeBootstrap` (null when no weigh-in); profile-save recomputes the active goal.
- **Frontend (both modes):** the wizard preview (feasible vs aggressive states + accept sets the date); the Biometria card + sheet (display + upsert); the hard gate (incomplete profile → gate → sheet → wizard; complete → straight to wizard); `useGoalCreation` no longer PUTs the profile; mock mode renders all (static preview + mock profile).
- House standards: integration-first backend ITs (`ApiIntegrationTest`/populators), contract-first, dual-mode FE.

## 8. Migration / rollout

- Additive contract change + behavior change; no DB migration.
- Existing goals keep their stored `rateTargetPctPerWeek` (now treated as derived); editing a goal re-derives it.
- The mock goal's `rateTarget` stays as a derived-looking value (mock-mode consistent).
- Ships as one G6 slice; gates = backend `clean test` + FE both modes + build + lint-docs PASS; merge `--no-ff` + auto-deploy (push-to-deploy + ArgoCD).
