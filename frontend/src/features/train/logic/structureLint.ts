// ============================================================
// Mezo · structureLint — soft structural checks over the meso week
// (mezo-oyhy.2, spec 2026-08-06). Encodes the RP/Helms/Nippard/Ethier
// session- and week-structure consensus (docs/research/concepts/
// program-design-rules.md) plus wide-tolerance push:pull and ham:quad
// balance checks (structural-balance literature — the copy says so).
// Pure derivation; findings are soft observations (never red, never
// blocking) rendered by StructureLintCard. Thresholds live in the
// exported tables below — one place to tune.
// ============================================================
import type { MesoDay } from '@/data/types'
import { BUDGET_GROUP_LABELS, budgetGroup } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'

export type StructureRuleId =
  | 'exercises-per-muscle' | 'sets-per-exercise' | 'frequency'
  | 'variety' | 'session-size' | 'push-pull' | 'ham-quad'

export interface StructureFinding {
  rule: StructureRuleId
  /** Short HU headline. */
  label: string
  /** The why-explanation (HU). */
  detail: string
  /** Set for session-scoped findings. */
  day?: string
}

// Exercises per muscle group per session (RP: 1–3; hams/traps stricter).
export const MAX_EXERCISES_PER_MUSCLE_SESSION_DEFAULT = 3
export const MAX_EXERCISES_PER_MUSCLE_SESSION: Record<string, number> = { ham: 2, traps: 2 }
// Working-set band per exercise kind (plyo exempt).
export const SETS_PER_EXERCISE = { compound: { min: 2, max: 4 }, isolation: { min: 2, max: 3 } } as const
// The frequency rule fires only at/above this weekly set count (splitting less is noise).
export const FREQUENCY_MIN_WEEKLY_SETS = 4
// Weekly distinct exercises per group.
export const VARIETY_MAX = 5
export const VARIETY_MIN = 2
export const VARIETY_MIN_WEEKLY_SETS = 6
// Exercises per training day — plyo counts, it is a real session slot.
export const SESSION_SIZE = { min: 5, max: 9 } as const
// Weekly push:pull working-set ratio silence band; needs both sides > 0.
export const PUSH_PULL_BAND = { min: 0.6, max: 1.6 } as const
// ham:quad floor, checked only when quad weekly sets reach the gate.
export const HAM_QUAD_MIN = 0.4
export const HAM_QUAD_QUAD_GATE = 6

// Muscle key → push/pull side; legs and core are neutral (absent). The legacy
// coarse 'shoulder' maps to push (press-dominant); rear delts pull.
export const PUSH_PULL_SIDE: Record<string, 'push' | 'pull'> = {
  'chest-upper': 'push', 'chest-mid': 'push', 'chest-lower': 'push', chest: 'push',
  'shoulder-front': 'push', 'shoulder-side': 'push', shoulder: 'push',
  'triceps-long': 'push', 'triceps-lateral': 'push', 'triceps-medial': 'push', triceps: 'push',
  'back-wide': 'pull', 'back-mid': 'pull', 'back-lower': 'pull', back: 'pull', lats: 'pull',
  traps: 'pull', 'rear-delt': 'pull', 'shoulder-rear': 'pull',
  'biceps-long': 'pull', 'biceps-short': 'pull', 'biceps-brachialis': 'pull', biceps: 'pull',
}

const groupLabel = (group: string) => BUDGET_GROUP_LABELS[group] ?? group

