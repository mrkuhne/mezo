# Mezo — Goal System (Cél-vezérelt idővonal + súly/TDEE motor + recept) — Design

> **Date:** 2026-06-18
> **Status:** Approved (brainstorming) → next: writing-plans for slice G1
> **Driving issue:** `mezo-2hp`
> **Scope:** The full *concept* for mezo's goal system across all three layers — daily weight
> logging IA, the Goal domain model, and the training-load→weight/energy engine. The concept is
> Phase-2-designable now; the **AI evaluation intelligence and adaptive-TDEE re-calibration are
> Phase 3** (Spring AI) — but their data shapes are laid down here so Phase 2 can ship the
> deterministic/heuristic version without a later schema break.

## Source of truth

- **Brainstorm decisions (locked, this session):** captured in the *Approved decisions* table below.
- **Grounded numbers (the §4/§5 engine constants):** the research workflow `wf_4ac5f005-710`
  (13 agents, web-sourced, adversarially verified) — full synthesis archived at
  `docs/research/queries/2026-06-18-goal-engine-numbers.md`. Every number in §6 ships a **default +
  range + confidence** and a real citation. **Do not invent engine constants — cite that doc.**
- **Backend house standards (mandatory):** `docs/references/` (see `CLAUDE.md` trigger index).
  This spec references them; it does not restate them. UUID PKs, `created_by`, soft-delete,
  Liquibase changeset naming `{ts}_{bd-id}_{desc}`, `@ConditionalOnProperty` toggles, contract-first.
- **Frontend contract:** `frontend/src/data/hooks.ts` — the single FE↔data boundary. `useGoals()`
  (hooks.ts:80) is the hook that gets restructured; `weightApi` is already real.
- **Existing seams verified in code (2026-06-18):**
  - Weight backend already live: `feature/biometrics/weight/` (`WeightLogEntity`, controller, `weightApi`). The
    daily-log write path persists today.
  - Strength-guard data source exists: `feature/train/entity/ExerciseSetEntity` (logged weight×reps → e1RM).
  - `MesocycleEntity`, `RunningBlockEntity`, `RunSessionLogEntity` exist; sport schedule via `useTrain().sport`.
  - `MeSubNav` tabs today: Profil / Cél / Alvás / Emberek / Tudás → **Súly** tab inserts here.
  - **Gap:** there is **no** body-composition profile (height/age/sex/body-fat). TDEE bootstrap needs
    a new `BiometricProfile` (see §3.4). Weight comes from the latest `weight_log`.

---

## Approved decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Goal axes | **Primary trajectory** (`cut`/`bulk`/`maintain`) **+ 0..N quality guards** (`strength`, `muscle`). Two orthogonal axes, not one flat list. |
| D2 | Multiplicity / lifecycle | **One active goal at a time**; lifecycle `planned`/`active`/`archived` (mirrors meso/running). |
| D3 | Core metaphor | The Cél is a **timeline (window)**, **not a box**. Plans are bars placed on it at known week-positions. |
| D4 | Coupling types | **Gym meso** = goal-owned, **tiles** the window (soft gap-flag + resolver). **Running block** = goal-owned, **episodic** (free position, may be shorter). **Volleyball** = **ambient**, constant band, goal-independent, only *sampled*. |
| D5 | Tiling enforcement | **Soft** — flag gym-lane gaps + offer fixes (extend / deload / mini-meso), but allow an uncovered tail (treated as untracked/maintenance weeks). Non-blocking. |
| D6 | Assembly UX | **Hub-and-spoke** — short goal-creation → **Cél command center** with plan *slots* that launch the **existing** planners (`MesocyclePlanner`, run builder) seeded with the goal window, or **attach an existing** plan. Volleyball auto-attaches as ambient. Eval enabled once ≥1 meso present. |
| D7 | Projection philosophy | **Hybrid** — the scale is ground truth (7-day EWMA trend = real rate = the *spine*). Block boundaries produce **deltas**; ambient cancels. |
| D8 | TDEE anchor | **Bootstrap formula → adaptive.** Day-1 formula TDEE from biometrics + asked inputs; **switch to adaptive (intake + weight trend)** once food logging exists. |
| D9 | Guards | **Measured** (strength = e1RM trend from workout sets; muscle = protein + maintenance-volume + rate composite). **Soft** enforcement — shape the recept + warn; never hard-block. |
| D10 | Evaluation | **Gate at birth** (feasibility + initial recept) **+ living after** (recompute from actuals). |
| D11 | Prescription | A **`GoalPrescription`** artifact (per-segment): daily kcal/protein → **Fuel**, sleep target → **Sleep**, deload/rest → **Train/Today**. Shifts at block boundaries. |
| D12 | IA (Me) | **Separate `Súly` tab** (daily log + trend; backend already live) **+ `Cél` tab** (timeline + plan slots + recept + guard status). |
| D13 | Phasing | **Phase 2:** funnel + data model + formula-TDEE + deterministic segmented projection + heuristic eval + guard monitoring + FE. **Phase 3:** adaptive TDEE (needs Fuel intake), AI evaluation (Spring AI), living re-calibration. Data shapes laid down now. |

