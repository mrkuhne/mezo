// Weekly review (mezo-p2tr) — the "Heti" tab under Én: a 7-day week hero + stat strip + score
// bars + expandable day grid, reading the `/api/me/week/{start}` rollup (Task 3's useMeWeek).
// The browsed week lives in `?start=` (a shareable/reloadable Monday, the ChatPage `?c=` idiom) —
// an invalid, non-Monday or absent value always falls back to the CURRENT week, never a stale one.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMeWeek } from '@/data/hooks'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { localDateString } from '@/shared/lib/dates'
import { prevMonday, nextMonday, isCurrentWeek } from '@/features/me/logic/weekNav'
import { WeekDayCard } from '@/features/me/components/WeekDayCard'
import { WeekScoreBars } from '@/features/me/components/WeekScoreBars'
import { StatStrip } from '@/shared/ui/StatStrip'
import type { MeWeekAggregates } from '@/data/me/meWeek'

/** `?start=` -> a real ISO Monday, or the current week's when absent/invalid/not-a-Monday. */
function resolveStart(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && dt.getDay() === 1) return raw
  }
  return mondayIso()
}

function fmtSleepH(min: number | null | undefined): string {
  if (min == null) return '—'
  return `${Math.floor(min / 60)}ó ${min % 60}p`
}

function fmtWeightRate(kgPerWeek: number | null | undefined): string {
  if (kgPerWeek == null) return '—'
  const sign = kgPerWeek > 0 ? '+' : kgPerWeek < 0 ? '−' : '±'
  return `${sign}${Math.abs(kgPerWeek).toFixed(2)} kg/hét`
}

function weeklyStatCells(weekly: MeWeekAggregates) {
  return [
    { label: 'Kcal átlag', value: weekly.avgKcal != null ? String(Math.round(weekly.avgKcal)) : '—', unit: weekly.avgKcal != null ? 'kcal' : undefined },
    { label: 'Fehérje', value: weekly.avgProteinG != null ? String(Math.round(weekly.avgProteinG)) : '—', unit: weekly.avgProteinG != null ? 'g' : undefined },
    { label: 'Alvás', value: fmtSleepH(weekly.avgSleepMin) },
    { label: 'Check-in', value: weekly.checkinRatio != null ? String(Math.round(weekly.checkinRatio * 100)) : '—', unit: weekly.checkinRatio != null ? '%' : undefined },
    { label: 'Súly trend', value: fmtWeightRate(weekly.weightWeeklyRateKg) },
    { label: 'XP', value: weekly.totalXp != null ? String(weekly.totalXp) : '—' },
  ]
}

/** The week's big-number hero — the old WeeklyPage's exact treatment, including its
 *  „tanulom" null-state copy verbatim (no data yet, never a fabricated score). */
function WeekHero({ weekly }: { weekly: MeWeekAggregates }) {
  const delta = weekly.score != null && weekly.prevWeekScore != null ? weekly.score - weekly.prevWeekScore : null
  return (
    <div className="card" style={{ padding: 18, margin: '0 24px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col">
          {weekly.score != null ? (
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 1 }}>
              {weekly.score}
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 6 }}>/100</span>
            </div>
          ) : (
            <div className="col">
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 34, fontWeight: 600, lineHeight: 1, color: 'var(--text-tertiary)' }}>
                tanulom
              </span>
              <span className="text-tertiary" style={{ fontSize: 11, marginTop: 6 }}>
                még gyűjtöm az adatokat a heti értékeléshez
              </span>
            </div>
          )}
        </div>
        {delta != null && (
          <span
            className="label-mono"
            style={{ fontSize: 12, fontWeight: 700, color: delta >= 0 ? 'var(--success)' : 'var(--error)' }}
          >
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  )
}

export function WeekPage() {
  const [params, setParams] = useSearchParams()
  const start = resolveStart(params.get('start'))
  const { week } = useMeWeek(start)
  const [expandedIso, setExpandedIso] = useState<string | null>(null)
  const todayIso = localDateString()
  const currentWeek = isCurrentWeek(start)

  const goPrev = () => setParams({ start: prevMonday(start) }, { replace: true })
  const goNext = () => setParams({ start: nextMonday(start) }, { replace: true })

  return (
    <>
      <div className="pghead-np lav">
        <div style={{ width: '100%' }}>
          <div className="over">Én · heti áttekintés</div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <h1>{deriveWeekTitle(start)}</h1>
            <div className="row gap-xs">
              <button type="button" className="chip" title="Előző hét" onClick={goPrev}>‹</button>
              <button type="button" className="chip" title="Következő hét" onClick={goNext} disabled={currentWeek}>›</button>
            </div>
          </div>
        </div>
      </div>

      {week && <WeekHero weekly={week.weekly} />}

      {week && (
        <div style={{ padding: '0 24px 16px' }}>
          <StatStrip cells={weeklyStatCells(week.weekly)} />
        </div>
      )}

      {week && (
        <div style={{ padding: '0 24px 16px' }}>
          <WeekScoreBars scores={week.days.map((d) => d.score ?? null)} />
        </div>
      )}

      {week && (
        <div style={{ padding: '0 24px 24px' }}>
          {week.days.map((d) => {
            const future = currentWeek && d.date > todayIso
            return (
              <WeekDayCard
                key={d.date}
                day={d}
                future={future}
                expanded={expandedIso === d.date}
                onToggle={() => setExpandedIso((cur) => (cur === d.date ? null : d.date))}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
