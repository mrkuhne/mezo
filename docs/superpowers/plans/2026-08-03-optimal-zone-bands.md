# Optimal-Zone Bands Implementation Plan (mezo-oyhy.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Green MEV→100% optimal-zone band + under-volume signal on the weekly set-budget card, so the meso builder guides toward the optimal plan instead of only warning on excess.

**Architecture:** Pure client-side extension of the existing planning-time budget layer. `setBudget.ts` gains a per-group MEV table, an `'under'` budget level, and zone-projection fields on `MuscleBudgetRow`; `SetBudgetCard.tsx` renders the zone underlay, gray under-state, and soft explanation rows. No backend, API, or persistence change; mock and real mode behave identically. Spec: `docs/superpowers/specs/2026-08-03-optimal-zone-bands-design.md`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library. All work under `frontend/`.

## Global Constraints

- Read `docs/references/frontend_conventions.md` before touching code; it is the house standard.
- Imports are deep + absolute via `@/*` (e.g. `@/features/train/logic/setBudget`); never relative `../`; no new barrels.
- Colors ONLY as CSS custom properties (`var(--sage)`, `color-mix(...)`) — no raw hex/rgba in components.
- UI copy is Hungarian; code/comments/commits English.
- Commit subjects: conventional, carrying the bd id, e.g. `feat(train): ... (mezo-oyhy.1)`.
- Working dir for all commands: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2` (branch `claude/mezo-oyhy-epic-69b88a` — already checked out; do NOT create branches).
- Run ONLY the focused frontend tests named in each task — never the backend suite (`./mvnw`), never `pnpm dev`.
- The repo pre-commit hook may force-add a root-level `issues.jsonl`. After every commit run `git show --stat HEAD`; if `issues.jsonl` (repo root, NOT `.beads/issues.jsonl`) appears, fix with: `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify`.

---

### Task 1: Logic — MEV table, `'under'` level, zone projection (`setBudget.ts`)

**Files:**
- Modify: `frontend/src/features/train/logic/setBudget.ts`
- Modify: `frontend/src/features/train/logic/setBudget.test.ts`
- Modify: `frontend/src/features/train/components/SetBudgetCard.test.tsx` (fixture fields only — compile fix; behavior tests come in Task 2)

**Interfaces:**
- Consumes: existing `budgetOf`, `budgetLevel`, `leastLoadedDayFor` (already in `setBudget.ts`).
- Produces (Task 2 relies on these exact names):
  - `export const GROUP_MEV: Record<string, number>`
  - `export type BudgetLevel = 'ok' | 'near' | 'over' | 'under'`
  - `MuscleBudgetRow` gains: `mev: number | null`, `zoneStart: number | null` (same 0..1 unit as `budget`; spec calls it zoneStartPct), `setsToZone: number`, `suggestedDay: string | null`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/train/logic/setBudget.test.ts` (uses the file's existing `ex`/`plyoEx`/`day` helpers):

```ts
describe('optimal zone (mezo-oyhy.1)', () => {
  it('flags under strictly below the group MEV', () => {
    const under = muscleBudgets([day('H', 'arms', [ex('biceps-long', 7, 0)])])
    const atMev = muscleBudgets([day('H', 'arms', [ex('biceps-long', 8, 0)])])
    expect(under[0].level).toBe('under')
    expect(under[0].setsToZone).toBe(1)
    expect(atMev[0].level).toBe('ok')
    expect(atMev[0].setsToZone).toBe(0)
  })

  it('projects zoneStart onto the budget scale with the group style mix', () => {
    const volume = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 2)])])
    expect(volume[0].zoneStart).toBeCloseTo(4 / 20) // pure volume: MEV 4 of cap 20
    const failure = muscleBudgets([day('H', 'chest', [ex('chest-mid', 5, 0)])])
    expect(failure[0].zoneStart).toBeCloseTo(4 / 12) // pure failure: MEV 4 of cap 12
    const mixed = muscleBudgets([day('H', 'chest', [ex('chest-mid', 6, 0), ex('chest-upper', 4, 2)])])
    expect(mixed[0].budget).toBeCloseTo(0.7) // 6/12 + 4/20
    expect(mixed[0].zoneStart).toBeCloseTo(0.28) // 0.7 × 4/10
  })

  it('compares MEV against non-plyo sets only', () => {
    const rows = muscleBudgets([day('H', 'quad', [ex('quad', 3, 0), plyoEx('quad', 10)])])
    expect(rows[0].level).toBe('under') // 3 < quad MEV 4 — plyo does not rescue it
  })

  it('traps and core have no lower bound and never go under', () => {
    const rows = muscleBudgets([day('H', 'back', [ex('traps', 1, 0)])])
    expect(rows[0]).toMatchObject({ level: 'ok', mev: null, zoneStart: null, setsToZone: 0 })
  })

  it('suggests the least-loaded training day for an under group', () => {
    const days = [
      day('H', 'arms', [ex('biceps-long', 3, 0), ex('chest-mid', 6, 0)]),
      day('Csü', 'chest', [ex('chest-mid', 2, 0)]),
    ]
    const bi = muscleBudgets(days).find((r) => r.group === 'biceps')!
    expect(bi.level).toBe('under')
    expect(bi.suggestedDay).toBe('Csü')
    const inZone = muscleBudgets(days).find((r) => r.group === 'chest')!
    expect(inZone.suggestedDay).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/logic/setBudget.test.ts`
Expected: the new `optimal zone` describe FAILS (`setsToZone`/`mev`/`zoneStart` undefined, level never `'under'`); all pre-existing tests still PASS.

- [ ] **Step 3: Implement in `setBudget.ts`**

3a. Extend the level union (replace the existing line `export type BudgetLevel = 'ok' | 'near' | 'over'`):

```ts
export type BudgetLevel = 'ok' | 'near' | 'over' | 'under'
```

3b. Add the MEV table right below `NEAR_THRESHOLD`:

```ts
// Weekly minimum-effective set counts per budget group — lower edges of the
// RP intermediate MEV ranges (docs/research/concepts/program-design-rules.md),
// conservative on purpose. traps/core are intentionally absent: RP treats
// their MEV as ~0 (indirect volume from rows/deadlifts/compounds covers them),
// so they never trigger the under-volume signal. "Starting points, not gospel."
export const GROUP_MEV: Record<string, number> = {
  chest: 4, back: 10, quad: 4, ham: 2, glute: 6, shoulder: 6, biceps: 8, triceps: 4, calf: 4,
}
```

3c. Extend `MuscleBudgetRow` (after the `level: BudgetLevel` field):

```ts
  /** Weekly minimum-effective sets for the group; null = no lower bound (traps/core). */
  mev: number | null
  /** Green-zone start on the budget scale (same 0..1 unit as budget); null when mev is. */
  zoneStart: number | null
  /** Non-plyo sets still missing to reach MEV; 0 when in zone or no lower bound. */
  setsToZone: number
  /** Least-loaded training day to add the missing sets on; only set for under rows. */
  suggestedDay: string | null
```

3d. In `muscleBudgets`, add the new fields to the accumulator seed literal (the `row = { group, label, ... }` line): append `mev: null, zoneStart: null, setsToZone: 0, suggestedDay: null` before the closing brace.

3e. Replace the final `.map(...)` of `muscleBudgets` with:

```ts
    .map((r) => {
      const budget = budgetOf(r.failureSets, r.volumeSets)
      const mev = GROUP_MEV[r.group] ?? null
      const under = mev !== null && r.workingSets < mev
      // Project the MEV set count onto the budget scale with the group's own
      // style mix: at exactly MEV sets the bar would sit at budget × MEV / sets.
      return {
        ...r,
        budget,
        mev,
        zoneStart: mev !== null ? Math.min(1, (budget * mev) / r.workingSets) : null,
        setsToZone: mev !== null ? Math.max(0, mev - r.workingSets) : 0,
        suggestedDay: under ? leastLoadedDayFor(days, r.group, '') : null,
        level: under ? ('under' as const) : budgetLevel(budget),
      }
    })
```

(`leastLoadedDayFor` is declared later in the same file — function declarations hoist, no reorder needed. `excludeDay: ''` matches no day, so every training day is a candidate.)

3f. Compile-fix the two fixture literals in `frontend/src/features/train/components/SetBudgetCard.test.tsx` (they are typed `MuscleBudgetRow` and now miss required fields). Replace lines 6–7 with:

```ts
const over: MuscleBudgetRow = { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', failureSets: 8, volumeSets: 8, workingSets: 16, plyoSets: 0, budget: 8 / 12 + 8 / 20, level: 'over', mev: 4, zoneStart: (8 / 12 + 8 / 20) * 4 / 16, setsToZone: 0, suggestedDay: null }
const ok: MuscleBudgetRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', failureSets: 0, volumeSets: 8, workingSets: 8, plyoSets: 0, budget: 0.4, level: 'ok', mev: 4, zoneStart: 0.2, setsToZone: 0, suggestedDay: null }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/setBudget.test.ts src/features/train/components/SetBudgetCard.test.tsx`
Expected: ALL PASS (new describe + every pre-existing test, including the untouched card tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/setBudget.ts frontend/src/features/train/logic/setBudget.test.ts frontend/src/features/train/components/SetBudgetCard.test.tsx
git commit -m "feat(train): MEV table + under level + zone projection in setBudget (mezo-oyhy.1)"
git show --stat HEAD   # verify no root-level issues.jsonl slipped in (see Global Constraints)
```

---

### Task 2: UI — zone underlay, under pill, hints, explanation rows (`SetBudgetCard.tsx`)

**Files:**
- Modify: `frontend/src/features/train/components/SetBudgetCard.tsx`
- Modify: `frontend/src/features/train/components/SetBudgetCard.test.tsx`

**Interfaces:**
- Consumes from Task 1: `MuscleBudgetRow` with `mev: number | null`, `zoneStart: number | null` (0..1), `setsToZone: number`, `suggestedDay: string | null`, and `level` possibly `'under'`.
- Produces: no API change — `SetBudgetCardProps` stays `{ budgets, capWarnings, defaultOpen? }`. `MesoEditor`/`MuscleWeekSheet` pick the feature up with zero changes (`MesoEditor`'s `warningCount` counts only over/cap, so under-volume correctly does NOT force the card open).

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/train/components/SetBudgetCard.test.tsx` (below the existing fixtures; `over`/`ok` were extended in Task 1):

```tsx
const under: MuscleBudgetRow = { group: 'ham', label: 'Hamstring', colorMuscle: 'ham', failureSets: 0, volumeSets: 1, workingSets: 1, plyoSets: 0, budget: 0.05, level: 'under', mev: 2, zoneStart: 0.1, setsToZone: 1, suggestedDay: 'Csü' }

describe('optimal zone (mezo-oyhy.1)', () => {
  it('collapsed: under pill carries the ↓ prefix', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} />)
    expect(screen.getByText(/Hamstring ↓5%/)).toBeInTheDocument()
    expect(screen.getByText(/Comb 40%/)).toBeInTheDocument()
  })
  it('expanded: renders the green zone underlay from zoneStart', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByTestId('zone-quad')).toHaveStyle({ left: '20%' })
  })
  it('expanded: under row shows the sets-to-zone hint, in-zone row the ✓', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/MEV alatt — még \+1 szett a zónáig/)).toBeInTheDocument()
    expect(screen.getByText(/optimális zónában/)).toBeInTheDocument()
  })
  it('expanded: under explanation row is soft copy with the suggested day', () => {
    render(<SetBudgetCard budgets={[under]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/Hamstring: 1 szett — a minimum-hatásos mennyiség \(MEV ≈ 2\) alatt/)).toBeInTheDocument()
    expect(screen.getByText(/pl\. Csü/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument() // no red warning for under
  })
  it('rows without a lower bound get neither zone nor hint', () => {
    const traps: MuscleBudgetRow = { ...ok, group: 'traps', label: 'Trapéz', colorMuscle: 'traps', mev: null, zoneStart: null }
    render(<SetBudgetCard budgets={[traps]} capWarnings={[]} defaultOpen />)
    expect(screen.queryByTestId('zone-traps')).not.toBeInTheDocument()
    expect(screen.queryByText(/optimális zónában/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/components/SetBudgetCard.test.tsx`
Expected: the new describe FAILS (no ↓ pill, no `zone-*` testid, no hint/explanation copy); the 4 pre-existing tests still PASS.

- [ ] **Step 3: Implement in `SetBudgetCard.tsx`**

3a. `pillColors` — add an optional `border` and the under branch (insert after the `near` line):

```ts
function pillColors(row: MuscleBudgetRow): { bg: string; fg: string; border?: string } {
  if (row.level === 'over') return { bg: 'color-mix(in srgb, var(--error) 12%, transparent)', fg: 'var(--error)' }
  if (row.level === 'near') return { bg: 'var(--wash-amber)', fg: 'var(--amber-deep)' }
  if (row.level === 'under') return { bg: 'var(--surface-2)', fg: 'var(--text-tertiary)', border: '1.5px dashed var(--text-tertiary)' }
  const fam = muscleColor(row.colorMuscle)
  return { bg: fam.wash, fg: fam.deep }
}
```

3b. Collapsed pill — apply the border and the ↓ prefix (replace the pill `<span>` body):

```tsx
              <span
                key={row.group}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: colors.bg, color: colors.fg,
                  ...(colors.border ? { border: colors.border } : {}),
                }}
              >
                {row.label} {row.level === 'under' ? '↓' : ''}{pct(row.budget)}%
              </span>
```

3c. Expanded row — zone underlay + under fill color + per-row hint. Replace the expanded-row `budgets.map` body's bar block (currently the `const fam/p/fillWidth/fillBackground` lines and the two nested `<div>`s of the track) with:

```tsx
            const fam = muscleColor(row.colorMuscle)
            const p = pct(row.budget)
            const fillWidth = Math.min(100, p)
            const fillBackground =
              row.level === 'over' ? 'linear-gradient(90deg, var(--coral), var(--error))'
              : row.level === 'under' ? 'var(--text-tertiary)'
              : fam.rail
            return (
              <div key={row.group} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 5, height: 34, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
                <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
                    <span className="label-mono" style={{ fontSize: 10.5 }}>
                      {p}% · {setStyleSummary(row.failureSets, row.volumeSets)}
                      {row.plyoSets > 0 && <span style={{ color: 'var(--text-tertiary)' }}> +{row.plyoSets} plyo</span>}
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 8.5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    {row.zoneStart !== null && (
                      <div
                        data-testid={`zone-${row.group}`}
                        style={{
                          position: 'absolute', top: 0, bottom: 0, right: 0,
                          left: `${Math.min(100, Math.round(row.zoneStart * 100))}%`,
                          background: 'color-mix(in srgb, var(--sage) 28%, transparent)',
                        }}
                      />
                    )}
                    <div style={{ position: 'relative', height: '100%', width: `${fillWidth}%`, borderRadius: 999, background: fillBackground }} />
                  </div>
                  {row.level === 'under' ? (
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>↓ MEV alatt — még +{row.setsToZone} szett a zónáig</span>
                  ) : row.zoneStart !== null && row.level !== 'over' ? (
                    <span style={{ fontSize: 10.5, color: 'var(--sage-deep)' }}>✓ optimális zónában</span>
                  ) : null}
                </div>
              </div>
            )
```

3d. Explanation rows — above the component's `return`, next to the existing `overBudgets` line, add:

```ts
  const underRows = budgets.filter((b) => b.level === 'under')
```

Change the warnings-block condition to include them:

```tsx
          {overBudgets.length > 0 || capWarnings.length > 0 || underRows.length > 0 ? (
```

and append inside that block, AFTER the `capWarnings.map(...)` (severity order — red, amber, then the soft nudge):

```tsx
              {underRows.map((row) => (
                <div
                  key={`under-${row.group}`}
                  style={{
                    borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.45,
                    background: 'var(--surface-2)', color: 'var(--text-secondary)',
                  }}
                >
                  ↓ <strong>{row.label}: {row.workingSets} szett — a minimum-hatásos mennyiség (MEV ≈ {row.mev}) alatt.</strong>{' '}
                  Ennyi inkább csak szinten tart; +{row.setsToZone} szett már növekedést hozna{row.suggestedDay ? ` (pl. ${row.suggestedDay})` : ''}.
                </div>
              ))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/components/SetBudgetCard.test.tsx src/features/train/logic/setBudget.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/SetBudgetCard.tsx frontend/src/features/train/components/SetBudgetCard.test.tsx
git commit -m "feat(train): green optimal-zone band + under-volume signal on SetBudgetCard (mezo-oyhy.1)"
git show --stat HEAD   # verify no root-level issues.jsonl slipped in (see Global Constraints)
```

---

### Task 3: Gate — full frontend verification + living feature doc

**Files:**
- Modify: `docs/features/train.md` (§4 — the set-budget layer description)

**Interfaces:**
- Consumes: Tasks 1–2 landed. No code changes in this task.

- [ ] **Step 1: Update `docs/features/train.md` §4**

Locate the paragraph in §4 that describes the weekly set-budget layer (`setBudget.ts` / `SetBudgetCard` — search for "szet-büdzsé" or `setBudget`). Extend it in place (living doc — overwrite, no changelog) so it also states, in the doc's existing style and language:

- The budget bar now renders a **green optimal-zone underlay** from the muscle-specific MEV to 100%: `GROUP_MEV` in `setBudget.ts` holds the RP lower-edge MEV per budget group (chest 4 · back 10 · quad 4 · ham 2 · glute 6 · shoulder 6 · biceps 8 · triceps 4 · calf 4; traps/core have no lower bound), projected onto the budget scale with the group's style mix (`zoneStart = budget × MEV / workingSets`).
- A new `'under'` budget level (non-plyo `workingSets < MEV`, trained groups only) renders a gray dashed ↓ pill, a `még +N szett a zónáig` hint, and a **soft neutral explanation row** (never red — explain, don't scold) with a `leastLoadedDayFor` day suggestion. Under-volume does NOT force the card open (`defaultOpen` still reacts to over/cap only).
- Volume counting stays direct-only by conscious v1 decision (fractional counting is bd `mezo-oyhy.5`); design: `docs/superpowers/specs/2026-08-03-optimal-zone-bands-design.md`.
- Update the doc's `key_files` frontmatter list only if it does not already contain `setBudget.ts` / `SetBudgetCard.tsx` (it almost certainly does).

- [ ] **Step 2: Run the doc lint**

Run: `node scripts/lint-docs.mjs`
Expected: exit 0, `train.md` not flagged stale. Fix anything it reports before proceeding.

- [ ] **Step 3: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: `tsc -b` + vite build clean; the FULL vitest suite green in BOTH modes. Report the exact failing output if anything is red — do not "fix" unrelated tests; stop and report instead.

- [ ] **Step 4: Commit**

```bash
git add docs/features/train.md
git commit -m "docs(train): optimal-zone band + under-volume signal in train.md §4 (mezo-oyhy.1)"
git show --stat HEAD   # verify no root-level issues.jsonl slipped in (see Global Constraints)
```
