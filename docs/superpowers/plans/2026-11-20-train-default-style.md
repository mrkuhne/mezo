# Train — generated blocks default to the balanced style + per-class reserve + reachable grind

**Issue:** `mezo-r36n9.115` (closes `mezo-s5sd4`). **Owner choice 2026-11-20:** „Alapstílus + tartalék”
(after the Muscle Ladder re-check, `docs/research/queries/muscle-ladder-train-fact-check-audit.md`).
Small server change, no new screen: spec and plan folded into this one doc (CLAUDE.md §Owner gates).

## Why

- A generated block is **unstyled**: `MesoPlanGeneratorService` writes `target-rir: 1` on every exercise, so the
  style system's effort ramp (base → base−1 → base−2 in the last loading week → base+2 in a deload week), its
  prescribed rest and its per-style rep overshoot never apply unless the owner picks a style by hand.
- The style table gives one reserve per style (except legs). The book (Nippard, *The Muscle Ladder*, PDF 322–324)
  separates **heavy compounds** (RPE 6–8 ≈ 2–4 RIR), **secondary/machine compounds** (RPE 8–10 ≈ 0–2) and
  **isolation** (RPE 9–10 ≈ 0–1). Primary research: failure is not required (Refalo 2023/2024); the heavy-compound
  exception is fatigue management, not a tested hypertrophy effect — hence a product default, config-only.
- The weekly grind signal (`WeeklySignalReader`) is `loggedRir ≤ storedTargetRir − grind-rir-gap(2)`: unreachable at
  a target of 0–1 (`mezo-s5sd4`), so "hold on a grind" and the early step-down never fire there.

## Design

1. **Default style for generated blocks.** The generated template carries `trainingStyle = balanced` (techniques stay
   **off**). Stamping follows the existing style path (rep range, reserve, rest), so the generator's own
   `compound-rep-*`/`isolation-rep-*`/`target-rir` values no longer decide a generated exercise. Configurable:
   `mezo.meso-plan.default-training-style: balanced` (blank/null = old unstyled behaviour).
   The phone's builder starts from the generated template, so it shows *Kiegyensúlyozott* without an app change
   (verify; if the builder starts a blank draft elsewhere, leave it — out of scope).
2. **Per-class reserve.** `TrainStyleProperties.Style` gains two optional fields, `stable-compound-reserve` and
   `isolation-reserve` (null = `reserve`). `StyleTable.stamp`: free compound → `leg-reserve`/`reserve` (unchanged);
   stable compound → `stable-compound-reserve ?? reserve`; isolation → `isolation-reserve ?? reserve`.
   Config: `balanced` stable-compound 1, isolation 1; `heavy` isolation 1; `volume` and `allout` unchanged
   (high-rep RIR self-report is noisy — Zourdos 2021, Halperin 2022). The free-floor of the ramp (1) still holds.
3. **Reachable grind.** In `WeeklySignalReader`, for an exercise in a **styled** run compute the effective (ramped)
   reserve for that week (`EffortRamp.effectiveReserve`, the same inputs `ExerciseStyler` uses). Grind when
   `loggedRir ≤ effective − gap`, **or**, when `effective ≤ 1`, the set's `reps ≤ targetReps − 2` (the rule
   `ProgressionDecider`'s ramped grind already uses). An unstyled run keeps today's rule byte-identically.
   Technique sets stay excluded.

**Not touched:** existing templates and running blocks (style is stamped only on save/start), the web frontend,
the phone app, the volume bands.

## Kész, ha…

- [ ] A freshly generated plan (`POST /api/train/meso-plans/generate`) returns `trainingStyle: balanced`, and a block
      started from it prescribes: free compound reserve 2 (legs 3), stable compound 1, isolation 1 in week 1; the
      ramp lowers them later; the deload week raises them by 2; rest per the balanced row (150 / 90 s).
- [ ] `default-training-style` blank → generation byte-identical to before (golden/contract test).
- [ ] `StyleTable` unit tests: each class × style, null per-class field falls back to `reserve`, allout fallback
      unchanged.
- [ ] `WeeklySignalReader`: grind fires at effective reserve ≤ 1 when reps fell ≥ 2 short; fires at higher reserves
      by the gap rule on the effective value; never on a technique set; unstyled run unchanged (tests for each).
- [ ] An unstyled block prescribes byte-identically (the existing T1 golden test stays green).
- [ ] Gates: focused ITs + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true`; `gen-codemap`;
      `lint-docs` 0/0.
- [ ] Docs: `docs/features/train.md` §4 (Training style, Plan generator, Volume v2 signals) + §9; roadmap milestone;
      Boop handbook Edzés page if it describes the style; Notion synced.
- [ ] Shipped: merged, `deploy` green, version live; production read shows the config active (no data migration).
