// ============================================================
// Mezo · DerivationSteps — „Honnan a sáv · levezetés", extracted from
// VolumeBar's 01/02/03 derivation body (mesocycle pages v2, mezo-d20.15
// Task 4) and restyled as the prototype's #page-muscle 4-step numbered
// timeline: 01 Baseline (RP tábla) → 02 Fókusz-sáv (the tier's own ramp) →
// 03 Rád szabva (VolumeProfile.source.adjustments, honestly empty when the
// engine made none) → 04 Eredő (the arc's own week-by-week planned series).
// Data source is unchanged (VolumeProfile.source) — only the layout moved;
// VolumeBar.tsx itself is untouched and keeps serving the builder's
// provenance list. `onOverride` mirrors VolumeBar's own Felülír chip, which
// has never had a real path (no onClick there either) — same inert default.
// ============================================================
import type { MuscleTier, VolumeProfile } from '@/data/types'
import { Icon, type IconName } from '@/shared/ui/Icon'

const TIER_LABEL: Record<MuscleTier, string> = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' }

function adjustmentIcon(kind: string): IconName {
  switch (kind) {
    case 'niggle': return 'warning'
    case 'pattern': return 'sparkle'
    case 'recovery': return 'today'
    case 'sport-cross': return 'train'
    default: return 'tool'
  }
}

function deltaText(delta: Partial<Record<'mev' | 'mav' | 'mrv', number>>): string {
  return Object.entries(delta).map(([k, v]) => `${k.toUpperCase()} ${v! > 0 ? '+' : ''}${v}`).join(' · ')
}

export interface DerivationStepsProps {
  profile: VolumeProfile
  tier: MuscleTier
  ceiling: number
  weekOneValue: number
  /** through the current week, in order — the LAST entry is „most". */
  series: { week: number; planned: number }[]
  /** how many sets the Monday rollover adds — already clamped to the ceiling by
   *  `nextStep`/`MuscleWeekTile.step`; 0 renders as a plain '=' hold. */
  step: number
  onOverride?: () => void
}

export function DerivationSteps({ profile, tier, ceiling, weekOneValue, series, step, onOverride }: DerivationStepsProps) {
  const { source } = profile
  const confidencePct = Math.round(source.confidence * 100)

  return (
    <div className="col">
      <div className="mz-dsteps">
        {/* 01 · Baseline */}
        <div className="mz-dstep">
          <span className="mz-dnum mz-dnum-baseline" aria-hidden="true">1</span>
          <div className="mz-grow">
            <div className="mz-dt">Baseline · RP tábla</div>
            <div className="mz-dcells">
              <div className="mz-dcell"><b>{source.baseline.mev}</b><small>MEV</small></div>
              <div className="mz-dcell"><b>{source.baseline.mav}</b><small>MAV</small></div>
              <div className="mz-dcell"><b>{source.baseline.mrv}</b><small>MRV</small></div>
            </div>
          </div>
        </div>

        {/* 02 · Fókusz-sáv */}
        <div className="mz-dstep">
          <span className="mz-dnum" style={{ background: 'var(--coral)' }} aria-hidden="true">2</span>
          <div className="mz-grow">
            <div className="mz-dt">Fókusz-sáv · {TIER_LABEL[tier]}</div>
            {tier === 'maintain' ? (
              <div className="mz-dcells">
                <div className="mz-dcell"><b>{profile.mev}</b><small>tart</small></div>
                <div className="mz-dcell"><b>0</b><small>/ hét</small></div>
              </div>
            ) : (
              <div className="mz-dcells">
                <div className="mz-dcell"><b>{weekOneValue}</b><small>indul</small></div>
                <div className="mz-dcell"><b>{ceiling}</b><small>plafon</small></div>
                <div className="mz-dcell"><b>{step > 0 ? `+${step}` : '='}</b><small>/ hét</small></div>
              </div>
            )}
          </div>
        </div>

        {/* 03 · Rád szabva */}
        <div className="mz-dstep">
          <span className="mz-dnum mz-dnum-custom" aria-hidden="true">3</span>
          <div className="mz-grow">
            <div className="mz-dt">Rád szabva</div>
            {source.adjustments.length === 0 ? (
              <div className="mz-mut" style={{ fontSize: 9, marginTop: 4 }}>nincs igazítás — a baseline érvényes</div>
            ) : (
              source.adjustments.map((a, i) => (
                <div className="mz-dadj" key={i}>
                  <Icon name={adjustmentIcon(a.kind)} size={11} color={a.warning ? 'var(--warning)' : 'var(--coral)'} />
                  <span className="mz-tx">{a.label}</span>
                  <span
                    className="mz-eff"
                    style={{
                      background: a.warning ? 'var(--mz-cell-gold-bg)' : 'var(--mz-cell-sage-bg)',
                      color: a.warning ? 'var(--mz-cell-gold-ink)' : 'var(--mz-cell-sage-ink)',
                    }}
                  >
                    {deltaText(a.delta)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 04 · Eredő */}
        <div className="mz-dstep" style={{ paddingBottom: 4 }}>
          <span className="mz-dnum mz-dnum-final" aria-hidden="true">4</span>
          <div className="mz-grow">
            <div className="mz-dt">Eredő · a blokkban</div>
            <div className="mz-dcells">
              {series.map((s, i) => (
                <div className={i === series.length - 1 ? 'mz-dcell hot' : 'mz-dcell'} key={s.week}>
                  <b>{s.planned}</b>
                  <small>W{s.week}{i === series.length - 1 ? ' · most' : ''}</small>
                </div>
              ))}
              <div className="mz-dcell hot"><b>{step > 0 ? `+${step}` : '='}</b><small>hétfőn</small></div>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="mz-mut" style={{ fontSize: 9 }}>Mennyire biztos a sáv · {confidencePct}%</span>
        <button
          type="button"
          className="chip"
          style={{ fontSize: 9, padding: '3px 10px' }}
          disabled={!onOverride}
          title={onOverride ? undefined : 'hamarosan'}
          onClick={onOverride}
        >
          <Icon name="tool" size={10} /> Felülír
        </button>
      </div>
      <div className="mz-confbar"><div style={{ width: `${confidencePct}%` }} /></div>
    </div>
  )
}