---

## 1. Architecture overview — the three layers

```
            ┌──────────────────────────────────────────────────────────────┐
            │  ① CÉL (root)  trajectory + guards + window  ──────── timeline │
            │     ├─ ② owned: MESO (tiles)   ───────bar────────┐            │
            │     ├─ ② owned: RUN block (episodic) ──bar──┐     │            │
            │     └─ ② ambient: VOLLEYBALL (constant band) ┘     │           │
            │              ↓ sampled                              ↓          │
            │  ④ ENGINE  hybrid projection (scale=spine) + TDEE(bootstrap→adaptive)
            │              ↓                                                  │
            │  ⑤ EVAL (gate@birth + living) → ⑤ GoalPrescription (segmented) │
            │              ↓ bridges                                         │
            │     Fuel (kcal/protein) · Sleep (target) · Train/Today (rest)  │
            └──────────────────────────────────────────────────────────────┘
   ⑥ IA:  Me ▸ [Súly] daily log+trend (live)   ·   [Cél] timeline+slots+recept+guards
```

Three layers map to the rejected-vs-chosen IA debate: weight logging (Réteg 1) is already backed;
the Goal model (Réteg 2) and the load→energy engine (Réteg 3) are the new build.

---

## 2. The timeline coupling model (D3–D5) — the crux

