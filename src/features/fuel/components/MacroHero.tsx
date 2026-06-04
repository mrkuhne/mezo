import type { MacroSet } from '@/data/types'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Icon } from '@/components/ui/Icon'

const pct = (a: number, b: number) => Math.min(100, (a / b) * 100)

export function MacroHero({ targets, consumed }: { targets: MacroSet; consumed: MacroSet }) {
  const kcalPct = (consumed.kcal / targets.kcal) * 100
  return (
    <div className="card notch-12" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 44, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {consumed.kcal}
          </div>
          <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            / {targets.kcal} kcal · {kcalPct.toFixed(0)}% target
          </span>
          <span className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>
            {targets.kcal - consumed.kcal} kcal hátra
          </span>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <ScoreRing pct={consumed.kcal / targets.kcal} size={56} />
        </div>
      </div>

      <div className="macro-bar mt-lg">
        <div className="macro-cell notch-4">
          <div className="name">Protein</div>
          <div className="val">{consumed.p}<span className="unit">/{targets.p}g</span></div>
          <ProgressBar className="mt-sm" value={pct(consumed.p, targets.p)} tone="glow" />
        </div>
        <div className="macro-cell notch-4">
          <div className="name">Carbs</div>
          <div className="val">{consumed.c}<span className="unit">/{targets.c}g</span></div>
          <ProgressBar className="mt-sm" value={pct(consumed.c, targets.c)} color="var(--warning)" glow />
        </div>
        <div className="macro-cell notch-4">
          <div className="name">Fat</div>
          <div className="val">{consumed.f}<span className="unit">/{targets.f}g</span></div>
          <ProgressBar className="mt-sm" value={pct(consumed.f, targets.f)} color="var(--cat-preference)" glow />
        </div>
      </div>

      <div className="row mt-lg gap-md" style={{ justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
        <div className="row gap-sm" style={{ flexShrink: 0 }}>
          <Icon name="drop" size={14} color="var(--info)" />
          <span className="label-mono" style={{ fontSize: 9 }}>Víz</span>
        </div>
        <div className="col" style={{ flex: 1, alignItems: 'stretch' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{consumed.water}/{targets.water}ml</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--info)' }}>{((consumed.water / targets.water) * 100).toFixed(0)}%</span>
          </div>
          <ProgressBar className="mt-xs" value={pct(consumed.water, targets.water)} color="var(--info)" />
        </div>
      </div>
    </div>
  )
}
