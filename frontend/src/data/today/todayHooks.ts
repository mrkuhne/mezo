import { useSearchParams } from 'react-router-dom'
import { isMockMode } from '@/data/_client/mode'
import { useMedication } from '@/data/fuel/medicationHooks'
import { useFuelTimeline } from '@/data/fuel/timelineHooks'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from '@/data/today/today'
import type { Briefing, DayState, TodayScenario } from '@/data/types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  // The retaDay base is the real medication cycle in real mode (the single FE source every
  // Reta surface reads), the mock default in mock mode. cycle.retaDay is 0 when there is no
  // medication / no dose (the ghost, or the cold-load window) → fall back to today.retaDay so
  // nothing ever shows a 0 day. The ?retaDay= URL override stays TOP priority in BOTH modes.
  const { cycle } = useMedication()
  const base = isMockMode() ? today.retaDay : cycle.retaDay || today.retaDay
  const retaRaw = parseInt(params.get('retaDay') ?? '', 10)
  const retaDay = Number.isFinite(retaRaw) ? Math.min(7, Math.max(1, retaRaw)) : base
  const niggle = params.get('niggle') !== 'off'
  const vulnerable = params.get('vulnerable') === 'on'
  return { dayState, retaDay, niggle, vulnerable, anchorMode: dayState === 'rough' }
}

export function resolveBriefing(dayState: DayState): Briefing {
  const variant = briefingVariants[dayState]
  return variant ? { ...briefing, ...variant } : briefing
}

export function useToday() {
  return { today, user, briefing, workout, volleyballSessions, fuelToday }
}

// Today's fuel preview — the 3-slot window from the now-slot + the next supplement stack.
// Composes the same dual-mode plan as the Fuel "Mai" timeline (mock seed vs. real buildDayPlan),
// so Today and Fuel never diverge; the {visible, nextStack} shape is unchanged (mezo-9ys).
export function useFuelPreview() {
  const { plan } = useFuelTimeline()
  const slots = plan.slots
  const nowIdx = slots.findIndex(s => s.state === 'now')
  const start = Math.max(0, nowIdx)
  const visible = slots.slice(start, start + 3)
  const nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))
  return { visible, nextStack }
}