The earlier failure mode ("define an 8-week goal, attach a 4-week run + 6-week meso → same misaligned
mess") is resolved by treating the goal as a **timeline**, not a container, and giving each system a
**different relationship to the window**:

| System | Relationship | Tiling? | Engine role |
|---|---|---|---|
| **Gym meso** | goal-owned (cascade) | **must tile** the window; gaps soft-flagged + resolver (`extend / +deload / +mini-meso`) | continuous baseline + phase deltas (MEV→MRV→deload) |
| **Running block** | goal-owned (cascade) | **episodic** — free position, may be shorter on purpose | a **delta** that turns on/off at its boundaries |
| **Volleyball** | **ambient**, goal-independent | n/a — **constant band** across the window | a **constant** → cancels out of the delta math |

**The misalignment is the signal, not a bug.** Different block lengths are exactly what produce the
TDEE deltas the engine projects from (running ends week 4 → expenditure step-down → recept eats less
to hold the rate). A box hides this; a timeline makes it visible and intentional. See the mockup
`.superpowers/brainstorm/8732-1781770664/content/goal-timeline.html`.

Gap policy (D5): the gym lane SHOULD cover the window; an uncovered tail is **allowed** and modelled
as "untracked/maintenance" weeks (projection runs there with no meso-delta), but the UI nudges a fix.

---

## 3. Data model (Réteg 2)

New backend feature package `feature/goal/` (controller/service/repository/entity/dto/mapper per
`java_package_structure.md`). UUID PKs, `OwnedEntity` base, soft-delete, contract-first.

### 3.1 `GoalEntity` (table `goal`)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | e.g. "Nyári cut" |
| `trajectory` | text | CHECK `cut`/`bulk`/`maintain` |
| `guards` | text[] | typed array (like `mesocycle.phase_curve`), subset of `strength`,`muscle` |
| `status` | text | CHECK `planned`/`active`/`archived`; **partial unique index: one `active` per `created_by`** |
| `start_date` | date | window start |
| `target_date` | date | window end (the timeline length) |
| `start_weight_kg` | numeric | snapshot at activation |
| `target_weight_kg` | numeric | goal weight (null for pure `maintain`) |
| `rate_target_pct_per_week` | numeric | e.g. 0.7 (%BW/wk); sign from trajectory |
| `identity_frame` | text | the motivational line (kept from current `Goal`) |
| `tdee_bootstrap` | jsonb | `TdeeBootstrapJson` — inputs snapshot + computed formula TDEE (§6.1) |
| `ambient_baseline` | jsonb | `AmbientBaselineJson` — sampled volleyball load assumed constant (sessions/wk, est kcal/wk) at creation |
| `prescription` | jsonb | `GoalPrescriptionJson` — segmented recept (§5), recomputed by the engine |

`current_weight` is **derived** from the latest `weight_log`, not stored (single source of truth).

### 3.2 `GoalPlanLinkEntity` (table `goal_plan_link`) — owned-plan coupling with position
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `goal_id` | uuid | FK → goal (cascade soft-delete) |
| `plan_type` | text | CHECK `mesocycle`/`running_block` |
| `plan_id` | uuid | FK → mesocycle / running_block |
| `start_week` | int | 1-based position on the goal timeline |
| `end_week` | int | derived from plan length (stored for query convenience) |

Volleyball is **not** a link row — it is ambient and goal-independent; the engine samples the live
sport schedule and the `goal.ambient_baseline` snapshot records the assumption. (Rationale: volleyball
outlives any goal; a per-goal hard link would fight that.)

### 3.3 `GoalPrescriptionJson` (embedded in `goal.prescription`)
```
{ generatedAt, basis: "formula"|"adaptive",
  segments: [ { fromWeek, toWeek, label,           // e.g. "W1–4 · futás aktív"
                kcal, proteinG, sleepTargetH, restDays:[...],
                projectedRateKgPerWk, rationale } ],
  guardStatus: { strength: {...}, muscle: {...} },  // see §5.3
  feasibility: { verdict, notes[] } }               // gate result (§5.1)
```

### 3.4 `BiometricProfileEntity` (NEW — `feature/biometrics/profile/`, table `biometric_profile`)
TDEE bootstrap needs body composition, which the app does not store yet. Minimal new entity:
`sex` (M/F), `height_cm`, `birth_date` (→ age) **or** `age`, optional `body_fat_pct`. One row per owner.
Current weight is read from `weight_log`. This is the one genuinely new dependency Réteg 3 introduces.

> **Naming caution:** the meso planner's `GOAL_PRESETS` (`frontend/src/data/train.ts`) are
> *training* goals (hypertrophy/strength/…). They are **not** the Cél trajectory. Keep the vocab
> separate (`trajectory` vs meso `goal preset`) to avoid confusion in code.

---

## 4. The engine (Réteg 3) — hybrid projection (D7)

`GoalEngineService` (stateless service; no entity). Inputs: the goal + its plan-links + the live
weight trend + (later) intake logs. Outputs: the segmented projection + recept + guard status.

**Spine = the scale.** The real rate is the slope of the **EWMA weight trend** (not raw weigh-ins).
The engine never projects a fixed deficit forward as truth — it re-fits against the trend each week.

**Deltas = block boundaries.** Walk the timeline week-by-week; at each owned-block boundary the
expenditure steps (running on/off, meso phase MEV→MRV→deload). Ambient volleyball is constant →
drops out. Each contiguous run of identical load = one **segment** → one recept block (§5).

**TDEE: bootstrap → adaptive (D8).**
- **Bootstrap (day 1, Phase 2):** formula TDEE (§6.1). Used until adaptive has data.
- **Adaptive (Phase 3, needs Fuel intake):** back-calculate maintenance from intake + EWMA trend
  (§6.2), blend formula→adaptive over ~4 weeks. **Blocked on Fuel Slice C** (calorie logging). The
  data shapes (`prescription.basis`, intake hooks) are reserved now; the algorithm lands in Phase 3.

> **Anti-double-count rule (§6.3):** the PAL multiplier already bakes in average training energy.
> Do **not** also add per-session activity kcal to a PAL-derived TDEE. Per-system kcal are **deltas**
> for block transitions and the "why did my target move" explanation only.

---

## 5. Evaluation + prescription (Réteg 3, D10–D11)

### 5.1 Gate at birth (Phase 2 = heuristic; Phase 3 = AI)
When the user requests evaluation (≥1 meso present), run feasibility checks and produce the initial
recept. Heuristic checks (deterministic, ship in Phase 2):
1. **Rate realism** — is `rate_target_pct_per_week` within the safe band for the window? (§6.5)
2. **Guard satisfiability** — with `muscle` guard on, is protein target reachable and is gym volume
   ≥ maintenance volume per muscle across the timeline? (§6.5)
3. **Conflict detection** — e.g. aggressive rate + heavy running block + `strength` guard → flag
   likely strength breach; suggest easing the deficit or shifting the run block.

Verdict ∈ `feasible` / `feasible-with-warnings` / `aggressive`. Never blocks (guards are soft, D9).
Phase 3 swaps the heuristic for a Spring-AI evaluator that reads the same inputs.

### 5.2 Living recompute
The scale is ground truth: each week the trend re-fits the effective rate; if it drifts from plan,
the recept and projected `target_date` update (step-capped, §6.2). Phase 2 does the deterministic
recompute; Phase 3 adds the adaptive-TDEE refit + narrative.

### 5.3 Guard monitoring (soft, D9)
- **Strength guard:** track main-lift **e1RM** from `ExerciseSetEntity` top sets (Epley, §6.6); warn
  on a sustained **−5%** trend. Data source already exists.
- **Muscle guard:** composite — protein on target (needs Fuel intake), weekly hard sets ≥ maintenance
  volume per muscle (from the meso, available now), rate ≤ cap. Warn on any leg breaching. Protein leg
  is partial until Fuel ships.

### 5.4 Prescription bridges
`GoalPrescription` is the artifact that crosses domains: daily kcal/protein → **Fuel** targets,
sleep target → **Sleep**, deload/rest-day placement → **Train/Today**. Phase 2 surfaces the recept in
the Cél tab; the cross-domain wiring lights up as each target domain's backend lands.

---

## 6. Grounded engine constants

> Distilled from `wf_4ac5f005-710` (verified, cited). Full doc + sources:
> `docs/research/queries/2026-06-18-goal-engine-numbers.md`. Each value ships a **default**; the range is
> the tuning band. Subject basis: recreationally trained ~84 kg male.

### 6.1 TDEE bootstrap (day 1)
- **BMR — default (Mifflin-St Jeor):** `men: 10·kg + 6.25·cm − 5·yr + 5` · `women: … − 161`.
- **BMR — preferred when body-fat known (Katch-McArdle):** `370 + 21.6·LBM`, `LBM = kg·(1−bf%)`.
  MSJ underestimates trained males (~52% within ±10% vs 71–82% general) → prefer the LBM path when bf% exists.
- **TDEE = BMR × PAL.** Default PAL **1.55** (3–5 d/wk); 1.725 if ≥6 training touches/wk across systems.
- Treat output as **±300 kcal** — a seed, never truth.

### 6.2 Adaptive TDEE (Phase 3, when intake logs exist)
- `adaptive_TDEE = mean_daily_intake − (Δtrend_kg · 7700) / window_days`, on the **EWMA** weight series.
- **EWMA half-life default 10 d** (10–14). Min data: 14 d & ≥4 weigh-ins/wk → provisional; 21–28 d → full.
- Blend `w = clamp((window_days−7)/(28−7),0,1)`; **step cap ±100–150 kcal/week**. Converged error ~±200 kcal/d.

### 6.3 Activity energy per system (deltas; `kcal = MET·kg·h`)
| System | Eff. MET | Per-session kcal (84 kg, **default**) | Type |
|---|---|---|---|
| Hypertrophy lift (45–75 min) | 3.5–5.0 | **325** | delta |
| Interval/sprint run (30–40 min) | 10–13 | **500** | delta |
| Volleyball — recreational (90–120 min) | ~3.5 | **500** | ambient/delta |
| Volleyball — competitive | ~8.0 | **1150** | ambient/delta |

EPOC ignored (small, within MET noise). Individual MET variance ±20–30% → adaptive TDEE corrects.

### 6.4 Weight-change constant
- **7700 kcal/kg** default (range surfaced 6000–7700). It's the **fat-loss / long-run asymptote**:
  under-predicts the first 2–4 weeks (water/glycogen ~4800–6000 early), over-predicts steady-state.
- **Don't hold the deficit static** (TDEE falls as weight falls — the dominant error, > adaptive
  thermogenesis). Optional conservative **100–200 kcal/d** thermogenesis haircut during active diet.
  The empirical spine (§4) silently re-fits the effective kcal/kg; the constant only seeds week 1.

