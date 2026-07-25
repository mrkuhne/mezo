import { Link } from 'react-router-dom'
import { useRitualDay, useTodayScenario } from '@/data/hooks'
import { ritualWindowState } from '@/features/ritual/logic/ritualWindow'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

/**
 * Today's Napzárás entry point ("Teendők ma" zone, R3 mezo-ilsj) — the evening-window nudge
 * into the full `/ritual` flow. Three states derived from `useRitualDay` + `ritualWindowState`
 * (Task 1): **waiting** before the window opens, **open** once it does (glow CTA), **done**
 * once the day is closed. The `?ritual=` scenario param (`useTodayScenario`) WINS over the
 * derived state — the same `?day=` demo-affordance precedent (survives real mode by design, so
 * QA/demo can force any state without waiting for the clock).
 *
 * `now` defaults to `new Date()` (the `GreetingHeader` test-override precedent) so the derived
 * branch stays testable with a fixed clock.
 */
export function RitualCard({ now = new Date() }: { now?: Date }) {
  const { data: ritualDay } = useRitualDay(localDateString())
  const { ritual } = useTodayScenario()

  const derived = ritualDay.closed ? 'done' : ritualWindowState(now, ritualDay.window)
  const state = ritual ?? derived

  if (state === 'done') {
    return (
      <div className="ritcard-done">
        <span aria-hidden="true">🌙</span> Napzárás kész <span aria-hidden="true">✓</span>
      </div>
    )
  }

  const isOpen = state === 'open'
  const { opensAt, prepStartsAt, bedTime } = ritualDay.window

  return (
    // Soft gate (ADR 0010 spirit): a direct /ritual visit is always allowed — the waiting
    // card's CTA only looks disabled, it stays a real Link and never locks the route.
    <Link to="/ritual" className={cn('ritcard', !isOpen && 'waiting')}>
      <div className="ritcard-ttl">
        <span className="ritcard-moon" aria-hidden="true">{isOpen ? '🌙' : '🌘'}</span>
        Napzárás
      </div>
      <div className="ritcard-sub">
        {isOpen
          ? `A nap kész. Zárd le, mielőtt az alvás-előkészítés indul (${prepStartsAt}).`
          : `${opensAt}-kor nyílik — villanyoltás ${bedTime}.`}
      </div>
      <span className="ritcard-cta">
        {isOpen ? 'Zárjuk le a napot ✨' : `Még vár · ${opensAt}`}
      </span>
    </Link>
  )
}
