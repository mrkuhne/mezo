---
title: Volume engine — weekly set distribution + volume exemption
type: spec
status: approved
created: 2026-08-24
driver: mezo-gbo7
follow_up: mezo-dq60
related: [2026-07-25-progressive-overload-design.md]
---

# Volume engine — weekly set distribution + volume exemption

Fixes two coupled defects in the volume-progression engine shipped by
[`2026-07-25-progressive-overload-design.md`](2026-07-25-progressive-overload-design.md)
(Plan 2 Phase A, `mezo-hi9m`).

## 1. Problem

### 1.1 The weekly target fires once per training day

`WorkoutService.effectiveWorkingSets` distributes a muscle group's **weekly**
`MuscleGroupVolumeLog.currentSets` across **today's** exercises of that group. A group
trained on N days therefore receives roughly `N × currentSets` across the week, which
directly violates the origin spec's **D4** — *"the weekly working-set count actually ramps
toward MRV per muscle … bounded by [MEV, MRV]"*.

The origin spec's §5.2 wording — *"the week's per-muscle `currentSets` target is distributed
across that muscle's working exercises in the day template"* — is the ambiguity that produced
this: "the day template" was read as *today's* day template rather than *the week's* template
days. The invariant in the same sentence ("the week's target", "bounded by MRV") settles the
intent: the target is weekly, so its distribution must be weekly.

### 1.2 There is no notion of non-hypertrophy work

Every exercise counts toward volume accounting. Two categories should not:

- **The closing block** (`mezo.closing-block`: Dead Hang, 45° Back Extension) is posture /
  accessory work appended by `ClosingBlockService` to **every** non-empty template day.