### 6.5 Muscle guard thresholds (warn, don't block)
- **Protein:** default **2.0 g/kg BW/d** (floor 1.6, ceil 2.2; if bf% known also 2.3–3.1 g/kg LBM, take
  higher, cap 2.6 g/kg BW). Warn below 1.6 g/kg on trend.
- **Rate cap:** default **0.7 %BW/wk** (band 0.5–1.0; bias lower as leaner). Warn above **1.0 %BW/wk**.
  Lean-mass-sparing is **gated** on protein ≥1.6 g/kg AND ongoing resistance training.
- **Maintenance volume:** default **8 hard sets/muscle/wk** in a cut (band 6–10). Warn below 6.

### 6.6 Strength guard
- **e1RM (Epley, default):** `weight·(1 + reps/30)`; log a rested top set of 3–6 reps; discard sets >10 reps.
- **Breach:** sustained **−5%** e1RM trend over 1–2+ wk on a main lift (−2..−4% is noise). The single
  most important number to tune from the user's own per-lift noise band.

**Lowest-confidence items to tune empirically:** PAL multiplier (pure seed), the EWMA span + blend
ramp, effective kcal/kg (re-fit by trend), the −5% e1RM breach, RP volume absolutes.

---

## 7. Information architecture (Réteg 1, D12)

