import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useGoal, useWeight } from '@/data/hooks'
import { WeightChart } from '../components/WeightChart'
import { TrendCell } from '../components/TrendCell'
import { WeightLogSheet } from '../WeightLogSheet'

type Period = '7d' | '30d' | 'all'
const PERIODS: Period[] = ['7d', '30d', 'all']

export function WeightView() {
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { goal } = useGoal() // chart reference lines (start/target) + current-weight fallback
  const [period, setPeriod] = useState<Period>('30d')
  const [logOpen, setLogOpen] = useState(false)

  // goal may be null in real mode when no goal is set up yet (mezo-72d). Fall back
  // to the latest logged weight for the hero number and the chart reference lines.
  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : (goal?.currentWeight ?? 0)
  const chartStart = goal?.startWeight ?? latest
  const chartTarget = goal?.targetWeight ?? latest

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Súly</Eyebrow>
          <PageTitle className="mt-sm">Napi súly</PageTitle>
        </div>
      </div>

      {/* Daily-log hero — latest number + naplózás CTA (opens WeightLogSheet) */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="card notch-12" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 52, fontWeight: 600, color: 'var(--brand-glow)', lineHeight: 1, textShadow: '0 0 24px rgba(94, 234, 212, 0.4)' }}>
              {latest.toFixed(1)}
            </span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>kg</span>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
            <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)' }}>
              {weightTrends.last7d.weeklyRate} kg/hét · 7-napos átlag {weightTrends.last7d.avg}
            </span>
          </div>
          <button className="cta-primary notch-8" onClick={() => setLogOpen(true)} style={{ width: '100%', marginTop: 14, padding: 12, justifyContent: 'center' }}>
            <Icon name="plus" size={14} /> Súly naplózása
          </button>
        </div>
      </div>

      {/* Trend chart */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Súly · trend</Eyebrow>
          <div className="row gap-xs">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={'chip' + (period === p ? ' brand' : '')} style={{ fontSize: 9, padding: '3px 8px' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <WeightChart entries={weightLog} startWeight={chartStart} targetWeight={chartTarget} period={period} />
      </div>

      {/* Trend cells — only the real EWMA figures: the weekly rate (7d + 4w) and
          the 7-day trend weight. The 4-week average is not engine-derived, so it
          is omitted rather than shown as a mock value. */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row gap-sm">
          <TrendCell label="7 nap" rate={weightTrends.last7d.weeklyRate} avg={weightTrends.last7d.avg} />
          <TrendCell label="4 hét" rate={weightTrends.last4w.weeklyRate} />
        </div>
      </div>

      {logOpen && (
        <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest} />
      )}
    </>
  )
}
