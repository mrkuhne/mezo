import { useSearchParams } from 'react-router-dom'
import { isMockMode } from '@/data/_client/mode'
import { useMedication } from '@/data/fuel/medicationHooks'
import { useFuelTimeline } from '@/data/fuel/timelineHooks'
import { useTrain } from '@/data/train/trainHooks'
import { useSleep } from '@/data/me/sleepHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useBriefing } from '@/data/today/briefingHooks'
import { huMonthDay, huWeekdayFull, localDateString } from '@/shared/lib/dates'
import {
  today,
  user,
  briefing,
  briefingVariants,
  workout,
  volleyballSessions,
  workoutPrediction,
  volleyballNote,
} from '@/data/today/today'
import type {
  Briefing,
  DayState,
  QuickStatItem,
  TodayMeta,
  TodayScenario,
  UserMeta,
  VolleyballSession,
  Workout,
  WorkoutPlan,
  WorkoutPrediction,
} from '@/data/types'

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

type TodayData = {
  today: TodayMeta
  user: UserMeta
  /** The GENERATED briefing (real mode, proactive B1.2) — null in mock mode and whenever no server briefing exists; the page falls back to resolveBriefing + the „Demo tartalom" label. */
  briefing: Briefing | null
  /** True in real mode — the briefing prose is static demo copy until the proactive epic ships the generated one. */
  briefingDemo: boolean
  /** Mock: the Phase-1 static plan. Real: today's planned Train session; null (rest day / no meso) hides the teaser. */
  workout: Workout | WorkoutPlan | null
  /** The teaser eyebrow time — the real gym slot for today, or null (eyebrow renders without a time). */
  workoutTime: string | null
  /** Demo prediction line in mock mode; null in real mode (predictions are a later epic). */
  prediction: WorkoutPrediction | null
  volleyballSessions: VolleyballSession[]
  /** Demo "Stacked day" AI note in mock mode; null in real mode (proactive-epic prose). */
  volleyballNote: string | null
}

// The Today composition (T slice, mezo-t16y.3): mock returns the byte-identical Phase-1
// statics; real composes EXISTING real reads (Train's today session + active meso + schedules,
// the real date) — no new backend. Demo-only copy (prediction, AI note) is null in real mode,
// and the consuming components hide those surfaces (honest-surface rule).
export function useToday(): TodayData {
  const mock = isMockMode()
  const train = useTrain()
  const serverBriefing = useBriefing()
  if (mock) {
    return {
      today,
      user,
      briefing: null,
      briefingDemo: false,
      workout,
      workoutTime: today.workoutTime,
      prediction: workoutPrediction,
      volleyballSessions,
      volleyballNote,
    }
  }
  const now = new Date()
  const meso = train.activeMeso
  const gymToday = train.gymSchedule?.weeklyTimes.find((d) => d.active && d.today)
  return {
    today: {
      dayLabel: huWeekdayFull(now),
      dateLabel: huMonthDay(localDateString(now)),
      workoutType: train.workout?.title ?? '',
      workoutTime: gymToday?.time ?? '',
      retaDay: today.retaDay, // unused in real mode — the scenario derives retaDay from useMedication
      mesoPhase: meso?.phaseCurve?.[meso.currentWeek - 1] ?? '',
    },
    // Only the meso-derived fields go real here; the identity statics (name/handle/...) are
    // not rendered by Today — the useProfile decision belongs to Slice E.
    user: {
      ...user,
      weekInMeso: meso?.currentWeek ?? 0,
      dayInWeek: ((now.getDay() + 6) % 7) + 1,
      mesoLabel: meso?.title ?? '',
    },
    briefing: serverBriefing,
    briefingDemo: serverBriefing == null,
    workout: train.workout,
    workoutTime: gymToday?.time ?? null,
    prediction: null,
    volleyballSessions: train.sport.schedule?.volleyball.sessions ?? [],
    volleyballNote: null,
  }
}

const MOCK_QUICK_STATS: QuickStatItem[] = [
  { label: 'Alvás', value: '7.2', unit: 'h' },
  { label: 'Súly', value: '78.6', unit: 'kg' },
  { label: 'HRV', value: '64', unit: 'ms' },
]

// The "Most" quick-stats row: real mode derives sleep (last night) and weight (latest entry)
// from the real biometrics reads; the HRV cell has NO data source → dropped in real mode
// (strip philosophy), never a fabricated number.
export function useQuickStats(): QuickStatItem[] {
  const mock = isMockMode()
  const { sleepLog } = useSleep()
  const { weightLog } = useWeight()
  if (mock) return MOCK_QUICK_STATS
  const lastSleep = sleepLog[sleepLog.length - 1]
  const lastWeight = weightLog[weightLog.length - 1]
  return [
    {
      label: 'Alvás',
      value: lastSleep?.duration != null ? lastSleep.duration.toFixed(1) : '—',
      unit: 'h',
    },
    {
      label: 'Súly',
      value: lastWeight ? lastWeight.value.toFixed(1) : '—',
      unit: 'kg',
    },
  ]
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
