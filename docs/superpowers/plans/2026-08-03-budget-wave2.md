# Budget wave 2 — Implementation Plan (plyo exclusion · daily breakdown · warm-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude plyo work from the hypertrophy set-budget, add the approved daily per-muscle session-breakdown card (variant A) to MesoEditor, and ship the research-backed adaptive warm-up prescription (count-keyed backend ladders + FE warmup-count suggestions).

**Architecture:** Extends the wave-1 layers: pure logic in `frontend/src/features/train/logic/setBudget.ts` (+ new `warmupSuggest.ts`), presentational `DayBreakdownCard`, wiring in `MesoEditor`. One backend change: `HypertrophyProperties` + `SetRecommendationService` warm-up ladder becomes count-keyed with absolute reps (config-only data shape, no contract/DB change).

**Spec:** `docs/superpowers/specs/2026-08-03-budget-wave2-design.md` (+ sibling `2026-08-03-daily-session-breakdown-design.md` binding for F2 visuals; mockup asset `assets/2026-08-03-daily-breakdown-mockup.html`).

**Tech Stack:** React 19 + Vitest (FE); Spring Boot 4 / Java 21 + `@SpringBootTest` ITs (BE).

## Global Constraints

- **Read `docs/references/frontend_conventions.md` before any FE code; `docs/references/configuration_conventions.md`, `spring_patterns.md`, `testing_standards.md`, `integration_test_framework.md` before the BE task.**
- Caps stay: FAILURE 12 / VOLUME 20 / SESSION 11 / NEAR 0.85. Style: `targetRIR ≤ 1` failure.
- Plyo rule: `type === 'plyo'` excluded from budget + session-cap math; surfaced as `plyoSets` (`+n plyo` suffix). Exact warm-up ladders: `1 → [70%×4]`, `2 → [50%×8, 75%×3]`, `3 → [50%×8, 70%×4, 90%×2]`; counts >3 repeat the 3-ladder's FIRST entry before it (ascending stays). Reps are ABSOLUTE (no repMax factor). Rounding via existing `roundClamp` (2.5 kg).
- `suggestedWarmupSets` rules exactly per spec F3 (plyo/bodyweight-ish→0; first compound of group→3, or 2 if anchor < 60 kg known; later compound→1; isolation opening a group→1, else 0).
- UI copy Hungarian; tokens only (no raw hex; `var(--text-inverse)` over fills); `@/*` imports; tests colocated.
- Tests FOREGROUND, Bash `timeout: 600000` (BE task: 900000); never run_in_background/Monitor. FE both modes (`pnpm test <pattern>` + `VITE_USE_MOCK=true …`) with PLAIN SUBSTRING vitest filters (no `\.` regex escapes — vitest filters are substrings; verify the run's Test-Files count matches your pattern count). No full FE suite except Task 5; no `pnpm test:visual`; BE runs ONLY `cd backend && ./mvnw clean test -Dtest='SetRecommendationServiceIT,ArchitectureTest'` — NEVER the full backend suite (16 GB machine OOMs; CI is the gate).
- Commits: explicit `git add <paths>` + `git commit --no-verify` (beads hook force-stages a stray root `issues.jsonl`; verify `git show --stat HEAD` after each commit), conventional subject with the driving bd id, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Backend gotchas for Task 4: if unrelated compile errors / ArchUnit failures appear (train/progression/pantry classes, or `archunit-store` file truncated to 0 bytes), it is the IDE's jdtls poisoning `backend/target` — re-run once, check `git status` on `backend/src/test/resources/archunit-store/`, never "fix" unrelated files, never commit an archunit-store deletion.

---

### Task 1: Plyo exclusion in setBudget (F1 logic)

**Files:**
- Modify: `frontend/src/features/train/logic/setBudget.ts`
- Test: `frontend/src/features/train/logic/setBudget.test.ts` (extend)

**Interfaces:**
- Consumes: existing `MuscleBudgetRow`, `muscleBudgets`, `sessionCapWarnings`, `budgetGroup`, `BUDGET_GROUP_LABELS`.
- Produces: `MuscleBudgetRow` gains `plyoSets: number`; `SessionCapWarning` unchanged; NEW `interface DayGroupRow { group: string; label: string; colorMuscle: string; sets: number; plyoSets: number; over: boolean }` and `daySessionBreakdown(day: MesoDay): DayGroupRow[]` (sorted sets desc; `over = sets > SESSION_MUSCLE_CAP`; groups with only plyo sets still emit a row with `sets: 0` so the day view shows the plyo work); NEW `leastLoadedDayFor(days: MesoDay[], group: string, excludeDay: string): string | null` (non-off training day with the fewest non-plyo working sets for that group — ties broken by fewest total sets, then day order; null when no other training day exists).

- [ ] **Step 1: Write failing tests** — extend `setBudget.test.ts`:

```ts
const plyoEx = (muscle: string, workingSets: number) => ({ ...ex(muscle, workingSets, 0), type: 'plyo' as const })

describe('plyo exclusion (mezo-0znc)', () => {
  it('plyo sets leave budget math but are reported as plyoSets', () => {
    const days = [day('H', 'quad', [ex('quad', 9, 0), plyoEx('quad', 10)])]
    const rows = muscleBudgets(days)
    expect(rows[0]).toMatchObject({ group: 'quad', workingSets: 9, plyoSets: 10 })
    expect(rows[0].budget).toBeCloseTo(9 / 12)
    expect(rows[0].level).toBe('ok')
  })
  it('session cap ignores plyo sets', () => {
    const days = [day('H', 'quad', [ex('quad', 9, 0), plyoEx('quad', 10)])]
    expect(sessionCapWarnings(days)).toHaveLength(0)
  })
  it('plyo-only group emits no budget row', () => {
    const days = [day('H', 'quad', [plyoEx('quad', 6)])]
    expect(muscleBudgets(days)).toHaveLength(0)
  })
})

describe('daySessionBreakdown', () => {
  it('aggregates the day per group with over flag and plyo split', () => {
    const d = day('H', 'shoulder', [ex('shoulder-side', 6, 0), ex('shoulder-front', 6, 0), plyoEx('quad', 4)])
    const rows = daySessionBreakdown(d)
    expect(rows[0]).toMatchObject({ group: 'shoulder', sets: 12, over: true })
    expect(rows[1]).toMatchObject({ group: 'quad', sets: 0, plyoSets: 4, over: false })
  })
})

describe('leastLoadedDayFor', () => {
  it('names the other training day with the fewest sets for the group', () => {
    const days = [
      day('H', 'shoulder', [ex('shoulder-side', 12, 0)]),
      day('Sze', 'shoulder', [ex('shoulder-front', 4, 0)]),
      day('K', '', []),
    ]
    expect(leastLoadedDayFor(days, 'shoulder', 'H')).toBe('Sze')
    expect(leastLoadedDayFor([days[0], days[2]], 'shoulder', 'H')).toBeNull()
  })
})
```

(`ex`/`day` fixtures already exist in the file; `ex` must gain an optional type override or add the `plyoEx` helper as shown.)

- [ ] **Step 2:** `cd frontend && pnpm test setBudget` → FAIL.
- [ ] **Step 3: Implement.** In `muscleBudgets` and `sessionCapWarnings`: skip `ex.type === 'plyo'` from set accumulation; accumulate `plyoSets` per group in `muscleBudgets` (a group with `workingSets === 0` after the pass is dropped from the budget list). Add `daySessionBreakdown` + `leastLoadedDayFor` per the Interfaces block (reuse `budgetGroup`/labels; `colorMuscle` = first seen muscle key of the group that day).
- [ ] **Step 4:** `pnpm test setBudget` + `VITE_USE_MOCK=true pnpm test setBudget` → PASS.
- [ ] **Step 5: Commit** — `feat(train): exclude plyo from set budget + day breakdown helpers (mezo-0znc)`.

---

### Task 2: SetBudgetCard plyo suffix + DayBreakdownCard component (F1 UI + F2 card)

**Files:**
- Modify: `frontend/src/features/train/components/SetBudgetCard.tsx` (+ its test)
- Create: `frontend/src/features/train/components/DayBreakdownCard.tsx`
- Test: `frontend/src/features/train/components/DayBreakdownCard.test.tsx`

**Interfaces:**
- Consumes: `DayGroupRow`, `SESSION_MUSCLE_CAP` from `@/features/train/logic/setBudget`; `muscleColor` families.
- Produces: `DayBreakdownCard({ rows, warnings }: { rows: DayGroupRow[]; warnings: { label: string; sets: number; suggestDay: string | null }[] })` — presentational only, parent computes.

**Design (binding: sibling spec + mockup asset `docs/superpowers/specs/assets/2026-08-03-daily-breakdown-mockup.html`, variant A phone):**
- SetBudgetCard expanded row mono value becomes `` `${pct}% · ${split}` `` where split gains a `+${plyoSets} plyo` neutral-colored (`var(--text-tertiary)`) suffix when `plyoSets > 0`.
- DayBreakdownCard: card with eyebrow `Ma · izmonként` + right `label-mono` `max 11 szett/izom`; rows: 5px rail (`muscleColor(colorMuscle).rail`), bold label, right mono `` `${sets} / 11` `` (over: `var(--error)` + ` ⚠`; plyo-only rows show `` `${plyoSets} plyo` `` instead), 8px bar `width: min(100, sets/12*100)%` with a 2px cap-line marker at `11/12*100 ≈ 91.7%` (`var(--text-tertiary)`, opacity .5); over fill `linear-gradient(90deg, <rail>, var(--error))`.
- Warning lines (amber box, same style as SetBudgetCard's): `⚠ {label}: ma {sets} szett — 11 fölött nincs kimutatható plusz.` + when `suggestDay` non-null: ` Vigyél át szettet egy másik napra (pl. {suggestDay})!`
- Render nothing (null) when `rows` is empty (off-day).

- [ ] **Step 1: Failing tests** — `DayBreakdownCard.test.tsx`: renders `12 / 11` + `⚠` for an over row; renders `4 plyo` for a plyo-only row; warning line includes `(pl. Sze)` when suggestDay given and omits the clause when null; returns null on empty rows. SetBudgetCard.test: a row with `plyoSets: 10` shows `+10 plyo`.
- [ ] **Step 2:** `cd frontend && pnpm test DayBreakdownCard SetBudgetCard` → FAIL.
- [ ] **Step 3: Implement** per design.
- [ ] **Step 4:** both modes green (same filters).
- [ ] **Step 5: Commit** — `feat(train): day breakdown card + plyo suffix on budget rows (mezo-smhn)`.

---

### Task 3: MesoEditor wiring — daily card + over-row highlight (F2 integration)

**Files:**
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (+ test), `frontend/src/features/train/components/ExerciseAccordionRow.tsx` (optional `highlight?: boolean` prop → faint `1px solid color-mix(in srgb, var(--error) 45%, transparent)` border on the card; + test case)

**Interfaces:** consumes Task 1's `daySessionBreakdown` + `leastLoadedDayFor` and Task 2's `DayBreakdownCard`.

**Behavior:** in `MesoEditor`, between the hero and `SetBudgetCard`, render `<DayBreakdownCard rows={daySessionBreakdown(day)} warnings={overRows.map(r => ({ label: r.label, sets: r.sets, suggestDay: leastLoadedDayFor(days, r.group, day.day) }))} />`. Exercise rows whose non-plyo `budgetGroup(ex.muscle)` is in the over set get `highlight`. Hero's `warningCount` formula unchanged (still week-level; plyo exclusion flows in via Task 1 automatically).

- [ ] **Step 1: Failing tests** — MesoEditor.test: with the existing fixture (Cs back-wide 13 sets), selecting day Cs shows `13 / 11`; the `Gyak c · szerkesztés` row card carries the highlight (assert via a `data-over="true"` attribute you add to the accordion card root when highlighted — cheap to assert); H day (chest 12) shows its own breakdown and warning text with `(pl.` day suggestion only if applicable.
- [ ] **Step 2:** `cd frontend && pnpm test MesoEditor ExerciseAccordionRow` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** both modes green; also `pnpm test MesoExercises MesocyclePlannerPage` (integration surfaces) both modes.
- [ ] **Step 5: Commit** — `feat(train): wire daily breakdown + over-row highlight into MesoEditor (mezo-smhn)`.

---

### Task 4: Backend warm-up ladders (F3 execution side) — BACKEND task

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/HypertrophyProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SetRecommendationService.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.hypertrophy` block)
- Test: the existing IT covering SetRecommendationService (find it: `grep -rln "SetRecommendation" backend/src/test` — extend it; if none exists, create `SetRecommendationServiceIT` extending `AbstractIntegrationTest` per `integration_test_framework.md`)

**Changes:**
1. `HypertrophyProperties`: replace `List<Ramp> warmupRamp` with `@NotNull @Size(min = 1) Map<Integer, List<Ramp>> warmupLadders`; `Ramp` becomes `record Ramp(@DecimalMin("0.1") @DecimalMax("1.0") double pct, @Min(1) int reps)` (absolute reps — drop `repsFactor`).
2. `application.yml`:
```yaml
    warmup-ladders:
      1: [ { pct: 0.70, reps: 4 } ]
      2: [ { pct: 0.50, reps: 8 }, { pct: 0.75, reps: 3 } ]
      3: [ { pct: 0.50, reps: 8 }, { pct: 0.70, reps: 4 }, { pct: 0.90, reps: 2 } ]
```
3. `SetRecommendationService` warm-up loop: pick `ladder = props.warmupLadders().get(Math.min(n, 3))` where `n = ex.getWarmupSets()` (guard `n > 0`); for `n > 3`, prepend `n - 3` repeats of the 3-ladder's first entry (ascending order preserved); per set: `targetWeightKg = base == null ? null : roundClamp(base × pct)`, `targetReps = r.reps()`, `targetRIR = null` (unchanged).
4. Keep the "warmup rows emitted even with null base" comment/behavior.

- [ ] **Step 1: Failing IT cases** (test-first): warmupSets=3 with base 100 → 50/70/90 kg (roundClamp applied) × 8/4/2 reps; warmupSets=1 → single 70 kg × 4; warmupSets=4 → 4 rows `50,50,70,90`; base null → 3 rows with null weights and the absolute reps. Use the populator factories (`*Populator`) per `integration_test_framework.md`; naming `test{Method}_should{Result}_when{Condition}`; AssertJ only.
- [ ] **Step 2:** `cd backend && ./mvnw clean test -Dtest='SetRecommendationServiceIT,ArchitectureTest'` (timeout 900000, foreground) → new cases FAIL. **Do NOT run the full backend suite.**
- [ ] **Step 3: Implement** changes 1-4. Config conventions: `@Validated` properties record, no `@Value`, everything under `mezo.hypertrophy`.
- [ ] **Step 4:** same focused command → PASS. Check `git status` shows no archunit-store change.
- [ ] **Step 5: Commit** — `feat(train): count-keyed absolute-rep warm-up ladders (mezo-dnln)` (include the yml + both java files + test).

---

### Task 5: FE warm-up suggestion + docs + full gates (F3 planning side)

**Files:**
- Create: `frontend/src/features/train/logic/warmupSuggest.ts` + `warmupSuggest.test.ts`
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (add-path override + suggestion affordance), `ExerciseAccordionRow.tsx` (Bemelegítő tile `↺ javaslat: n` chip when differs, tap → `onChange({ warmupSets: n })`), their tests
- Modify: `docs/features/train.md` (§4 budget/plyo + daily card; §4.4 recommendation ladder; file map), spec reality-notes if any deviation
- Test: full FE gate

**Interfaces:** `suggestedWarmupSets(day: MesoDay, exId: string): number` — rules verbatim from Global Constraints; "bodyweight-ish" = `anchorWeightKg == null && repMax >= 15`.

- [ ] **Step 1: Failing tests** — `warmupSuggest.test.ts` covering every branch (plyo→0; bodyweight-ish→0; first compound→3; first compound with anchor 40→2; second compound same group→1; isolation opening a group→1; isolation after group hit→0; plyo rows don't count as "first" for the group). Component tests: adding an exercise via MesoEditor's add path stores the suggested count (mock picker flow as in existing MesoExercises tests); accordion shows `javaslat: 1` chip when manual 2 ≠ suggested 1 and clicking applies it.
- [ ] **Step 2:** `cd frontend && pnpm test warmupSuggest MesoEditor ExerciseAccordionRow` → FAIL.
- [ ] **Step 3: Implement** (MesoEditor add-path: after `onAddClick`→parent insert, MesoEditor's auto-expand effect already identifies the new id — extend it to fire `onChange(day.day, newId, { warmupSets: suggestedWarmupSets(day, newId) })` once when the suggestion differs from the stored default).
- [ ] **Step 4: Full FE gate** — `pnpm build`, `pnpm test`, `VITE_USE_MOCK=true pnpm test` (timeout 900000 each, own calls) → all green; fix only failures your changes caused.
- [ ] **Step 5: Docs** — train.md updates + `node scripts/lint-docs.mjs` clean for train.md.
- [ ] **Step 6: Commit** — `feat(train): adaptive warm-up suggestions in editor; wave-2 docs (mezo-dnln)`.

---

## Ship checklist (controller)

Push branch → self-PR → CI green (test-visual may need linux golden regen) → worktree-safe `--no-ff` merge → push main (auto-deploy) → close mezo-0znc, mezo-smhn, mezo-dnln → bd sync. After deploy: Daniel's live plan should show Comb zöldben (~75%) and Hát without the Dead Hang inflation.