`MeSubNav` (`frontend/src/features/me/MeSubNav.tsx`) gains a **Súly** tab between Profil and Cél.

- **`/me/weight` — Súly (new):** daily-log hero (number + ± steppers + Mentés, reusing `WeightLogSheet`
  internals or inlined) + trend chart (`WeightChart`, 7d/30d/all) + 7-nap/4-hét trend cells. Backend
  already live (`weightApi`). This is the user's "start logging daily" home. Mockup: `me-ia-layout.html` (option B).
- **`/me/goals` — Cél (restructured):** the **command center / timeline** — goal hero, the timeline lane
  view (gym/run/volleyball bars + gap resolver), plan slots (launch existing planners or attach), the
  segmented recept, and guard status. Mockups: `goal-funnel.html` (hub), `goal-timeline.html` (timeline).

The current `GoalsView` weight chart/log moves to the Súly tab; `GoalsView` becomes the Cél command center.

### Frontend data layer
`useGoals()` (hooks.ts:80) splits/grows into real hooks behind unchanged-shape signatures where possible:
`useGoal()` (active goal + timeline + prescription + guards), `useGoalPlanLinks()`, goal/link mutations,
goal-creation. `weightLog`/`logWeight` move under a `useWeight()` hook for the Súly tab (already real).

### API contract
New `api/feature/goal/goal.yml` fragment (goals CRUD + lifecycle, plan-link attach/detach, request-eval,
prescription read). Merge → `api/openapi.yml` → FE `api.gen.ts` + backend `<Tag>Api`. Contract-first.

