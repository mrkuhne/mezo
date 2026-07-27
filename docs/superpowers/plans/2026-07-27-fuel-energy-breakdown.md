# Energy-breakdown explanation sheet + Profile Alap-TDEE restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dynamic daily-energy breakdown legible and explained — restyle the Profile Alap-TDEE block (Variant B), make the Fuel "Mai cél" chips tappable, and add one shared presentational `EnergyBreakdownSheet` (equation bar + base/movement/deficit sections, each a structured tile row + prose) opened from both.

**Architecture:** A pure presentational `EnergyBreakdownSheet` in `features/fuel/sheets/` takes a typed `EnergyBreakdown` prop (no data hooks). Two pure adapters build that prop from existing data: `features/fuel/logic/buildEnergyBreakdown.ts` (Fuel — today's `plan.energy` + blocks + segment) and `features/me/logic/buildTdeeBreakdown.ts` (Profile — `tdeeBootstrap`, no deficit). `useFuelTimeline` exposes `blocks`/`weightKg`/`segment` and a ready `energyBreakdown`. CSS lives in `prototype.css`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Tailwind-era utility + `prototype.css` design tokens, `@/shared/ui/Sheet`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-27-energy-breakdown-explanation-design.md`. Driving bd: **mezo-hobb**.
- Frontend conventions are MANDATORY (`docs/references/frontend_conventions.md`): four layers; sheets in `features/<domain>/sheets/` wrapping `@/shared/ui/Sheet`; deep absolute `@/*` imports, **no `../`**, no barrels except `data/hooks.ts`; colocate tests; `shared/ui` stays domain-free (that is why the shared sheet lives under `features/fuel/`, imported cross-feature by `me`).
- Colors via `var(--token)` only — **no raw hex/rgba** in TSX or new CSS.
- No new backend fields / API changes. Everything derives from existing `useGoal()` (`tdeeBootstrap`, `prescription.segments[]`) + Fuel timeline `blocks`/`plan.energy` + `useBiometricProfile()` (`activityLevel`).
- **Gate (both modes green):** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- Commits: conventional subject carrying the bd id, e.g. `feat(fuel): … (mezo-hobb)`. In this worktree commit with the bd hook disabled: `git -c core.hooksPath=/dev/null commit …` and stage only the files named.

---

### Task 1: `EnergyBreakdown` type + presentational `EnergyBreakdownSheet` + sheet CSS

**Files:**
- Create: `frontend/src/features/fuel/sheets/EnergyBreakdownSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append the sheet + tile classes)

**Interfaces:**
- Produces:
  ```ts
  export type EnergySection = 'base' | 'movement' | 'deficit'
  export interface EnergyBlock { label: string; kind: 'gym' | 'sport' | 'run'; min: number; kcal: number }
  export interface EnergyBreakdown {
    base: { kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ' }
    movement: { kcal: number; isWeeklyAvg: boolean; blocks?: EnergyBlock[] }
    deficit?: { kcal: number; rateKgPerWk: number; goalLabel: string; rationale?: string }
    target: number
  }
  export function EnergyBreakdownSheet(props: { breakdown: EnergyBreakdown; initial: EnergySection; onClose: () => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnergyBreakdownSheet, type EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const fuelBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: {
    kcal: 1290, isWeeklyAvg: false,
    blocks: [
      { label: 'Gym', kind: 'gym', min: 60, kcal: 430 },
      { label: 'Röplabda', kind: 'sport', min: 90, kcal: 860 },
    ],
  },
  deficit: { kcal: -869, rateKgPerWk: 0.79, goalLabel: 'Nyári cut' },
  target: 2693,
}

const profileBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: { kcal: 1207, isWeeklyAvg: true },
  target: 3479,
}

describe('EnergyBreakdownSheet', () => {
  it('renders all three sections and per-activity pills when deficit + blocks present', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />)
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect(screen.getByText('Betáblázott mozgás')).toBeInTheDocument()
    expect(screen.getByText(/Deficit/)).toBeInTheDocument()
    // per-activity tiles
    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.getByText('Röplabda')).toBeInTheDocument()
    expect(screen.getByText('60 perc')).toBeInTheDocument()
    // equation bar total
    expect(screen.getAllByText('2693').length).toBeGreaterThan(0)
  })

  it('omits the deficit section and shows a weekly-avg movement (no pills) when deficit absent', () => {
    render(<EnergyBreakdownSheet breakdown={profileBreakdown} initial="base" onClose={vi.fn()} />)
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect(screen.queryByText(/Deficit/)).not.toBeInTheDocument()
    expect(screen.queryByText('Gym')).not.toBeInTheDocument()
    expect(screen.getByText(/heti átlag/i)).toBeInTheDocument()
  })

  it('highlights the initial section', () => {
    const { container } = render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="deficit" onClose={vi.fn()} />)
    const hl = container.querySelector('.seg.hl')
    expect(hl?.textContent).toMatch(/Deficit/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx`
Expected: FAIL — module `EnergyBreakdownSheet` not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/fuel/sheets/EnergyBreakdownSheet.tsx
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'

export type EnergySection = 'base' | 'movement' | 'deficit'
export interface EnergyBlock { label: string; kind: 'gym' | 'sport' | 'run'; min: number; kcal: number }
export interface EnergyBreakdown {
  base: { kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ' }
  movement: { kcal: number; isWeeklyAvg: boolean; blocks?: EnergyBlock[] }
  deficit?: { kcal: number; rateKgPerWk: number; goalLabel: string; rationale?: string }
  target: number
}

const KG_KCAL = 7700 // kcal per kg body fat — the deficit/rate relationship
const BLOCK_EMOJI: Record<EnergyBlock['kind'], string> = { gym: '🏋️', sport: '🏐', run: '🏃' }
const FORMULA_LABEL = { KATCH: 'Katch-McArdle', MSJ: 'Mifflin-St Jeor' } as const
const nf = (n: number) => Math.round(n).toLocaleString('hu-HU')
const signed = (n: number) => (n < 0 ? `−${nf(Math.abs(n))}` : `+${nf(n)}`)
const kg = (n: number) => n.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// One roomy tile: icon+name header, uppercase sub-label, display value + unit.
function Tile({ tone, emoji, name, sub, value, unit, result }: {
  tone?: 'sage' | 'amber' | 'coral'; emoji?: string; name?: string; sub: string; value: string; unit?: string; result?: boolean
}) {
  return (
    <div className={`btile${tone ? ' ' + tone : ''}${result ? ' result' : ''}`}>
      {name && <div className="thd">{emoji && <span className="emo">{emoji}</span>}<span className="nm">{name}</span></div>}
      <div className="sub">{sub}</div>
      <div className="val">{value}{unit && <span className="u">{unit}</span>}</div>
    </div>
  )
}

export function EnergyBreakdownSheet({ breakdown, initial, onClose }: {
  breakdown: EnergyBreakdown; initial: EnergySection; onClose: () => void
}) {
  const { base, movement, deficit, target } = breakdown
  const hl = (s: EnergySection) => (s === initial ? ' hl' : '')

  return (
    <Sheet onClose={onClose} labelledBy="energy-breakdown-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div className="col" style={{ flex: 1 }}>
              <span className="eyebrow" style={{ color: 'var(--sage-deep)' }}>Napi cél</span>
              <h2 id="energy-breakdown-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 19, margin: '3px 0 2px' }}>
                Honnan jön a {nf(target)} kcal?
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.4 }}>
                A napi cél nem statikus — az alapanyagcserédből, a mai betáblázott mozgásból{deficit ? ' és a célod deficitjéből' : ''} áll össze.
              </p>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* equation bar */}
          <div className="eqbar">
            <div className="t base"><div className="k">Alap</div><div className="v">{nf(base.kcal)}</div></div>
            <div className="op">+</div>
            <div className="t move"><div className="k">Mozgás</div><div className="v">{nf(movement.kcal)}</div></div>
            {deficit && <><div className="op">−</div>
              <div className="t def"><div className="k">Deficit</div><div className="v">{nf(Math.abs(deficit.kcal))}</div></div></>}
            <div className="op">=</div>
            <div className="t res"><div className="k">Mai cél</div><div className="v">{nf(target)}</div></div>
          </div>

          {/* BASE */}
          <div className={`seg${hl('base')}`}>
            <div className="sh"><span className="sdot dot-sage" /><span className="stit txt-sage">Alaphő · NEAT</span><span className="samt txt-sage">{nf(base.kcal)}</span></div>
            <div className="btiles">
              <Tile tone="sage" emoji="🔥" name="Alapanyagcsere" sub={FORMULA_LABEL[base.formula]} value={nf(base.bmr)} unit="kcal" />
              <div className="op">×</div>
              <Tile tone="sage" emoji="🚶" name="NEAT-szorzó" sub={base.neatLabel} value={kg(base.neat).replace(',00', ',0')} unit="×" />
              <div className="op">=</div>
              <Tile result sub="Alaphő" value={nf(base.kcal)} unit="kcal" />
            </div>
            <p className="why">Az <b>alapanyagcseréd</b> ({FORMULA_LABEL[base.formula]}) szorozva az <b>életmód-szorzóddal</b>. Ennyit égetsz el egy átlagos napon <b>edzés nélkül</b>.</p>
          </div>

          {/* MOVEMENT */}
          <div className={`seg${hl('movement')}`}>
            <div className="sh"><span className="sdot dot-amber" /><span className="stit txt-amber">Betáblázott mozgás</span><span className="samt txt-amber">{signed(movement.kcal)}</span></div>
            <div className="btiles">
              {movement.blocks && movement.blocks.length > 0 ? (
                <>
                  {movement.blocks.map((b, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      {i > 0 && <div className="op">+</div>}
                      <Tile tone="amber" emoji={BLOCK_EMOJI[b.kind]} name={b.label} sub={`${b.min} perc`} value={nf(b.kcal)} unit="kcal" />
                    </div>
                  ))}
                  <div className="op">=</div>
                  <Tile result sub="Mai mozgás" value={signed(movement.kcal)} unit="kcal" />
                </>
              ) : (
                <Tile tone="amber" emoji="📅" name="Heti átlag" sub="betáblázott ÷ 7" value={signed(movement.kcal)} unit="kcal" />
              )}
            </div>
            <p className="why">A <b>{movement.isWeeklyAvg ? 'heti' : 'mai'}</b> betáblázott edzéseid becsült energiája (MET-alapú, a testsúlyoddal skálázva). Mozgós napon több, pihenőnapon 0 — <b>ezért nem fix</b> a napi cél.</p>
          </div>

          {/* DEFICIT */}
          {deficit && (
            <div className={`seg${hl('deficit')}`}>
              <div className="sh"><span className="sdot dot-coral" /><span className="stit txt-coral">Deficit · {deficit.goalLabel}</span><span className="samt txt-coral">{signed(deficit.kcal)}</span></div>
              <div className="btiles">
                <Tile tone="coral" emoji="🎯" name="Cél ütem" sub={deficit.goalLabel} value={kg(Math.abs(deficit.rateKgPerWk))} unit="kg/hét" />
                <div className="op">×</div>
                <Tile tone="coral" emoji="🔥" name="Zsír energia" sub="1 kg ≈" value={nf(KG_KCAL)} unit="kcal" />
                <div className="op">÷7</div>
                <Tile result sub="Napi deficit" value={signed(deficit.kcal)} unit="kcal" />
              </div>
              <p className="why">{deficit.rationale
                ? deficit.rationale
                : <>A célod (<b>{deficit.goalLabel}</b>) heti üteméből: <b>{kg(Math.abs(deficit.rateKgPerWk))} kg/hét</b> változáshoz napi ~{nf(Math.abs(deficit.kcal))} kcal eltérés kell (7700 kcal ≈ 1 kg zsír).</>}</p>
            </div>
          )}
          <div style={{ height: 10 }} />
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Append sheet + tile CSS to `prototype.css`**

Append at the end of `frontend/src/styles/prototype.css` (all colors via tokens):

```css
/* ── Energy-breakdown sheet (mezo-hobb) ────────────────────────────────── */
.eqbar { display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;
  background:var(--surface-1); border:1px solid var(--card-border); border-radius:16px; padding:12px 14px; margin:12px 0 14px; }
.eqbar .t { text-align:center; }
.eqbar .t .k { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; color:var(--faint); }
.eqbar .t .v { font-family:var(--ff-display); font-weight:800; font-size:16px; margin-top:2px; font-variant-numeric:tabular-nums; }
.eqbar .t.base .v { color:var(--sage-deep); } .eqbar .t.move .v { color:var(--amber-deep); } .eqbar .t.def .v { color:var(--coral-deep); }
.eqbar .t.res .v { color:var(--text-primary); font-size:19px; }
.eqbar .op { font-family:var(--ff-display); color:var(--faint); font-weight:700; }

.seg { background:var(--surface-1); border:1px solid var(--card-border); border-radius:16px; margin-bottom:10px; padding:13px 15px; }
.seg.hl { box-shadow:0 0 0 2px var(--sage); }
.seg .sh { display:flex; align-items:center; gap:9px; }
.seg .sdot { width:10px; height:10px; border-radius:3px; }
.seg .stit { font-weight:800; font-size:13.5px; }
.seg .samt { margin-left:auto; font-family:var(--ff-display); font-weight:800; font-size:17px; font-variant-numeric:tabular-nums; }
.seg .why { font-size:12.5px; color:var(--text-primary); line-height:1.5; margin:10px 0 0; }
.dot-sage { background:var(--sage); } .dot-amber { background:var(--amber); } .dot-coral { background:var(--coral); }
.txt-sage { color:var(--sage-deep); } .txt-amber { color:var(--amber-deep); } .txt-coral { color:var(--coral-deep); }

.btiles { display:flex; flex-wrap:wrap; align-items:stretch; gap:8px; margin:11px 0 4px; }
.btile { flex:1 1 96px; min-width:96px; border-radius:14px; padding:10px 12px; display:flex; flex-direction:column; gap:3px; background:var(--warm); }
.btile.sage { background:var(--wash-sage); } .btile.amber { background:var(--wash-amber); } .btile.coral { background:var(--warm); }
.btile .thd { display:flex; align-items:center; gap:6px; }
.btile .emo { font-size:14px; line-height:1; }
.btile .nm { font-size:11px; font-weight:800; }
.btile.sage .nm { color:var(--sage-deep); } .btile.amber .nm { color:var(--amber-deep); } .btile.coral .nm { color:var(--coral-deep); }
.btile .sub { font-size:10px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--faint); }
.btile .val { font-family:var(--ff-display); font-weight:800; font-size:19px; font-variant-numeric:tabular-nums; margin-top:1px; }
.btile.sage .val { color:var(--sage-deep); } .btile.amber .val { color:var(--amber-deep); } .btile.coral .val { color:var(--coral-deep); }
.btile .val .u { font-size:10px; font-weight:700; color:var(--sub); margin-left:3px; }
.btile.result { background:transparent; border:1.5px dashed var(--line); justify-content:center; }
.btile.result .val { color:var(--text-primary); font-size:21px; }
.btiles .op { align-self:center; font-family:var(--ff-display); font-size:17px; font-weight:700; color:var(--faint); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/sheets/EnergyBreakdownSheet.tsx frontend/src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(fuel): presentational EnergyBreakdownSheet + tile CSS (mezo-hobb)"
```

---

### Task 2: Fuel adapter `buildEnergyBreakdown` + expose from `useFuelTimeline`

**Files:**
- Create: `frontend/src/features/fuel/logic/buildEnergyBreakdown.ts`
- Test: `frontend/src/features/fuel/logic/buildEnergyBreakdown.test.ts`
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (expose `blocks`, `weightKg`, `segment`, and a built `energyBreakdown`)

**Interfaces:**
- Consumes: `EnergyBreakdown` type (Task 1); `blockKcal`, `PlannerBlock` from `@/features/fuel/logic/buildDayPlan`.
- Produces:
  ```ts
  export function buildEnergyBreakdown(input: {
    energy: { base: number; activity: number; balance: number; target: number }
    blocks: PlannerBlock[]
    weightKg: number
    tdeeBootstrap: { bmr: number; neat: number; formula: 'KATCH' | 'MSJ' } | null | undefined
    segment: { dailyEnergyBalanceKcal?: number; projectedRateKgPerWk?: number; label?: string; rationale?: string | null } | null
    activityLabel: string
    goalLabel: string
  }): EnergyBreakdown | null
  ```
  `useFuelTimeline` return gains: `blocks: PlannerBlock[]`, `weightKg: number`, `energyBreakdown: EnergyBreakdown | null`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/fuel/logic/buildEnergyBreakdown.test.ts
import { describe, expect, it } from 'vitest'
import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'

const blocks: PlannerBlock[] = [
  { kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' },
  { kind: 'sport', time: '20:00', durationMin: 90, label: 'Röplabda' },
]

describe('buildEnergyBreakdown', () => {
  it('maps plan.energy + blocks + segment into a full three-section breakdown', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, activity: 1290, balance: -869, target: 2693 },
      blocks, weightKg: 86,
      tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: { dailyEnergyBalanceKcal: -869, projectedRateKgPerWk: -0.79, label: 'Nyári cut' },
      activityLabel: 'Ülő', goalLabel: 'Nyári cut',
    })!
    expect(bd.base).toMatchObject({ kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' })
    expect(bd.movement.kcal).toBe(1290)
    expect(bd.movement.isWeeklyAvg).toBe(false)
    expect(bd.movement.blocks?.map(b => b.label)).toEqual(['Gym', 'Röplabda'])
    expect(bd.movement.blocks?.[0].kcal).toBeGreaterThan(0)
    expect(bd.deficit).toMatchObject({ kcal: -869, goalLabel: 'Nyári cut' })
    expect(bd.deficit?.rateKgPerWk).toBeCloseTo(0.79) // absolute rate
    expect(bd.target).toBe(2693)
  })

  it('returns null when there is no tdeeBootstrap (static energy path)', () => {
    expect(buildEnergyBreakdown({
      energy: { base: 2066, activity: 0, balance: 0, target: 2066 },
      blocks: [], weightKg: 0, tdeeBootstrap: null, segment: null, activityLabel: '', goalLabel: '',
    })).toBeNull()
  })

  it('omits the deficit section when balance is zero', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, activity: 1290, balance: 0, target: 3562 },
      blocks, weightKg: 86, tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: null, activityLabel: 'Ülő', goalLabel: 'Nyári cut',
    })!
    expect(bd.deficit).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/fuel/logic/buildEnergyBreakdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// frontend/src/features/fuel/logic/buildEnergyBreakdown.ts
import { blockKcal, type PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

/**
 * Fuel-side adapter: today's dynamic energy (plan.energy) + today's training blocks + the current
 * prescription segment → the EnergyBreakdown the shared sheet renders. Returns null on the static
 * path (no tdeeBootstrap) — there is nothing to explain then.
 */
export function buildEnergyBreakdown(input: {
  energy: { base: number; activity: number; balance: number; target: number }
  blocks: PlannerBlock[]
  weightKg: number
  tdeeBootstrap: { bmr: number; neat: number; formula: 'KATCH' | 'MSJ' } | null | undefined
  segment: { dailyEnergyBalanceKcal?: number; projectedRateKgPerWk?: number; label?: string; rationale?: string | null } | null
  activityLabel: string
  goalLabel: string
}): EnergyBreakdown | null {
  const { energy, blocks, weightKg, tdeeBootstrap: tb, segment, activityLabel, goalLabel } = input
  if (!tb) return null

  const deficit = energy.balance !== 0
    ? {
        kcal: energy.balance,
        rateKgPerWk: Math.abs(segment?.projectedRateKgPerWk ?? (energy.balance * 7) / 7700),
        goalLabel: segment?.label || goalLabel,
        rationale: segment?.rationale ?? undefined,
      }
    : undefined

  return {
    base: { kcal: energy.base, bmr: tb.bmr, neat: tb.neat, neatLabel: activityLabel, formula: tb.formula },
    movement: {
      kcal: energy.activity,
      isWeeklyAvg: false,
      blocks: blocks.map(b => ({
        label: b.label,
        kind: b.kind,
        min: b.durationMin ?? (b.kind === 'run' ? 40 : 60),
        kcal: Math.round(blockKcal(b.kind, b.durationMin, weightKg)),
      })),
    },
    deficit,
    target: energy.target,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/fuel/logic/buildEnergyBreakdown.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Expose `blocks`/`weightKg`/`segment`/`energyBreakdown` from `useFuelTimeline`**

In `frontend/src/data/fuel/timelineHooks.ts`:
1. Add imports at the top with the other imports:
   ```ts
   import { useBiometricProfile } from '@/data/me/biometricHooks'
   import { ACTIVITY_SHORT, type ActivityLevel } from '@/features/me/logic/biometricFields'
   import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
   ```
2. Inside `useFuelTimeline`, after the existing `const { settings } = useFuelSettings()` line, add the profile hook (unconditional, both modes):
   ```ts
   const { profile } = useBiometricProfile()
   ```
3. `currentSegment(...)` is already computed inline in the `budget` call — lift it to a named const so it can be reused:
   ```ts
   const segment = currentSegment(goalResponse, timeline)
   const budget = deriveDailyBudget(segment, fuel.targets, {
     bmr: goalResponse?.tdeeBootstrap?.bmr ?? null,
     neat: goalResponse?.tdeeBootstrap?.neat ?? null,
     weightKg,
     blocks,
   })
   ```
4. After `const plan = buildDayPlan({ … })`, build the breakdown and extend the return:
   ```ts
   const activityLabel = profile?.activityLevel
     ? ACTIVITY_SHORT[profile.activityLevel as ActivityLevel]
     : ''
   const tb = goalResponse?.tdeeBootstrap
   const energyBreakdown = buildEnergyBreakdown({
     energy: plan.energy,
     blocks,
     weightKg,
     tdeeBootstrap: tb ? { bmr: tb.bmr, neat: tb.neat, formula: tb.formula } : null,
     segment,
     activityLabel,
     goalLabel: goal?.title ?? 'Cél',
   })
   return { plan, budget, blocks, weightKg, energyBreakdown, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuel.meals) }
   ```
   (`goal?.title` — if `Goal` has no `title`, use the goal's display name field present on the type; verify with `grep -n "title\|name" frontend/src/data/me/goalApi.ts`. Fall back to `'Cél'`.)

- [ ] **Step 6: Run both-mode timeline tests to verify nothing broke**

Run: `cd frontend && pnpm vitest run src/data/fuel/timelineHooks.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/data/fuel/timelineHooks.test.tsx`
Expected: PASS (existing tests still green with the additive return fields).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/fuel/logic/buildEnergyBreakdown.ts frontend/src/features/fuel/logic/buildEnergyBreakdown.test.ts frontend/src/data/fuel/timelineHooks.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): buildEnergyBreakdown adapter + expose blocks/breakdown from useFuelTimeline (mezo-hobb)"
```

---

### Task 3: Profile adapter `buildTdeeBreakdown` + BiometricCard Variant B restyle + tap-to-open

**Files:**
- Create: `frontend/src/features/me/logic/buildTdeeBreakdown.ts`
- Test: `frontend/src/features/me/logic/buildTdeeBreakdown.test.ts`
- Modify: `frontend/src/features/me/components/BiometricCard.tsx`, `frontend/src/features/me/components/BiometricCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (real `.tdee-split` rule)

**Interfaces:**
- Consumes: `EnergyBreakdown` type (Task 1); `EnergyBreakdownSheet` (Task 1); `ACTIVITY_SHORT`, `neatLabel` from `@/features/me/logic/biometricFields`; `BiometricProfileResponse`.
- Produces: `export function buildTdeeBreakdown(profile: BiometricProfileResponse): EnergyBreakdown | null` (no deficit; movement = weekly avg).

- [ ] **Step 1: Write the failing adapter test**

```ts
// frontend/src/features/me/logic/buildTdeeBreakdown.test.ts
import { describe, expect, it } from 'vitest'
import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'

const profile = {
  sex: 'M', heightCm: 192, birthDate: '1993-01-01', bodyFatPct: 18, activityLevel: 'DESK',
  tdeeBootstrap: { bmr: 1893, neat: 1.2, neatBaselineKcal: 2272, weeklyEatKcalPerDay: 1207, tdee: 3479, formula: 'KATCH', computedAt: '2026-07-27T06:00:00Z' },
} as unknown as BiometricProfileResponse

describe('buildTdeeBreakdown', () => {
  it('maps tdeeBootstrap + activity into a deficit-free weekly-avg breakdown', () => {
    const bd = buildTdeeBreakdown(profile)!
    expect(bd.base).toMatchObject({ kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' })
    expect(bd.movement).toMatchObject({ kcal: 1207, isWeeklyAvg: true })
    expect(bd.movement.blocks).toBeUndefined()
    expect(bd.deficit).toBeUndefined()
    expect(bd.target).toBe(3479)
  })

  it('returns null when tdeeBootstrap is absent', () => {
    expect(buildTdeeBreakdown({ ...profile, tdeeBootstrap: null } as unknown as BiometricProfileResponse)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/me/logic/buildTdeeBreakdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

```ts
// frontend/src/features/me/logic/buildTdeeBreakdown.ts
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'
import { ACTIVITY_SHORT, type ActivityLevel } from '@/features/me/logic/biometricFields'
import type { EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

/**
 * Profile-side adapter: the persisted TDEE bootstrap (weekly model) → an EnergyBreakdown with NO
 * deficit section (the Profile card is about maintenance, not the day's goal). Movement is the
 * weekly-averaged scheduled EAT (weeklyEatKcalPerDay), flagged isWeeklyAvg so the sheet shows the
 * "heti átlag" tile instead of today's per-activity pills. Returns null before the engine has run.
 */
export function buildTdeeBreakdown(profile: BiometricProfileResponse): EnergyBreakdown | null {
  const tb = profile.tdeeBootstrap
  if (!tb) return null
  const label = profile.activityLevel ? ACTIVITY_SHORT[profile.activityLevel as ActivityLevel] : ''
  return {
    base: { kcal: tb.neatBaselineKcal, bmr: tb.bmr, neat: tb.neat, neatLabel: label, formula: tb.formula },
    movement: { kcal: tb.weeklyEatKcalPerDay, isWeeklyAvg: true },
    target: tb.tdee,
  }
}
```

- [ ] **Step 4: Run adapter test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/me/logic/buildTdeeBreakdown.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Restyle BiometricCard (Variant B) + tap-to-open**

In `frontend/src/features/me/components/BiometricCard.tsx`:
1. Add imports:
   ```ts
   import { useState } from 'react'
   import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
   import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
   ```
2. Inside `BiometricCard` (after the `const tdee = profile.tdeeBootstrap` line), add:
   ```ts
   const [breakdownOpen, setBreakdownOpen] = useState(false)
   const breakdown = buildTdeeBreakdown(profile)
   ```
3. Replace the existing `{tdee && ( <div className="tdee tdee-split"> … </div> )}` block with the Variant B markup wrapped in a tap button:
   ```tsx
   {tdee && breakdown && (
     <button type="button" className="tdee-split" onClick={() => setBreakdownOpen(true)} aria-label="Energia-bontás magyarázata">
       <div className="row"><span className="lab"><span className="dot dot-sage" />Alaphő · NEAT</span><span className="amt">{Math.round(tdee.neatBaselineKcal)}</span></div>
       <div className="row"><span className="lab"><span className="dot dot-amber" />Betábl. mozgás</span><span className="amt">+{Math.round(tdee.weeklyEatKcalPerDay)}</span></div>
       <div className="row total"><span className="lab">Fenntartó · {tdee.formula === 'KATCH' ? 'Katch' : 'MSJ'} <span className="infochev">ⓘ</span></span><span className="amt">≈{Math.round(tdee.tdee)} <small>kcal/nap</small></span></div>
     </button>
   )}
   {breakdownOpen && breakdown && (
     <EnergyBreakdownSheet breakdown={breakdown} initial="base" onClose={() => setBreakdownOpen(false)} />
   )}
   ```

- [ ] **Step 6: Add the real `.tdee-split` rule to `prototype.css`**

Append after the existing `.tdee` rules (near line 1542):

```css
/* Alap-TDEE breakdown — Variant B stacked list + emphasized total (mezo-hobb).
   Overrides the horizontal .tdee flex when both classes are present. */
.tdee-split { display:block; width:100%; text-align:left; border-top:1.5px solid var(--line); margin-top:14px; padding-top:12px; cursor:pointer; background:none; }
.tdee-split .row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; }
.tdee-split .lab { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:var(--sub); }
.tdee-split .dot { width:8px; height:8px; border-radius:3px; flex-shrink:0; }
.tdee-split .amt { font-family:var(--ff-display); font-size:16px; font-weight:800; color:var(--ink); font-variant-numeric:tabular-nums; }
.tdee-split .total { border-top:1px dashed var(--line); margin-top:6px; padding-top:10px; }
.tdee-split .total .lab { color:var(--sage-deep); font-weight:800; }
.tdee-split .total .amt { font-size:22px; color:var(--sage-deep); }
.tdee-split .total .amt small { font-size:12px; color:var(--sub); font-weight:700; }
.tdee-split .infochev { color:var(--lav-deep); font-size:12px; font-weight:800; }
```

- [ ] **Step 7: Update BiometricCard test — the breakdown is now a button that opens the sheet**

Add to `frontend/src/features/me/components/BiometricCard.test.tsx` (keep existing assertions; add):

```tsx
import { fireEvent } from '@testing-library/react'
// … within the describe block, a profile fixture that has tdeeBootstrap (reuse the file's existing one):
it('opens the energy-breakdown sheet when the TDEE block is tapped', () => {
  render(<BiometricCard profile={profileWithTdee} onEdit={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Energia-bontás magyarázata'))
  expect(screen.getByText(/Honnan jön/)).toBeInTheDocument()
})
```
(If the file has no `profileWithTdee` fixture, add one shaped like the `buildTdeeBreakdown.test.ts` profile.)

- [ ] **Step 8: Run the me tests (both modes)**

Run: `cd frontend && pnpm vitest run src/features/me/logic/buildTdeeBreakdown.test.ts src/features/me/components/BiometricCard.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/me/logic/buildTdeeBreakdown.ts frontend/src/features/me/logic/buildTdeeBreakdown.test.ts frontend/src/features/me/components/BiometricCard.tsx frontend/src/features/me/components/BiometricCard.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(me): Alap-TDEE Variant B restyle + tap-to-explain sheet (mezo-hobb)"
```

---

### Task 4: Fuel "Mai cél" chips tappable + wire sheet

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`, `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.chip-tap` affordance)

**Interfaces:**
- Consumes: `energyBreakdown` from `useFuelTimeline()` (Task 2); `EnergyBreakdownSheet` + `EnergySection` (Task 1).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` (mock mode renders the new-shape tdeeBootstrap seed, so the chips + breakdown are present):

```tsx
it('opens the energy-breakdown sheet on the Mozgás chip, focused on movement', async () => {
  renderFuelMaiPage() // the file's existing render helper
  fireEvent.click(await screen.findByRole('button', { name: /Mozgás/ }))
  expect(screen.getByText(/Honnan jön/)).toBeInTheDocument()
  expect(document.querySelector('.seg.hl')?.textContent).toMatch(/mozgás/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/fuel/pages/FuelMaiPage.test.tsx -t "Mozgás chip"`
Expected: FAIL — chip is not a button / sheet not found.

- [ ] **Step 3: Wire the chips**

In `frontend/src/features/fuel/pages/FuelMaiPage.tsx`:
1. Pull `energyBreakdown` from the timeline hook and add sheet state:
   ```ts
   const { plan, budget, energyBreakdown, getScoredMeal } = useFuelTimeline()
   const [energyOpen, setEnergyOpen] = useState<import('@/features/fuel/sheets/EnergyBreakdownSheet').EnergySection | null>(null)
   ```
   (add `EnergyBreakdownSheet` to the imports: `import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'`.)
2. Replace the three static chip `<span>`s in the `!staticEnergy` block with buttons (only interactive when a breakdown exists):
   ```tsx
   <span className="chx chip-base chip-tap" role="button" tabIndex={0} onClick={() => energyBreakdown && setEnergyOpen('base')}>Alaphő {plan.energy.base}</span>
   <span className="chx chip-move chip-tap" role="button" tabIndex={0} onClick={() => energyBreakdown && setEnergyOpen('movement')}>Mozgás +{plan.energy.activity}</span>
   <span className="chx chip-def chip-tap" role="button" tabIndex={0} onClick={() => energyBreakdown && setEnergyOpen('deficit')}>{plan.energy.balance < 0 ? `Deficit ${Math.abs(plan.energy.balance)}` : plan.energy.balance > 0 ? `Felesleg +${plan.energy.balance}` : 'Egyensúly'}</span>
   ```
   Keep the existing token background/color inline styles on each chip.
3. Mount the sheet near the other sheets at the bottom:
   ```tsx
   {energyOpen && energyBreakdown && (
     <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
   )}
   ```

- [ ] **Step 4: Add the `.chip-tap` affordance CSS**

Append to `prototype.css`:

```css
.chip-tap { position:relative; padding-right:24px; cursor:pointer; }
.chip-tap::after { content:"i"; position:absolute; right:7px; top:50%; transform:translateY(-50%);
  width:14px; height:14px; border-radius:50%; font-size:9px; font-weight:800; font-style:italic;
  display:flex; align-items:center; justify-content:center; background:var(--surface-glass); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/fuel/pages/FuelMaiPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(fuel): tappable Mai cél chips open the energy-breakdown sheet (mezo-hobb)"
```

---

### Task 5: Full gate, runtime verify, docs

**Files:**
- Modify: `docs/features/fuel.md` (and the me/profile feature doc if one exists) — §4/§5 for the sheet + interaction.

- [ ] **Step 1: Full both-mode gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build succeeds; both test runs green. Fix any type or test fallout before continuing.

- [ ] **Step 2: Runtime verify in the app (mock mode)**

Per the `verify` skill: `cd frontend && VITE_USE_MOCK=true pnpm dev` (port 5180), then drive the PWA:
- Profile (Én) tab → Biometria card shows the Variant B stacked breakdown; tap it → sheet opens on **Alaphő**, base tiles + weekly-avg movement, no deficit section.
- Fuel (Mai) tab → tap each of Alaphő / Mozgás / Deficit chip → sheet opens focused on that section; Mozgás shows per-activity pills for today's blocks.
Capture a screenshot of each for the PR.

- [ ] **Step 3: Update feature docs**

Edit `docs/features/fuel.md`: in §4 (views/flows) add the `EnergyBreakdownSheet` opened from the Mai cél chips; in §5 (integration) note the cross-feature reuse by `me`'s BiometricCard and the `buildEnergyBreakdown`/`buildTdeeBreakdown` adapters + `useFuelTimeline.energyBreakdown`. If a profile/me feature doc exists, note the tappable Alap-TDEE card there too. Then:

Run: `node scripts/lint-docs.mjs`
Expected: no new staleness/broken-link/orphan errors for the touched docs.

- [ ] **Step 4: Commit docs**

```bash
git add docs/features/fuel.md
git -c core.hooksPath=/dev/null commit -m "docs(fuel): energy-breakdown sheet + Profile tap-to-explain (mezo-hobb)"
```

- [ ] **Step 5: Push + self-PR (CI gate)**

```bash
git push -u origin feat/fuel-energy-breakdown
gh pr create --fill --title "feat(fuel): energy-breakdown explanation sheet + Profile Alap-TDEE restyle (mezo-hobb)"
```
Wait for CI green, then land per the worktree landing convention (`gh pr merge --merge` if the main checkout is busy), and close mezo-hobb from the main checkout.

---

## Self-Review

**Spec coverage:** §3 model → Task 1 type. §4.1 sheet → Task 1. §4.2 adapters → Tasks 2 (fuel) + 3 (me). §5 wiring: Profile → Task 3, Fuel → Task 4, data plumbing (`useFuelTimeline` blocks/breakdown) → Task 2. §6 CSS → Task 1 (sheet/tiles) + Task 3 (`.tdee-split`) + Task 4 (`.chip-tap`). §7 tests → each task's tests + Task 5 gate. §8 verify/docs → Task 5. All covered.

**Placeholder scan:** No TBD/TODO; every code step has real code; test assertions are concrete. The two verify-at-implementation notes (goal title field; existing test render helper/fixture names) are explicit grep/confirm instructions, not hand-waves.

**Type consistency:** `EnergyBreakdown`/`EnergySection`/`EnergyBlock` defined in Task 1 and imported identically in Tasks 2–4. `buildEnergyBreakdown` (Task 2) and `buildTdeeBreakdown` (Task 3) both return `EnergyBreakdown | null`. `useFuelTimeline` return extension (`blocks`/`weightKg`/`energyBreakdown`) consumed in Task 4. Deficit `kcal` is signed (negative) throughout; `rateKgPerWk` is absolute.
