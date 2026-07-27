import { useState } from 'react'
import { useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }
const SUMMARY_DAYS = 30

/**
 * Overview surface for the Rutin tab. Date-navigable + read-only (no check/log affordance):
 * - TODAY: 30-day perfect-day counters (aggregate standing) + both chains as no-truncation
 *   strength rows.
 * - PAST day: a day-scoped view — a compact done/total summary chip + status-only chain rows
 *   (no strength bars, which are a rolling metric, not a per-day fact).
 * - EMPTY past day: a quiet ghost.
 */
export function RoutinesTab() {
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null

  const morning = habits.filter((h) => h.chain === 'MORNING')
  const evening = habits.filter((h) => h.chain === 'EVENING')
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)

  const stat = (emoji: string, label: string, count: number, color: string) => (
    <div className="hab-gstat">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="hab-gnum">{count}</span>
        <span className="hab-gof">/ {SUMMARY_DAYS} nap</span>
      </div>
      <div className="hab-glab">
        <span aria-hidden="true">{emoji} </span>
        <span>{label}</span>
      </div>
      <div className="hab-gtrack">
        <div className="hab-gfill" style={{ width: `${(count / SUMMARY_DAYS) * 100}%`, background: color }} />
      </div>
    </div>
  )

  // `showStrength` false on a past day: rows carry status only (no rolling-metric percentage/bar).
  const chainCard = (emoji: string, label: string, chain: HabitItem['chain'], showStrength: boolean) => {
    const items = habits.filter((h) => h.chain === chain)
    if (items.length === 0) {
      return null
    }
    return (
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <span aria-hidden="true">{emoji}</span>
          <span>{label}</span>
        </div>
        {items.map((h) => {
          const pct = showStrength ? strength(h.key) : null
          return (
            <div key={h.key} className="hab-srow">
              <div className="hab-stop">
                <span className="hab-sdot"
                  style={{ color: h.status === 'done' ? 'var(--sage-deep)' : 'var(--text-quaternary)' }}>
                  {STATE_ICON[h.status]}
                </span>
                <span className="hab-sname">{h.title}</span>
                {showStrength && <span className="hab-spct">{pct != null ? `${pct}%` : '—'}</span>}
              </div>
              {showStrength && <div className="hab-sbar"><i style={{ width: `${pct ?? 0}%` }} /></div>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <DayNavigator date={date} maxDate={today} onChange={setDate} />
      {isToday ? (
        <>
          <div className="row" style={{ gap: 12 }}>
            {stat('🌅', 'Tökéletes reggelek', summary.perfectMorningDays30, 'var(--amber)')}
            {stat('🌙', 'Tökéletes esték', summary.perfectEveningDays30, 'var(--lav)')}
          </div>
          {chainCard('🌅', 'Reggeli lánc', 'MORNING', true)}
          {chainCard('🌙', 'Esti lánc', 'EVENING', true)}
        </>
      ) : habits.length === 0 ? (
        <GhostState lines={2} message="Nincs rutinadat erre a napra" />
      ) : (
        <>
          <div
            className="card"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span>
              Reggel {doneOf(morning)}/{morning.length} · Este {doneOf(evening)}/{evening.length}
            </span>
            <span style={{ color: 'var(--sage-deep)' }}>+{earnedXp} XP</span>
          </div>
          {chainCard('🌅', 'Reggeli lánc', 'MORNING', false)}
          {chainCard('🌙', 'Esti lánc', 'EVENING', false)}
        </>
      )}
    </div>
  )
}
