import type { MacroSet } from '@/data/types'
import { ScoreRing } from '@/shared/ui/ScoreRing'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { Icon } from '@/shared/ui/Icon'
import { pct } from '@/shared/lib/pct'

// `pct` guards 0/0 → 0: real mode renders a ZERO day during the cold-load window (no
// static fallback in real mode), so a 0/0 percent must read as a benign 0%, never NaN.

export function MacroHero({ targets, consumed, eyebrow, onLogWater }: { targets: MacroSet; consumed: MacroSet; eyebrow?: string; onLogWater?: (amountMl: number) => void }) {
  const kcalPct = pct(consumed.kcal, targets.kcal)
  return (
    <div className="card notch-12" style={{ padding: 18 }}>
      {eyebrow && <span className="eyebrow brand">{eyebrow}</span>}
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
          <ScoreRing pct={pct(consumed.kcal, targets.kcal) / 100} size={56} />
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
          <ProgressBar className="mt-sm" value={pct(consumed.c, targets.c)} color="var(--warning)" />
        </div>
        <div className="macro-cell notch-4">
          <div className="name">Fat</div>
          <div className="val">{consumed.f}<span className="unit">/{targets.f}g</span></div>
          <ProgressBar className="mt-sm" value={pct(consumed.f, targets.f)} color="var(--cat-preference)" />
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
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--info)' }}>{pct(consumed.water, targets.water).toFixed(0)}%</span>
          </div>
          <ProgressBar className="mt-xs" value={pct(consumed.water, targets.water)} color="var(--info)" />
        </div>
        {onLogWater && (
          <div className="row gap-xs">
            {[250, 500].map(ml => (
              <button
                key={ml}
                type="button"
                className="chip notch-4"
                aria-label={`Víz +${ml} ml`}
                style={{ fontSize: 9, padding: '4px 8px' }}
                onClick={() => onLogWater(ml)}
              >
                +{ml}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
