import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import { Icon } from '@/shared/ui/Icon'

interface StackTimelineProps {
  slots: StackDaySlot[]
  onToggle: (entry: StackDayEntry) => void
  onOpen: (entry: StackDayEntry) => void
}

export function StackTimeline({ slots, onToggle, onOpen }: StackTimelineProps) {
  return (
    <div className="stk-timeline">
      {slots.map(slot => (
        <section className="stk-timeline-slot" key={`${slot.zone}-${slot.time}`}>
          <header>
            <div><strong>{slot.label}</strong>{slot.anchorNote && <small>{slot.anchorNote}</small>}</div>
            <time>{slot.time}</time>
          </header>
          {slot.entries.map(entry => (
            <div className={`stk-timeline-row${entry.skippedToday ? ' is-skipped' : ''}`} key={entry.occurrenceId}>
              <button
                type="button"
                className="stk-timeline-check"
                aria-label={`${entry.name} bevétel ${entry.taken ? 'visszavonása' : 'jelölése'}`}
                aria-pressed={entry.taken}
                disabled={entry.skippedToday}
                onClick={() => onToggle(entry)}
              >
                {entry.taken && <Icon name="check" size={12} />}
              </button>
              <button type="button" className="stk-timeline-copy" aria-label={`${entry.name} beállítások`} onClick={() => onOpen(entry)}>
                <span><strong>{entry.name}</strong>{entry.dose && <small>{entry.dose}</small>}</span>
                <span className="stk-timeline-badges">
                  {entry.displacedToday && <em>ma nincs edzés</em>}
                  {entry.skippedToday && <em>ma kimarad</em>}
                  <em>{entry.pinned ? 'kézi' : 'auto'}</em>
                </span>
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
