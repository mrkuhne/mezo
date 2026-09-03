// ============================================================
// Mezo · WeightPage — the Én tab's Súly tile opened into its own page
// (mezo-d20.6.3). Source of truth: en-body.html #page-suly (p-sky tone):
// page-head with the "＋ Súly naplózása" CTA, hero (goal delta + start→
// latest, WeightHero), stat strip (jelenleg · 7-nap/hét · ETA), period
// chips, trend chart (actual+MA line, dashed plan line, ±1 kg tolerance
// band — WeightTrendChart, unchanged behavior), weekly history tiles
// (WeeklyWeightCard: delta pill + direction, sage/amber — NEVER red)
// with the "Régebbi hetek" pager. WeightLogSheet stays exactly as-is;
// saving flows back through useWeight()'s cache, updating hero + tiles.
// ============================================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useGoal, useWeight } from '@/data/hooks'
import { WeightHero, statRateColor } from '@/features/me/components/WeightHero'
import { WeightTrendChart } from '@/features/me/components/WeightTrendChart'
import { WeeklyWeightCard } from '@/features/me/components/WeeklyWeightCard'
import { groupByWeek, dayRows, latestValue, etaWeeks, fmtSigned, type Period } from '@/features/me/logic/weightStats'
import { WeightLogSheet } from '@/features/me/sheets/WeightLogSheet'

const PERIODS: Period[] = ['7d', '30d', '90d', '1y']
const WEEK_STEP = 6

export function WeightPage() {
  const navigate = useNavigate()
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { goal, goalResponse } = useGoal()
  const [period, setPeriod] = useState<Period>('30d')
  const [logOpen, setLogOpen] = useState(false)
  // undefined = "use default (newest week expanded)"; a concrete iso or null after the first toggle.
  const [expandedIso, setExpandedIso] = useState<string | null | undefined>(undefined)
  const [visibleWeeks, setVisibleWeeks] = useState(WEEK_STEP)

  const weeks = useMemo(() => groupByWeek(weightLog), [weightLog])
  const effectiveExpanded = expandedIso === undefined ? (weeks[0]?.startIso ?? null) : expandedIso
  const latest = latestValue(weightLog)
  const rate = weightTrends.last7d.weeklyRate
  const eta = latest !== null ? etaWeeks(latest, goal?.targetWeight ?? null, rate) : null

  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate(-1)} label="‹ Én">
        <button type="button" className="mz-pgact" onClick={() => setLogOpen(true)}>
          ＋ Súly naplózása
        </button>
      </PageHead>
      <EntranceGroup>
        <WeightHero log={weightLog} weightTrends={weightTrends} goal={goal} />

        <PageBody>
          <StatStrip className="rise">
            <StatCell value={latest === null ? '—' : latest.toFixed(1)} label="Jelenleg" />
            <StatCell value={<span style={{ color: statRateColor(rate, goal?.kind) }}>{fmtSigned(rate)}</span>} label="7-nap/hét" />
            <StatCell value={eta === null ? '—' : `${eta}h`} label="ETA" />
          </StatStrip>

          <div className="row gap-xs rise" style={{ '--d': '40ms', marginTop: 12, marginBottom: 10 } as React.CSSProperties}>
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn('chip tapchip', period === p && 'brand')}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <WeightTrendChart log={weightLog} goalResponse={goalResponse} period={period} />
          </div>

          <div className="wt-lsec rise" style={{ '--d': '120ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Heti előzmény</span>
            {weeks.length > 0 && (
              <span className="wt-cnt">{Math.min(visibleWeeks, weeks.length)} / {weeks.length} hét</span>
            )}
          </div>
          {weeks.slice(0, visibleWeeks).map((week, i) => (
            <WeeklyWeightCard
              key={week.startIso}
              week={week}
              dayRows={effectiveExpanded === week.startIso ? dayRows(weightLog, week) : []}
              expanded={effectiveExpanded === week.startIso}
              onToggle={() => setExpandedIso(effectiveExpanded === week.startIso ? null : week.startIso)}
              goalKind={goal?.kind}
              delayMs={150 + i * 40}
            />
          ))}
          {weeks.length > visibleWeeks && (
            <button type="button" className="mzp-new rise" style={{ '--d': '260ms' } as React.CSSProperties}
              onClick={() => setVisibleWeeks(v => v + WEEK_STEP)}>
              Régebbi hetek <Icon name="chevron-down" size={12} />
            </button>
          )}
        </PageBody>
      </EntranceGroup>

      {logOpen && <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest ?? 0} />}
    </MozaikPage>
  )
}
