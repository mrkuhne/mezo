import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

export type StackManageLens = 'protocol' | 'timing' | 'meals'

interface StackManageOccurrenceListProps {
  slots: StackDaySlot[]
  lens: StackManageLens
  onOpen: (entry: StackDayEntry) => void
}

const mealZones = new Set(['breakfast', 'lunch', 'dinner'])

export function StackManageOccurrenceList({ slots, lens, onOpen }: StackManageOccurrenceListProps) {
  const visible = lens === 'meals' ? slots.filter(slot => mealZones.has(slot.zone)) : slots
  return (
    <div className={`stk-manage-list lens-${lens}`}>
      {visible.map(slot => (
        <section className="stk-manage-group rise" key={`${slot.zone}-${slot.time}`}>
          <header>
            <div><strong>{slot.label}</strong>{slot.anchorNote && <small>{slot.anchorNote}</small>}</div>
            <time>{slot.time}</time>
          </header>
          {slot.entries.map(entry => (
            <button
              type="button" className="stk-manage-row" key={entry.occurrenceId}
              aria-label={`${entry.name} beállítások`} onClick={() => onOpen(entry)}
            >
              <span className="stk-manage-dot" aria-hidden="true" />
              <span className="stk-manage-main">
                <strong>{entry.name}</strong>
                <small>{entry.dose}</small>
              </span>
              <span className="stk-manage-meta">
                <small>{slot.label} · {slot.time}</small>
                <em>{entry.pinned ? 'kézi' : 'auto'}</em>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
