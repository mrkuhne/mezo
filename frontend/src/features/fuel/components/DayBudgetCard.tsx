import { pct } from '@/shared/lib/pct'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'

// The Mai day-status card (mezo-rrtj). Replaces BOTH the old "Mai cél" card and the KcalGauge —
// they printed the same number twice (budget.kcal === plan.energy.target). One hero number here,
// and it is the REMAINING kcal, because that is what the next decision is made from. The three
// energy chips keep the old card's EnergyBreakdownSheet wiring; water became the 4th macro row.
const WATER_STEPS = [250, 500] as const

function balanceLabel(balance: number): string {
  if (balance < 0) return `Deficit ${Math.abs(balance)}`
  if (balance > 0) return `Felesleg +${balance}`
  return 'Egyensúly'
}

export function DayBudgetCard({
  consumed,
  budget,
  waterTarget,
  energy,
  staticEnergy,
  loggedKcals,
  doneCount,
  totalCount,
  nowFrac,
  onOpenEnergy,
  onLogWater,
}: {
  consumed: { kcal: number; p: number; c: number; f: number; water: number }
  budget: { kcal: number; p: number; c: number; f: number }
  waterTarget: number
  energy: { base: number; activity: number; balance: number; target: number }
  staticEnergy: boolean
  loggedKcals: number[]
  doneCount: number
  totalCount: number
  nowFrac: number | null
  onOpenEnergy: (section: EnergySection) => void
  onLogWater: (ml: number) => void
}) {
  const remaining = Math.max(0, budget.kcal - consumed.kcal)
  // Uncapped by design: an overshoot day must legibly show e.g. 110%, unlike bar widths below.
  const consumedPct = budget.kcal > 0 ? Math.round((consumed.kcal / budget.kcal) * 100) : 0
  // Segment widths share ONE denominator with the ghost remainder, so the bar can never overflow.
  const segWidth = (kcal: number) => `${Math.min(100, pct(kcal, budget.kcal))}%`

  return (
    <div className="daybudget">
      <div className="r1">
        <span className="n">{remaining}</span>
        <span className="of">kcal hátra · {consumed.kcal} / {budget.kcal}</span>
        <span className="pc">{consumedPct}%</span>
      </div>
      <div className="wins">{doneCount}/{totalCount} ablak logolva</div>
      <div className="dayseg">
        {loggedKcals.map((kcal, i) => (
          <i key={i} style={{ width: segWidth(kcal), background: i % 2 === 0 ? 'var(--sage)' : 'var(--sage-deep)' }} />
        ))}
        <span className="ghost" />
        {nowFrac != null && <span className="mark" style={{ left: `${Math.min(100, Math.max(0, nowFrac * 100))}%` }} />}
      </div>

      {!staticEnergy && (
        <div className="brk">
          <div className="cap2">honnan a {energy.target} kcal</div>
          <div className="chips">
            <button type="button" className="ebchip base" onClick={() => onOpenEnergy('base')}>
              Alaphő <b>{energy.base}</b>
            </button>
            <button type="button" className="ebchip move" onClick={() => onOpenEnergy('movement')}>
              Mozgás <b>+{energy.activity}</b>
            </button>
            <button type="button" className="ebchip def" onClick={() => onOpenEnergy('deficit')}>
              {balanceLabel(energy.balance)}
            </button>
          </div>
        </div>
      )}

      <div className="macror">
        <div className="mac">
          <span className="k">Fehérje</span>
          <span className="bar"><i style={{ width: pct(consumed.p, budget.p) + '%', background: 'var(--sage)' }} /></span>
          <span className="v">{consumed.p} <em>/ {budget.p} g</em></span>
        </div>
        <div className="mac">
          <span className="k">Szénhidrát</span>
          <span className="bar"><i style={{ width: pct(consumed.c, budget.c) + '%', background: 'var(--amber)' }} /></span>
          <span className="v">{consumed.c} <em>/ {budget.c} g</em></span>
        </div>
        <div className="mac">
          <span className="k">Zsír</span>
          <span className="bar"><i style={{ width: pct(consumed.f, budget.f) + '%', background: 'var(--lav)' }} /></span>
          <span className="v">{consumed.f} <em>/ {budget.f} g</em></span>
        </div>
        <div className="mac water">
          <span className="k">Víz</span>
          <span className="bar"><i style={{ width: pct(consumed.water, waterTarget) + '%', background: 'var(--sky)' }} /></span>
          <span className="wq">
            {WATER_STEPS.map(ml => (
              <button key={ml} type="button" aria-label={`Víz +${ml} ml`} onClick={() => onLogWater(ml)}>
                +{ml}
              </button>
            ))}
          </span>
          <span className="v">{consumed.water} <em>/ {waterTarget} ml</em></span>
        </div>
      </div>
    </div>
  )
}
