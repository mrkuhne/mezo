import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackDayView } from '@/features/fuel/logic/stackPresentation'
import { ClayIcon } from '@/shared/ui/clay'

interface StackNextHeroProps {
  view: StackDayView
  onToggle: (entry: StackDayEntry) => void
  onOpen: (entry: StackDayEntry) => void
  onAdd: () => void
}

function StackProgress({ view }: { view: StackDayView }) {
  const width = view.totalCount === 0 ? 0 : Math.round((view.takenCount / view.totalCount) * 100)
  return (
    <div className="stk-hub-progress-wrap">
      <div
        className="stk-hub-progress"
        role="progressbar"
        aria-label="Mai Stack haladás"
        aria-valuemin={0}
        aria-valuemax={view.totalCount}
        aria-valuenow={view.takenCount}
      >
        <span style={{ width: `${width}%` }} />
      </div>
      <span>{view.takenCount} / {view.totalCount} bevéve</span>
    </div>
  )
}

export function StackNextHero({ view, onToggle, onOpen, onAdd }: StackNextHeroProps) {
  if (view.totalCount === 0) {
    return (
      <section className="stk-hub-next stk-hub-empty rise">
        <ClayIcon name="i-stack" size={76} />
        <div>
          <span className="stk-hub-kicker">A SAJÁT RITMUSOD</span>
          <h1>A protokollod még üres</h1>
          <p>Vedd fel az első tételt, és a Stack elrendezi a napodban.</p>
        </div>
        <button type="button" className="stk-hub-primary" onClick={onAdd}>Tétel hozzáadása</button>
      </section>
    )
  }

  if (view.allDone) {
    return (
      <section className="stk-hub-next stk-hub-done rise">
        <ClayIcon name="i-stack" size={76} />
        <div>
          <span className="stk-hub-kicker">MAI RITMUS</span>
          <h1>A mai stack kész</h1>
          <p>Minden mára tervezett bevétel megvan.</p>
        </div>
        <StackProgress view={view} />
      </section>
    )
  }

  const row = view.nextRow!
  const { entry } = row
  return (
    <section className="stk-hub-next rise">
      <div className="stk-hub-next-top">
        <span className="stk-hub-kicker">MOST KÖVETKEZIK</span>
        <span className="stk-hub-time">{row.time}</span>
      </div>
      <div className="stk-hub-focus">
        <ClayIcon name="i-stack" size={76} />
        <button type="button" className="stk-hub-copy" onClick={() => onOpen(entry)} aria-label={`${entry.name} beállítások`}>
          <strong>{entry.name}</strong>
          <span>{entry.dose}</span>
        </button>
        <button
          type="button"
          className="stk-hub-check"
          aria-label={`${entry.name} bevétel ${entry.taken ? 'visszavonása' : 'jelölése'}`}
          aria-pressed={entry.taken}
          disabled={entry.skippedToday}
          onClick={() => onToggle(entry)}
        >
          <span aria-hidden="true">✓</span>
        </button>
      </div>
      <p className="stk-hub-reason">{entry.reason ?? row.anchorNote ?? 'Automatikusan időzítve.'}</p>
      <StackProgress view={view} />
    </section>
  )
}
