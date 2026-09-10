import type { DayFace } from '@/features/today/logic/dayFace'
import type { ClayIconName } from '@/shared/ui/clay'

export interface NextStepInputs {
  face: DayFace
  ritualClosed: boolean
  intentionSet: boolean
  morningHabitPending: boolean
  checkinStale: boolean
  waterMl: number
  waterTargetMl: number
  workoutPlanned: boolean
  workoutDone: boolean
  goalStep: string | null
}

export interface NextStep {
  title: string
  sub: string
  icon: ClayIconName
  kind: 'route' | 'intention'
  to: string
}

export function nextStep(i: NextStepInputs): NextStep {
  // 1. este (evening ritual) — always first
  if (i.face === 'este') {
    if (i.ritualClosed) {
      return {
        title: 'A mai nap a helyén.',
        sub: 'Ha szeretnéd, vissza is nézheted.',
        icon: 'i-alvas',
        kind: 'route',
        to: '/ritual',
      }
    }
    return {
      title: 'Tegyük le a napot.',
      sub: 'Amit megőriznél, és amit elengednél.',
      icon: 'i-alvas',
      kind: 'route',
      to: '/ritual',
    }
  }

  // 2. reggel (morning) — intention not set
  if (i.face === 'reggel' && !i.intentionSet) {
    return {
      title: 'Adjunk irányt a napnak.',
      sub: 'Egy mondat elég.',
      icon: 'i-lang',
      kind: 'intention',
      to: '',
    }
  }

  // 3. reggel (morning) — morning habit pending
  if (i.face === 'reggel' && i.morningHabitPending) {
    return {
      title: 'A reggeli ritmusod vár.',
      sub: 'Apró lépések, a saját sorrendedben.',
      icon: 'i-lang',
      kind: 'route',
      to: '/nap/rutin?dp=reggel',
    }
  }

  // 4. check-in stale
  if (i.checkinStale) {
    return {
      title: 'Hogy vagy most?',
      sub: 'Egy rövid pillanatkép, magadért.',
      icon: 'i-checkin',
      kind: 'route',
      to: '/nap/checkin',
    }
  }

  // 5. water threshold (less than 60% of target)
  if (i.waterTargetMl > 0 && i.waterMl < i.waterTargetMl * 0.6) {
    const liters = (i.waterMl / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 2 })
    return {
      title: 'Egy pohár víz jólesne.',
      sub: `${liters} liter ma eddig.`,
      icon: 'i-viz',
      kind: 'route',
      to: '/fuel',
    }
  }

  // 6. workout planned but not done
  if (i.workoutPlanned && !i.workoutDone) {
    return {
      title: 'A mai mozgásod még előtted áll.',
      sub: 'Együtt bele tudunk kezdeni.',
      icon: 'i-edzes',
      kind: 'route',
      to: '/train',
    }
  }

  // 7. goal step exists
  if (i.goalStep !== null) {
    return {
      title: 'Egy lépés a célod felé.',
      sub: i.goalStep,
      icon: 'i-growth',
      kind: 'route',
      to: '/me/goals',
    }
  }

  // 8. fallback — journal
  return {
    title: 'Egy gondolatnyi hely.',
    sub: 'A napló mindig nyitva áll.',
    icon: 'i-naplo',
    kind: 'route',
    to: '/me/naplo',
  }
}
