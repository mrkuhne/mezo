import type { StackDayRow } from '@/features/fuel/logic/stackPresentation'

interface StackRhythmPreviewProps {
  rows: StackDayRow[]
  totalCount: number
  onOpenAll: () => void
}

export function StackRhythmPreview({ rows, totalCount, onOpenAll }: StackRhythmPreviewProps) {
  const nextIndex = rows.findIndex(row => !row.entry.taken)

  return (
    <section className="stk-rhythm-preview rise">
      <div className="stk-rhythm-head">
        <div>
          <span className="stk-hub-kicker">MAI RITMUS</span>
          <h2>A napod, egy pillantásra</h2>
        </div>
        <button type="button" onClick={onOpenAll} aria-label={`Mind a ${totalCount} bevétel`}>
          Mind a {totalCount} <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="stk-rhythm-list">
        {rows.map((row, index) => {
          const state = row.entry.taken ? 'bevéve' : index === nextIndex ? 'következik' : 'később'
          return (
            <div className={`stk-rhythm-row is-${state}`} key={row.entry.occurrenceId}>
              <time>{row.time}</time>
              <span className="stk-rhythm-dot" aria-hidden="true" />
              <div><strong>{row.entry.name}</strong><small>{row.entry.dose}</small></div>
              <span className="stk-rhythm-state">{state}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
