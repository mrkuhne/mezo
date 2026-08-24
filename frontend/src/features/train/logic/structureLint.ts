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
import { BUDGET_GROUP_LABELS, budgetGroup, countsForVolume } from '@/features/train/logic/setBudget'
import { isOffDay } from '@/features/train/logic/offDay'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'

export type StructureRuleId =
  | 'exercises-per-muscle' | 'sets-per-exercise' | 'frequency'
  | 'variety' | 'session-size' | 'push-pull' | 'ham-quad' | 'session-length' | 'rep-zone'

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
interface SetBand { min: number; max: number }
// Working-set band per exercise kind (exempt work excluded). No 'plyo' entry: no
// consensus band exists for plyo/exempt work, so a lookup keyed by the full
// ExerciseKind union (below, R2) types honestly as `SetBand | undefined` and
// skips kinds with no defined band rather than guessing (mezo-gbo7). compound/
// isolation stay non-optional so direct property access (programFit's kindCap)
// is unaffected.
export const SETS_PER_EXERCISE: Record<'compound' | 'isolation', SetBand> & Partial<Record<'plyo', SetBand>> = {
  compound: { min: 2, max: 4 },
  isolation: { min: 2, max: 3 },
}
// The frequency rule fires only at/above this weekly set count (splitting less is noise).
export const FREQUENCY_MIN_WEEKLY_SETS = 4
// Weekly distinct exercises per group.
export const VARIETY_MAX = 5
export const VARIETY_MIN = 2
export const VARIETY_MIN_WEEKLY_SETS = 6
// Exercises per training day — exempt work counts, it is a real session slot.
export const SESSION_SIZE = { min: 5, max: 9 } as const
// Estimated session-length band, minutes (research: 20 min too short, 3 h counterproductive).
export const SESSION_LENGTH_BAND = { min: 45, max: 90 } as const
// Weekly push:pull working-set ratio silence band; needs both sides > 0.
export const PUSH_PULL_BAND = { min: 0.6, max: 1.6 } as const
// ham:quad floor, checked only when quad weekly sets reach the gate.
export const HAM_QUAD_MIN = 0.4
export const HAM_QUAD_QUAD_GATE = 6

// Weekly rep-zone mix (RP: ~25% heavy 5–10 · 50% moderate 10–20 · 25% light 20–30).
// Flags only a MONO-zone week: dominant zone ≥ 80% of a group's sets, gated at 6.
export const REP_ZONE_MONO_SHARE = 0.8
export const REP_ZONE_MIN_WEEKLY_SETS = 6
export type RepZone = 'heavy' | 'moderate' | 'light'
/** Deliberate skews that stay silent (RP: side/rear delts light, hip-hinge heavy). */
export const REP_ZONE_SKEW_OK: Record<string, RepZone> = { shoulder: 'light', ham: 'heavy', glute: 'heavy' }

/** Zone of a rep range: repMax ≤ 10 heavy, repMin ≥ 20 light, else moderate. */
export function repZoneOf(repMin: number, repMax: number): RepZone {
  if (repMax <= 10) return 'heavy'
  if (repMin >= 20) return 'light'
  return 'moderate'
}

const REP_ZONE_LABELS: Record<RepZone, string> = { heavy: 'nehéz', moderate: 'közepes', light: 'könnyű' }

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
  const weeklyZones = new Map<string, Record<RepZone, number>>()
  let pushSets = 0
  let pullSets = 0

  for (const d of training) {
    const perGroupExercises = new Map<string, number>()

    for (const ex of d.exercises) {
      if (!countsForVolume(ex)) continue
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

      let zones = weeklyZones.get(group)
      if (!zones) { zones = { heavy: 0, moderate: 0, light: 0 }; weeklyZones.set(group, zones) }
      zones[repZoneOf(ex.repMin, ex.repMax)] += ex.workingSets

      // R2 — sets per exercise. No band exists for 'plyo' (it was always exempt
      // pre-mezo-gbo7); a plyo exercise the user explicitly flips to count-toward-
      // volume still has no established consensus band, so it's skipped rather than
      // guessed at.
      const band = SETS_PER_EXERCISE[ex.type]
      if (band && ex.workingSets < band.min) {
        session.push({
          rule: 'sets-per-exercise', day: d.day,
          label: `${ex.name}: ${ex.workingSets} szett (${d.day}).`,
          detail: `${band.min} szett alatt egy gyakorlat alig ad ingert — a ${band.min} szett teljesen legitim kezdés.`,
        })
      } else if (band && ex.workingSets > band.max) {
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

    // R8 — session length (recipe estimator; GymExercise satisfies SessionTimeExercise)
    const minutes = estimateSessionMinutes(d.exercises)
    if (minutes < SESSION_LENGTH_BAND.min || minutes > SESSION_LENGTH_BAND.max) {
      session.push({
        rule: 'session-length', day: d.day,
        label: `${d.day}: ~${minutes} perc.`,
        detail: 'A produktív sáv 45–90 perc — 20 perc túl rövid az érdemi ingerhez, 3 óra már kontraproduktív.',
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

  // R9 — rep-zone mono-diet (weekly; skew exceptions per REP_ZONE_SKEW_OK)
  for (const [group, zones] of weeklyZones) {
    const total = zones.heavy + zones.moderate + zones.light
    if (total < REP_ZONE_MIN_WEEKLY_SETS) continue
    const dominant = (Object.keys(zones) as RepZone[]).reduce((a, b) => (zones[a] >= zones[b] ? a : b))
    const share = zones[dominant] / total
    if (share < REP_ZONE_MONO_SHARE) continue
    if (REP_ZONE_SKEW_OK[group] === dominant) continue
    weekly.push({
      rule: 'rep-zone',
      label: `${groupLabel(group)}: a heti szettek ${Math.round(share * 100)}%-a ${REP_ZONE_LABELS[dominant]} zónában.`,
      detail: 'Az arany arány ~25% nehéz (5–10) · 50% közepes (10–20) · 25% könnyű (20–30 rep) — vegyíts a hiányzó zónákból.',
    })
  }

  return [...session, ...weekly]
}