export function structureLint(days: MesoDay[]): StructureFinding[] {
  const session: StructureFinding[] = []
  const weekly: StructureFinding[] = []
  const training = days.filter((d) => !isOffDay(d) && d.exercises.length > 0)

  const weeklySets = new Map<string, number>()
  const weeklyDays = new Map<string, Set<string>>()
  const weeklyNames = new Map<string, Set<string>>()
  let pushSets = 0
  let pullSets = 0

  for (const d of training) {
    const perGroupExercises = new Map<string, number>()

    for (const ex of d.exercises) {
      if (ex.type === 'plyo') continue
      const group = budgetGroup(ex.muscle)
      if (!group) continue

      perGroupExercises.set(group, (perGroupExercises.get(group) ?? 0) + 1)
      weeklySets.set(group, (weeklySets.get(group) ?? 0) + ex.workingSets)
      if (!weeklyDays.has(group)) weeklyDays.set(group, new Set())
      weeklyDays.get(group)!.add(d.day)
      if (!weeklyNames.has(group)) weeklyNames.set(group, new Set())
      weeklyNames.get(group)!.add(ex.name)

      const side = PUSH_PULL_SIDE[ex.muscle]
      if (side === 'push') pushSets += ex.workingSets
      else if (side === 'pull') pullSets += ex.workingSets

      // R2 — sets per exercise
      const band = SETS_PER_EXERCISE[ex.type]
      if (ex.workingSets < band.min) {
        session.push({
          rule: 'sets-per-exercise', day: d.day,
          label: `${ex.name}: ${ex.workingSets} szett (${d.day}).`,
          detail: `${band.min} szett alatt egy gyakorlat alig ad ingert — a ${band.min} szett teljesen legitim kezdés.`,
        })
      } else if (ex.workingSets > band.max) {
        session.push({
          rule: 'sets-per-exercise', day: d.day,
          label: `${ex.name}: ${ex.workingSets} szett (${d.day}).`,
          detail: `${band.max} szett fölött egy gyakorlaton a plusz szett már alig hoz — inkább új gyakorlat vagy másik nap.`,
        })
      }
    }

    // R1 — exercises per muscle group in this session
    for (const [group, n] of perGroupExercises) {
      const max = MAX_EXERCISES_PER_MUSCLE_SESSION[group] ?? MAX_EXERCISES_PER_MUSCLE_SESSION_DEFAULT
      if (n > max) {
        session.push({
          rule: 'exercises-per-muscle', day: d.day,
          label: `${groupLabel(group)}: ${n} gyakorlat egy edzésen (${d.day}).`,
          detail: '1–3 gyakorlat izmonként edzésenként a hatékony sáv — kevesebb gyakorlat jól csinálva többet ér, mint a variálás.',
        })
      }
    }

    // R5 — session size (ALL exercises, plyo included: it is a session slot)
    const size = d.exercises.length
    if (size < SESSION_SIZE.min) {
      session.push({
        rule: 'session-size', day: d.day,
        label: `${d.day}: csak ${size} gyakorlat.`,
        detail: 'A bevált sablonok 5–9 gyakorlattal dolgoznak edzésenként.',
      })
    } else if (size > SESSION_SIZE.max) {
      session.push({
        rule: 'session-size', day: d.day,
        label: `${d.day}: ${size} gyakorlat.`,
        detail: '9 fölött a session vége már fáradtan megy — oszd el, vagy húzd meg.',
      })
    }
  }

  // R3 — frequency
  for (const [group, sets] of weeklySets) {
    if (sets >= FREQUENCY_MIN_WEEKLY_SETS && (weeklyDays.get(group)?.size ?? 0) === 1) {
      weekly.push({
        rule: 'frequency',
        label: `${groupLabel(group)}: minden heti szett egy napon.`,
        detail: 'Ugyanez a volumen ≥2 napra elosztva akár ~30%-kal gyorsabb fejlődést hozhat.',
      })
    }
  }

  // R4 — variety
  for (const [group, names] of weeklyNames) {
    const sets = weeklySets.get(group) ?? 0
    if (names.size > VARIETY_MAX) {
      weekly.push({
        rule: 'variety',
        label: `${groupLabel(group)}: ${names.size} különböző gyakorlat a héten.`,
        detail: '5 fölött a variálás már a progressziót nehezíti — kevesebb mozdulat, jobban csinálva.',
      })
    } else if (names.size < VARIETY_MIN && sets >= VARIETY_MIN_WEEKLY_SETS) {
      weekly.push({
        rule: 'variety',
        label: `${groupLabel(group)}: 1 gyakorlat egész héten.`,
        detail: 'Heti 2–5 különböző gyakorlat izmonként fedi le a szögeket — egy másik variáció beférne.',
      })
    }
  }

  // R6 — push:pull (compare the ROUNDED ratio to the band so the rendered
  // label never contradicts the flag decision — e.g. 1.62 rounds to 1.6, silent).
  if (pushSets > 0 && pullSets > 0) {
    const ratio = pushSets / pullSets
    const r = Math.round(ratio * 10) / 10
    if (r < PUSH_PULL_BAND.min || r > PUSH_PULL_BAND.max) {
      weekly.push({
        rule: 'push-pull',
        label: `Push:pull arány ${r.toFixed(1)}.`,
        detail: 'A ≈1:1 heti tolóerő-húzóerő arány védi a vállat (strukturális-balansz irodalom, nem RP-szabály).',
      })
    }
  }

  // R7 — ham:quad (same rounded-comparison approach as R6)
  const quad = weeklySets.get('quad') ?? 0
  const ham = weeklySets.get('ham') ?? 0
  if (quad >= HAM_QUAD_QUAD_GATE) {
    const r = Math.round((ham / quad) * 10) / 10
    if (r < HAM_QUAD_MIN) {
      weekly.push({
        rule: 'ham-quad',
        label: `Ham:quad arány ${r.toFixed(1)}.`,
        detail: 'A hátsó comb a quad-volumen ~0.6–0.8-szorosát kéri (strukturális-balansz irodalom).',
      })
    }
  }

  return [...session, ...weekly]
}