- **Plyometrics**, which the frontend's `setBudget.ts` already excludes (`if (ex.type ===
  'plyo') { row.plyoSets += …; continue }`) while the backend distributor does not — the two
  models disagree today.

### 1.3 Observed on live data

Mesocycle `d1a5c622-21c5-4885-9105-b107d1dbc2ce` ("Shoulder & Back Mezo #1", 5 training days,
back landmarks 10/16/22):

| Group | Week 1 | Week 3 | Week 5 | MRV |
|---|---|---|---|---|
| back | **50** | **70** | **90** | 22 |
| shoulder / quad / glute / chest | 16 | 24 | 32 | 18–20 |
| biceps / triceps / ham | 12 | 20 | 28 | 14 |

Back is worst because Dead Hang (`back-wide`) and 45° Back Extension (`back-lower`) put a
"back" exercise on all five days, so the back target fires five times. Concretely, week 1
Tuesday prescribes **5 sets of Dead Hang and 5 sets of 45° Back Extension** on a leg day.

Plyo cannibalisation, same meso: Depth Jump and DB Jump Squat map to `quad`, so Thursday's
quad target is split four ways and **Front Squat and Bulgarian Split Squat drop from 4 sets to
2** — the opposite of the block's stated vertical-jump priority.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| **VD1** | The engine owns the weekly set count; the template's `workingSets` is a **weighting**, not a prescription | This is what the origin spec's D4/D6 already promised. Smallest conceptual change. |
| **VD2** | Volume exemption is a **per-exercise, user-editable flag** (`countsTowardVolume`, default `true`) | A category rule (plyo + closing-block slugs) would misfire whenever a user deliberately programs one of those as real work. |
| **VD3** | The weekly distribution is **derived at `getToday`** over the meso's template week — no new storage | Honours the origin spec's D6 ("compute, don't store"); plan edits take effect immediately; nothing to invalidate. |
| **VD4** | The distribution **algorithm is unchanged** (base-1 floor + largest-remainder, proportional to template `workingSets`); only its input set changes | Keeps `VolumeEffectiveSetsIT`'s arithmetic expectations valid. |
| **VD5** | Builder simplification is a **separate slice** (`mezo-dq60`) | Backend-shaped vs. FE+contract-shaped, and it depends on this one landing. |

### Rejected alternatives

- **Precompute + persist effective sets at week rollover.** Cheaper reads and auditable, but
  needs new storage, must be invalidated on mid-week plan edits, and contradicts the origin spec's D6. More
  moving parts for the same output.
- **Divide the weekly target by the group's training-day count, keep per-day distribution.**
  Smallest diff, but rounding drift means the weekly sum no longer equals the target, and the
  template's weighting is lost across days — 6 sets on Monday and 3 on Wednesday would both
  become 5.
- **Category-based exemption (no flag).** No schema change, but not overridable; rejected per VD2.

## 3. Design

### 3.1 Data model + contract

| Layer | Change |
|---|---|
| `exercise` table | `counts_toward_volume boolean not null default true` (Liquibase changeset, `liquibase_conventions.md` naming) |
| `ExerciseEntity` | new field, defaults `true` |
| `GymExerciseJson` | new record component, **defaulted to `true` in the compact constructor** so pre-migration `meso_template.days` documents deserialize — the same coercion `MesoDayJson` applies to `muscle`/`exercises` |
| `GymExercise`, `GymExerciseInput` (`api/feature/train/train.yml`) | new optional boolean, so the FE reads it directly and the wizard can send it |

**Creation defaults.** `ClosingBlockService.closingExercise()` inserts with `false`. A new
exercise defaults to `true`, except `type = 'plyo'` which defaults to `false`.

### 3.2 Backend behaviour

**`WorkoutService.effectiveWorkingSets`.** `getToday` loads every template day of the active
meso and their exercises (the repository pair `MesoTemplateService.daysOf` already uses),
drops rows with `countsTowardVolume = false`, groups the remainder by `MuscleGroup.of(muscle)`
across the whole week, distributes each group's `currentSets` over that weekly set, and looks
up today's exercises in the resulting `Map<exerciseId, sets>`. Anything absent — an exempt
exercise, or a group with no volume-log row such as `core` — keeps its template `workingSets`.

*Invariant:* the weekly sum equals `currentSets` exactly whenever `currentSets ≥ the week's
counting-exercise count`. Below that, the base-1 floor still applies per exercise, so the sum
can only exceed the target, never fall short — the existing documented behaviour, now at week
scale. Document this on the method.

**`VolumeProgressionService`.** `loggedLastWeek` and the `grind` signal must count only logged
sets of counting exercises. Otherwise the ramp reads inflated volume, and a hard-ground closing
exercise could hold back real work's progression.

**`VolumeArcService`.** The actual (past/current) bars aggregate logged working sets per muscle
per meso-week; apply the same exclusion so the arc matches what the engine decided.

**Baseline seeding** (`mezo-xlmp`, meso create-as-active / activate). Seed a volume-log row only
for groups the template trains with at least one **counting** exercise, so no target is created
that has nothing to distribute over.

`ClosingBlockService` itself is unchanged. Because its rows carry `countsTowardVolume = false`,
its self-healing re-insertion can no longer perturb the volume model.

### 3.3 Frontend

- **`setBudget.ts`** — the `ex.type === 'plyo'` gate becomes `countsTowardVolume === false`.
  `MuscleBudgetRow.plyoSets` → `exemptSets`; the card's `+N plyo` label → `+N kiegészítő`.
- **`structureLint.ts`** — same substitution at the plyo gates, with two deliberate exceptions:
  **session size** (5–9) keeps counting every exercise, because a closing exercise is still a
  real session slot; the **sets-per-exercise** band applies only to counting exercises, so a
  2-set closing exercise never fires it.
- **Editor** — a per-exercise toggle ("Számít a volumenbe") in `ExerciseAccordionRow` and
  `ExerciseRecipeRow`.
- **Field-enumeration trap.** `logic/mesoDays.ts:33-35` and `components/MesoExercises.tsx:34` build
  day inputs by listing fields explicitly. The new field must be added in **both**, or it is
  silently dropped on save and the toggle appears to reset.

### 3.4 Migration

The backfill runs in **two** places:

1. `exercise` rows — `counts_toward_volume = false` where `type = 'plyo'` or `catalog_id`
   resolves to a `mezo.closing-block` slug.
2. `meso_template.days` jsonb — the same rule inside the stored plan documents. Without this, a
   new run stamped from an existing template would recreate counting closing/plyo exercises and
   the defect would return later, when it is harder to connect to this change.

No new feature switch: the behaviour changes under the existing
`mezo.feature.volume-progression.enabled`.

## 4. Expected outcome

Same meso, after the fix:

| Group | Week 1 | Week 3 | Week 5 | Week 6 (deload) | MRV |
|---|---|---|---|---|---|
| back | 10 | 14 | 18 | 9 | 22 |
| shoulder / quad / glute / chest | 8 | 12 | 16 | 8 | 18–20 |
| biceps / triceps / ham / calf | 6 | 10 | 14 | 7 | 14–16 |

Nothing exceeds MRV; the ramp starts at MEV and the deload regresses. Dead Hang and 45° Back
Extension hold 2 sets everywhere. The plyo block holds its template counts and leaves the quad
budget alone, so Front Squat and Bulgarian Split Squat keep 4 sets from week 3.

Side effect worth stating: with `setBudget.ts` reading the same flag, the meso's back budget
drops from **150% to 100%**, because the closing block's 10 back-extension sets leave the back
bucket.

## 5. Testing

Integration-first per `testing_standards.md`. The load-bearing test is the invariant: **a muscle
group trained on two days sums to exactly `currentSets` across the week** — today that is
`2 × currentSets`, so this test starts red and ends green.

- `VolumeEffectiveSetsIT` — weekly semantics; an exempt exercise keeps its template count and is
  absent from the distribution.
- `VolumeProgressionServiceIT` — `loggedLastWeek` and `grind` skip exempt exercises.
- `VolumeBaselineSeedIT` — no volume-log row for a group whose only exercises are exempt.
- FE vitest — `setBudget`, `structureLint`, plus a round-trip test proving the field survives a
  save through `mesoDays`/`MesoExercises`.
- House rules — regenerate the contract artifacts (`api.gen.ts`, contract-drift job), ArchUnit,
  and `docs/CODEMAP.md` in the same change.

## 6. Out of scope

- Disabling `mezo.closing-block` — unnecessary once the flag exists.
- The meso builder's set-entry simplification — `mezo-dq60`, blocked by this issue.
- Anything outside the volume engine.
