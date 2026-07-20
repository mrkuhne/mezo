import { useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }
const SUMMARY_DAYS = 30

/** Overview surface: 30-day perfect-day ratios + both chains as no-truncation strength rows. */
export function RoutinesTab() {
  const { habits } = useHabitDay(localDateString())
  const { data: summary } = useHabitSummary()
  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null

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

  const chainCard = (emoji: string, label: string, chain: HabitItem['chain']) => {
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
          const pct = strength(h.key)
          return (
            <div key={h.key} className="hab-srow">
              <div className="hab-stop">
                <span className="hab-sdot"
                  style={{ color: h.status === 'done' ? 'var(--sage-deep)' : 'var(--text-quaternary)' }}>
                  {STATE_ICON[h.status]}
                </span>
                <span className="hab-sname">{h.title}</span>
                <span className="hab-spct">{pct != null ? `${pct}%` : '—'}</span>
              </div>
              <div className="hab-sbar"><i style={{ width: `${pct ?? 0}%` }} /></div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row" style={{ gap: 12 }}>
        {stat('🌅', 'Tökéletes reggelek', summary.perfectMorningDays30, 'var(--amber)')}
        {stat('🌙', 'Tökéletes esték', summary.perfectEveningDays30, 'var(--lav)')}
      </div>
      {chainCard('🌅', 'Reggeli lánc', 'MORNING')}
      {chainCard('🌙', 'Esti lánc', 'EVENING')}
    </div>
  )
}
