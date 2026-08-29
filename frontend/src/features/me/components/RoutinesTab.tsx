import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }
const SUMMARY_DAYS = 30
// Catalog-driven chain cards (mezo-n5e9.2) — same daypart→emoji reading as todayItems.ts.
const DAYPART_EMOJI: Record<HabitDaypart, string> = { MORNING: '🌅', DAY: '☀️', EVENING: '🌙' }

/**
 * Overview surface for the Rutin tab. Date-navigable + read-only (no check/log affordance):
 * - TODAY: 30-day perfect-day counters (aggregate standing) + both chains as no-truncation
 *   strength rows.
 * - PAST day: a day-scoped view — a compact done/total summary chip + status-only chain rows
 *   (no strength bars, which are a rolling metric, not a per-day fact).
 * - EMPTY past day: a quiet ghost.
 */
export function RoutinesTab() {
  const navigate = useNavigate()
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog } = useHabitCatalog()
  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null

  // Active chains, editor order — the ONE source of which cards render (replaces the hardcoded
  // MORNING/EVENING pair). Empty catalog (unresolved real mode) → no cards, never a crash.
  const chains = [...catalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)

  const morning = habits.filter((h) => h.chain === 'MORNING')
  const evening = habits.filter((h) => h.chain === 'EVENING')
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)

  // Mozaik reface (mezo-d20.6.5): the prototype's `.covgrid`/`.covtile` 30-day
  // counter tiles — the fill bar animates in once (mzp-fill, prefers-reduced-motion
  // guarded), same recipe as the badge grid's unearned bars.
  const stat = (emoji: string, label: string, count: number, delayMs: number) => (
    <div className="gr-covtile rise" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <span style={{ fontSize: 16 }} aria-hidden="true">{emoji}</span>
      <b>{count} / {SUMMARY_DAYS} nap</b>
      <small>{label}</small>
      <div className="gr-covtrack">
        <div style={{ width: `${(count / SUMMARY_DAYS) * 100}%`, '--d': `${350 + delayMs}ms` } as React.CSSProperties} />
      </div>
    </div>
  )

  // `showStrength` false on a past day: rows carry status only (no rolling-metric percentage/bar).
  const chainCard = (chain: HabitChainInfo, showStrength: boolean) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) {
      return null
    }
    return (
      <div key={chain.id} className="gr-chain rise" style={{ '--d': '80ms' } as React.CSSProperties}>
        <div className="mz-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <span aria-hidden="true">{DAYPART_EMOJI[chain.daypart]}</span>
          <span>{chain.title}</span>
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
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <DayNavigator date={date} maxDate={today} onChange={setDate} />
        </div>
        {/* Editor entry — today view only (mezo-n5e9.2/.4): a past-day view stays
            read-only-clean, since it is looking at history, not the live catalog. */}
        {isToday && (
          <button type="button" className="cta-ghost" onClick={() => navigate('/me/routines/edit')}>
            <span aria-hidden="true">✏️</span> Szerkesztés
          </button>
        )}
      </div>
      {isToday ? (
        <>
          <div className="gr-covgrid">
            {stat('🌅', 'Tökéletes reggelek', summary.perfectMorningDays30, 0)}
            {stat('🌙', 'Tökéletes esték', summary.perfectEveningDays30, 40)}
          </div>
          {chains.map((c) => chainCard(c, true))}
        </>
      ) : habits.length === 0 ? (
        <GhostState lines={2} message="Nincs rutinadat erre a napra" />
      ) : (
        <>
          <div className="gr-chain rise" style={{ '--d': '0ms', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 } as React.CSSProperties}>
            <span>
              Reggel {doneOf(morning)}/{morning.length} · Este {doneOf(evening)}/{evening.length}
            </span>
            <span style={{ color: 'var(--mz-cell-sage-ink)' }}>+{earnedXp} XP</span>
          </div>
          {chains.map((c) => chainCard(c, false))}
        </>
      )}
    </div>
  )
}
