import { useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }

/** Overview surface: both chains in full + 28d strength bars + perfect-day counters. */
export function RoutinesTab() {
  const { habits } = useHabitDay(localDateString())
  const { data: summary } = useHabitSummary()
  const strength = (key: string) =>
    summary.habits.find((h) => h.key === key)?.strengthPct ?? null

  const chainCard = (label: string, chain: HabitItem['chain']) => {
    const items = habits.filter((h) => h.chain === chain)
    if (items.length === 0) {
      return null
    }
    return (
      <div className="card">
        <span className="eyebrow">{label}</span>
        {items.map((h) => {
          const pct = strength(h.key)
          return (
            <div key={h.key} className="skl">
              <span className="k">
                <span style={{ color: h.status === 'done' ? 'var(--success)' : 'var(--coral)' }}>
                  {STATE_ICON[h.status]}{' '}
                </span>
                {h.title}
              </span>
              <div className="bar"><i style={{ width: `${pct ?? 0}%` }} /></div>
              <span className="lv">{pct != null ? `${pct}%` : '—'}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row" style={{ gap: 10 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.perfectMorningDays30}</div>
          <div className="text-tertiary" style={{ fontSize: 11 }}>Tökéletes reggelek · 30 nap</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.perfectEveningDays30}</div>
          <div className="text-tertiary" style={{ fontSize: 11 }}>Tökéletes esték · 30 nap</div>
        </div>
      </div>
      {chainCard('Reggeli lánc', 'MORNING')}
      {chainCard('Esti lánc', 'EVENING')}
    </div>
  )
}