---

## 8. Phasing & slice decomposition (D13)

**Phase 2 (now) — deterministic/heuristic, no AI, no intake dependency where avoidable:**

| Slice | Content | Notes / deps |
|---|---|---|
| **G1** | `GoalEntity` + CRUD + lifecycle (one active) + `BiometricProfile` + contract + mock→real `useGoal`/`useWeight` swap | foundation; unblocks the Súly tab + Cél hero |
| **G2** | **Súly tab** (IA split, D12) — move log/trend out of GoalsView into `/me/weight` | FE-only; backend already live |
| **G3** | `GoalPlanLink` + timeline coupling (attach/detach meso & running, week-positions, cascade) + soft gap-flag + resolver | depends G1; reuses existing planners (D6) |
| **G4** | Goal-creation hub + Cél command-center timeline view (mockups → real) | depends G1–G3 |
| **G5** | Engine: formula TDEE + deterministic segmented projection + heuristic eval gate + `GoalPrescription` (kcal/protein/sleep/rest) + guard monitoring (e1RM now, volume now, protein when Fuel lands) | depends G1–G3; §6 constants |

**Phase 3 (later) — AI brain:**
- Adaptive TDEE (back-calc) — **blocked on Fuel Slice C** (calorie intake logging).
- AI evaluation (Spring AI) replacing the heuristic gate; living narrative re-calibration.
- Pattern engine integration. Data shapes (`prescription`, `ambient_baseline`, `basis`) already reserved.

---

## 9. Open questions / known gaps

1. **Fuel intake logging (Slice C) is the hard dependency** for adaptive TDEE + the protein leg of the
   muscle guard. Phase 2 ships formula TDEE + partial muscle guard; this is acceptable and explicit.
2. **`BiometricProfile` is new** — decide whether to ask its inputs inside goal-creation (just-in-time)
   or as a one-time profile step. Recommendation: ask in goal-creation, persist to the profile.
3. **Volleyball as ambient snapshot vs live sample** — the engine samples live; `ambient_baseline`
   records the creation-time assumption. Confirm we never *cascade* volleyball with a goal.
4. **Maintenance / bulk trajectories** reuse the same machinery (rate sign flips, guards differ); the
   spec is written cut-first but the model is symmetric. Validate bulk recept numbers before shipping bulk.
5. **e1RM breach threshold (−5%)** and the **EWMA span** are the top empirical-tuning targets — ship as
   configurable (`mezo.goal.*` properties per `configuration_conventions.md`), not hardcoded.

---

## 10. References

- Brainstorm mockups: `.superpowers/brainstorm/8732-1781770664/content/` (`me-ia-layout`, `goal-funnel`, `goal-timeline`).
- Grounded numbers + sources: `docs/research/queries/2026-06-18-goal-engine-numbers.md` (workflow `wf_4ac5f005-710`).
- Backend house standards: `docs/references/*` (package, spring, error, liquibase, testing, config, api-contract).
- Existing feature docs to update on implementation: `docs/features/` (a new `goal.md` living doc; touch `_platform-*` for the data-layer hook split).
