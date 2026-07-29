import { useNavigate } from 'react-router-dom'
import { useRitualDay, useTodayScenario } from '@/data/hooks'
import { ritualWindowState } from '@/features/ritual/logic/ritualWindow'
import { ItemCard } from '@/shared/ui/ItemCard'
import { localDateString } from '@/shared/lib/dates'

/**
 * Today's Napzárás entry point — the evening-window nudge into the full `/ritual` flow,
 * dressed in the shared `ItemCard` language (mezo-j7u4). Three states derived from
 * `useRitualDay` + `ritualWindowState`: **waiting** before the window opens, **open** once it
 * does (CTA), **done** once the day is closed. The `?ritual=` scenario param
 * (`useTodayScenario`) WINS over the derived state — the same `?day=` demo-affordance
 * precedent (survives real mode by design, so QA/demo can force any state without waiting
 * for the clock).
 *
 * `now` defaults to `new Date()` (the `GreetingHeader` test-override precedent) so the derived
 * branch stays testable with a fixed clock.
 */
export function RitualCard({ now = new Date() }: { now?: Date }) {
  const { data: ritualDay } = useRitualDay(localDateString())
  const { ritual } = useTodayScenario()
  const navigate = useNavigate()

  const derived = ritualDay.closed ? 'done' : ritualWindowState(now, ritualDay.window)
  const state = ritual ?? derived

  if (state === 'done') {
    return (
      <ItemCard tone="mind" emoji="🌙" tag="NAPZÁRÁS" title="Napzárás kész"
        facts={[]} logged loggedSummary="Kész" />
    )
  }

  const isOpen = state === 'open'
  const { opensAt, bedTime } = ritualDay.window

  // Soft gate (ADR 0010 spirit): the waiting card only LOOKS inactive — it offers no CTA
  // rather than a dead one (the `ItemRow` doctrine), and a direct /ritual visit is never
  // blocked. The route stays reachable from the TodoCard's ritual row.
  return (
    <ItemCard
      tone="mind" emoji="🌙" tag="NAPZÁRÁS" time={opensAt}
      title="Zárjuk le a napot"
      facts={['5 felvonás', `villanyoltás ${bedTime}`]}
      logged={false}
      stateLabel={isOpen ? 'MOST' : 'Még vár'}
      ctaLabel={isOpen ? 'Zárjuk le a napot ✨' : undefined}
      onLog={isOpen ? () => navigate('/ritual') : undefined}
    />
  )
}
