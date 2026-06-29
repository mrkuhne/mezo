import { useMemo, useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useGoal, useWeight } from '@/data/hooks'
import { WeightHero } from '../components/WeightHero'
import { WeightTrendChart } from '../components/WeightTrendChart'
import { WeeklyWeightCard } from '../components/WeeklyWeightCard'
import { groupByWeek, dayRows, type Period } from '../components/weightStats'
import { WeightLogSheet } from '../WeightLogSheet'

const PERIODS: Period[] = ['7d', '30d', '90d', '1y']
const WEEK_STEP = 6

export function WeightView() {
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { goal, goalResponse } = useGoal()
  const [period, setPeriod] = useState<Period>('30d')
  const [logOpen, setLogOpen] = useState(false)
  // undefined = "use default (newest week expanded)"; a concrete iso or null after the first toggle.
  const [expandedIso, setExpandedIso] = useState<string | null | undefined>(undefined)
  const [visibleWeeks, setVisibleWeeks] = useState(WEEK_STEP)

  const weeks = useMemo(() => groupByWeek(weightLog), [weightLog])
  const effectiveExpanded = expandedIso === undefined ? (weeks[0]?.startIso ?? null) : expandedIso
  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : (goal?.currentWeight ?? 0)

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Súly</Eyebrow>
          <PageTitle className="mt-sm">Napi súly</PageTitle>
        </div>
      </div>

      <WeightHero log={weightLog} weightTrends={weightTrends} goal={goal} onLog={() => setLogOpen(true)} />

      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Súly · trend</Eyebrow>
          <div className="row gap-xs">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={'chip' + (period === p ? ' brand' : '')} style={{ fontSize: 9, padding: '3px 8px' }}>{p}</button>
            ))}
          </div>
        </div>
        <WeightTrendChart log={weightLog} goalResponse={goalResponse} period={period} />
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Eyebrow>Heti előzmény</Eyebrow>
          {weeks.length > 0 && <span className="label-mono">{Math.min(visibleWeeks, weeks.length)} / {weeks.length} hét</span>}
        </div>
        {weeks.slice(0, visibleWeeks).map(week => (
          <WeeklyWeightCard
            key={week.startIso}
            week={week}
            dayRows={effectiveExpanded === week.startIso ? dayRows(weightLog, week) : []}
            expanded={effectiveExpanded === week.startIso}
            onToggle={() => setExpandedIso(effectiveExpanded === week.startIso ? null : week.startIso)}
            goalKind={goal?.kind}
          />
        ))}
        {weeks.length > visibleWeeks && (
          <button className="chip" onClick={() => setVisibleWeeks(v => v + WEEK_STEP)} style={{ width: '100%', justifyContent: 'center', padding: 11, marginTop: 2 }}>
            Régebbi hetek <Icon name="chevron-down" size={12} />
          </button>
        )}
      </div>

      {logOpen && <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest} />}
    </>
  )
}
