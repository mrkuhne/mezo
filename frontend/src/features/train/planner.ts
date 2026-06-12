// ============================================================
// Mezo · Mesocycle Planner helpers (4-step AI planner)
// Ported verbatim from prototype meso-planner.jsx:
//   - stepLabels (the 4-step state-machine labels)
//   - GOAL_HINTS (per-goal "Mezo javasolja" copy, keyed by goal id)
//   - SCHEMES (per-goal compound/isolation rep/RIR/set schemes)
//   - addWeeks (HU month math), getSeason (Tavasz/Nyár/Ősz/Tél)
//   - generateProgram (split → 7-day templates + goal schemes + niggle-aware
//     substitution warnings)
// GOAL_PRESETS / SPLITS / exerciseLibrary live in @/data/train.
// ============================================================
import { DAY_ORDER } from '@/data/train'
import type { ExerciseKind, GymExercise, MesoDay, GoalPreset, SplitOption } from '@/data/types'

// --- step labels (meso-planner.jsx:135) ---
export const stepLabels = ['Cél', 'Hossz + fázisok', 'Split + napok', 'Áttekintés'] as const

// --- per-goal "Mezo javasolja" hint copy (meso-planner.jsx:405-409), verbatim ---
export const GOAL_HINTS: Record<string, string> = {
  hypertrophy:
    '6 hét a klasszikus RP block: 2 MEV ramp-up → 2 MAV progresszió → 1 MRV csúcs → 1 deload. A korábbi Hypertrophy 03-ban ez 8/10-re értékeltük.',
  strength:
    '7 hét linear: lassabb a felfutás, de a Reta-cycle vége után az erő-blokkokra szükséged van több MAV hétre.',
  'cut-prep':
    '3 hét maintenance: tartani a MAV szintet, semmi MRV-bele-erőltetés. Deficit indul utána.',
  recovery:
    '4 hét rehab: 2 MEV szelíd indulás → 2 MAV óvatos volumenel. Deload nem szükséges — a teljes blokk kíméletes.',
  sport:
    '5 hét conjugate: MAV-on stabilizál, MRV-en peak — volleyball-szezonra szinkronizálva.',
}

// --- goal-specific rep/RIR/set schemes (meso-planner.jsx:793-799), verbatim ---
interface SchemeEntry {
  reps: string
  rir: number
  sets: number
}
interface GoalScheme {
  compound: SchemeEntry
  isolation: SchemeEntry
}
export const SCHEMES: Record<string, GoalScheme> = {
  hypertrophy: { compound: { reps: '8-10', rir: 1, sets: 4 }, isolation: { reps: '10-12', rir: 1, sets: 3 } },
  strength: { compound: { reps: '4-6', rir: 1, sets: 5 }, isolation: { reps: '8-10', rir: 2, sets: 3 } },
  'cut-prep': { compound: { reps: '10-12', rir: 2, sets: 3 }, isolation: { reps: '12-15', rir: 1, sets: 3 } },
  recovery: { compound: { reps: '10-12', rir: 2, sets: 3 }, isolation: { reps: '12-15', rir: 2, sets: 2 } },
  sport: { compound: { reps: '6-8', rir: 2, sets: 4 }, isolation: { reps: '10-12', rir: 1, sets: 3 } },
}

// --- HU month helpers (meso-planner.jsx:883-902) ---
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Adds whole weeks to a "<Mon> <day>" HU date string, rolling over month
 *  boundaries. e.g. addWeeks('Jún 16', 6) → 'Júl 28'. */
export function addWeeks(startDate: string, weeks: number): string {
  const parts = startDate.split(' ')
  let m = HU_MONTHS.indexOf(parts[0])
  let d = parseInt(parts[1], 10) + weeks * 7
  while (m >= 0 && d > HU_MONTH_DAYS[m]) {
    d -= HU_MONTH_DAYS[m]
    m = (m + 1) % 12
  }
  return `${HU_MONTHS[m]} ${d}`
}

/** Maps a "<Mon> <day>" HU date string to its season label. */
export function getSeason(startDate: string): string {
  const m = startDate.split(' ')[0]
  if (['Már', 'Ápr', 'Máj'].includes(m)) return 'Tavasz'
  if (['Jún', 'Júl', 'Aug'].includes(m)) return 'Nyár'
  if (['Szep', 'Okt', 'Nov'].includes(m)) return 'Ősz'
  return 'Tél'
}

// --- program generation -------------------------------------------------

// A generated day extends MesoDay; rest/sport days carry an empty exercise list.
export type PlannerDay = MesoDay

type Niggle = string | null | undefined

interface DayTemplate {
  day: string
  type: string
  muscle: string
  note?: string
}

// Day-type → exercise list builders (meso-planner.jsx:803-848). Each builder
// returns the base exercise definitions (name/muscle/kind + optional niggle
// warning); set/rep schemes are layered on afterwards from SCHEMES.
interface ExerciseSeed {
  name: string
  muscle: string
  // The generator only deals set/rep schemes to compound/isolation work — plyo
  // exercises enter a day via the picker, never via generateProgram.
  type: Exclude<ExerciseKind, 'plyo'>
  warning?: string
}

function exercisesForDay(baseType: string, niggle: Niggle): ExerciseSeed[] {
  const isShoulder = niggle === 'shoulder'
  switch (baseType) {
    case 'Pull':
      return [
        { name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound' },
        { name: 'Lat Pulldown · Pronated', muscle: 'lats', type: 'compound', ...(isShoulder ? { warning: 'Pronated grif · csukló-kíméletes' } : {}) },
        { name: 'Cable Pull-Around', muscle: 'back-mid', type: 'isolation' },
        { name: 'Hammer Curl', muscle: 'biceps', type: 'isolation' },
        { name: 'Face Pull', muscle: 'rear-delt', type: 'isolation' },
      ]
    case 'Push':
      return [
        { name: 'Barbell Bench Press', muscle: 'chest', type: 'compound' },
        { name: 'Incline DB Press', muscle: 'chest', type: 'compound' },
        { name: 'Overhead Press', muscle: 'shoulder', type: 'compound', ...(isShoulder ? { warning: 'Cable variánssal helyettesítve' } : {}) },
        { name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation' },
        { name: 'Tricep Pushdown', muscle: 'triceps', type: 'isolation' },
      ]
    case 'Legs':
      return [
        { name: 'Barbell Squat', muscle: 'quad', type: 'compound' },
        { name: 'Romanian Deadlift', muscle: 'ham', type: 'compound' },
        { name: 'Leg Press', muscle: 'quad', type: 'compound' },
        { name: 'Leg Curl', muscle: 'ham', type: 'isolation' },
        { name: 'Hip Thrust', muscle: 'glute', type: 'compound' },
        { name: 'Standing Calf Raise', muscle: 'calf', type: 'isolation' },
      ]
    case 'Upper':
      return [
        { name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound' },
        { name: 'Barbell Bench Press', muscle: 'chest', type: 'compound' },
        { name: 'Lat Pulldown · Pronated', muscle: 'lats', type: 'compound', ...(isShoulder ? { warning: 'Pronated grif' } : {}) },
        { name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation' },
        { name: 'Hammer Curl', muscle: 'biceps', type: 'isolation' },
        { name: 'Tricep Pushdown', muscle: 'triceps', type: 'isolation' },
      ]
    case 'Lower':
      return [
        { name: 'Barbell Squat', muscle: 'quad', type: 'compound' },
        { name: 'Romanian Deadlift', muscle: 'ham', type: 'compound' },
        { name: 'Leg Press', muscle: 'quad', type: 'compound' },
        { name: 'Leg Curl', muscle: 'ham', type: 'isolation' },
        { name: 'Hip Thrust', muscle: 'glute', type: 'compound' },
      ]
    case 'Full':
      return [
        { name: 'Barbell Squat', muscle: 'quad', type: 'compound' },
        { name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound' },
        { name: 'Barbell Bench Press', muscle: 'chest', type: 'compound' },
        { name: 'Romanian Deadlift', muscle: 'ham', type: 'compound' },
        { name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation' },
      ]
    default:
      return exercisesForDay('Pull', niggle)
  }
}

// 7-day split templates (meso-planner.jsx:729-775). Keyed by split label.
const SPLIT_TEMPLATES: Record<string, DayTemplate[]> = {
  'Pull / Push / Legs': [
    { day: 'Hét', type: 'Push', muscle: 'chest+shoulder+tricep' },
    { day: 'Kedd', type: 'Pull', muscle: 'back+bicep' },
    { day: 'Sze', type: 'Legs', muscle: 'quad+ham+glute' },
    { day: 'Csü', type: 'Push', muscle: 'chest+shoulder+tricep' },
    { day: 'Pén', type: 'Pull', muscle: 'back+bicep' },
    { day: 'Szo', type: 'Legs · light', muscle: 'quad+ham+glute' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
  'Upper / Lower': [
    { day: 'Hét', type: 'Upper', muscle: 'back+chest+shoulder+arms' },
    { day: 'Kedd', type: 'Lower', muscle: 'quad+ham+glute' },
    { day: 'Sze', type: 'Rest', muscle: '' },
    { day: 'Csü', type: 'Upper', muscle: 'back+chest+shoulder+arms' },
    { day: 'Pén', type: 'Lower', muscle: 'quad+ham+glute' },
    { day: 'Szo', type: 'Rest', muscle: '' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
  'Full body': [
    { day: 'Hét', type: 'Full · A', muscle: 'full' },
    { day: 'Kedd', type: 'Rest', muscle: '' },
    { day: 'Sze', type: 'Full · B', muscle: 'full' },
    { day: 'Csü', type: 'Rest', muscle: '' },
    { day: 'Pén', type: 'Full · A', muscle: 'full' },
    { day: 'Szo', type: 'Full · B', muscle: 'full' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
  'Upper / Lower / Sport': [
    { day: 'Hét', type: 'Upper', muscle: 'back+chest+shoulder+arms' },
    { day: 'Kedd', type: 'Volleyball', muscle: 'sport' },
    { day: 'Sze', type: 'Lower', muscle: 'quad+ham+glute' },
    { day: 'Csü', type: 'Volleyball', muscle: 'sport' },
    { day: 'Pén', type: 'Upper', muscle: 'back+chest+shoulder+arms' },
    { day: 'Szo', type: 'Volleyball', muscle: 'sport' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
  Custom: [
    { day: 'Hét', type: 'Body A', muscle: 'custom' },
    { day: 'Kedd', type: 'Rest', muscle: '' },
    { day: 'Sze', type: 'Body B', muscle: 'custom' },
    { day: 'Csü', type: 'Rest', muscle: '' },
    { day: 'Pén', type: 'Body A', muscle: 'custom' },
    { day: 'Szo', type: 'Rest', muscle: '' },
    { day: 'Vas', type: 'Rest', muscle: '' },
  ],
}

const BASE_TYPES = ['Pull', 'Push', 'Legs', 'Upper', 'Lower', 'Full'] as const

const isTrainingType = (t: string) => t !== 'Rest' && t !== 'Volleyball'

/** Split label → 7-day template with the training days trimmed to `days` (light days first). */
function trimmedTemplate(split: SplitOption | string | null, days: number): DayTemplate[] {
  const splitLabel = typeof split === 'string' ? split : (split?.label ?? '')
  // "Custom split" → "Custom" template key.
  const templateKey = splitLabel === 'Custom split' ? 'Custom' : splitLabel
  const template = SPLIT_TEMPLATES[templateKey] ?? SPLIT_TEMPLATES['Pull / Push / Legs']

  const trainingCount = template.filter((d) => isTrainingType(d.type)).length
  if (trainingCount <= days) return template
  let toRemove = trainingCount - days
  return template.map((d) => {
    if (toRemove > 0 && isTrainingType(d.type) && d.type.includes('light')) {
      toRemove--
      return { day: d.day, type: 'Rest', muscle: '', note: 'Pihenőnap' }
    }
    return d
  })
}

/** Default gym-weekday selection for a split + day count: the template's training days,
 *  padded from its rest then volleyball days when the template is thinner than `days`
 *  (Upper/Lower/Sport defines only 3 gym days), capped at `days`, week-ordered. */
export function defaultWeekdays({ split, days }: { split: SplitOption | string | null; days: number }): string[] {
  const template = trimmedTemplate(split, days)
  const training = template.filter((d) => isTrainingType(d.type)).map((d) => d.day)
  const rest = template.filter((d) => d.type === 'Rest').map((d) => d.day)
  const volleyball = template.filter((d) => d.type === 'Volleyball').map((d) => d.day)
  const picked = [...training, ...rest, ...volleyball].slice(0, days)
  return DAY_ORDER.filter((d) => picked.includes(d))
}

export interface GenerateProgramArgs {
  goal: GoalPreset | null
  split: SplitOption | string | null
  days: number
  /** Selected gym weekdays ('Hét'..'Vas'). When set, the training sequence lands on these
   *  days (cycling if more days than the split defines); template volleyball days that were
   *  not selected stay volleyball, everything else rests. Absent → template weekdays. */
  weekdays?: string[]
  niggle?: Niggle
}

/** Builds the 7-day program for a goal + split + day-count + niggle context.
 *  Applies the goal's set/rep scheme to each exercise and injects niggle-aware
 *  substitution warnings (Overhead Press / Lat Pulldown on shoulder niggle). */
export function generateProgram({ goal, split, days, weekdays, niggle }: GenerateProgramArgs): PlannerDay[] {
  const template = trimmedTemplate(split, days)
  const scheme = SCHEMES[goal?.id ?? ''] ?? SCHEMES.hypertrophy

  const restDay = (day: string, note?: string): PlannerDay =>
    ({ day, type: 'Rest', muscle: '', exerciseCount: 0, exercises: [], note: note ?? 'Pihenőnap' })

  const trainingDay = (d: DayTemplate): PlannerDay => {
    const baseType = BASE_TYPES.find((t) => d.type.startsWith(t)) ?? 'Pull'
    const isLight = d.type.includes('light')
    let exercises: GymExercise[] = exercisesForDay(baseType, niggle).map((seed, i) => {
      const s = scheme[seed.type]
      const sets = isLight ? Math.max(2, s.sets - 1) : s.sets
      const ex: GymExercise = {
        id: `gen-${d.day}-${i}`,
        name: seed.name,
        muscle: seed.muscle,
        type: seed.type,
        sets,
        targetReps: s.reps,
        targetRIR: isLight ? s.rir + 1 : s.rir,
      }
      if (seed.warning) ex.warning = seed.warning
      return ex
    })
    if (isLight) exercises = exercises.slice(0, Math.max(3, exercises.length - 1))

    return { ...d, exerciseCount: exercises.length, exercises }
  }

  if (!weekdays) {
    return template.map((d): PlannerDay => {
      if (d.type === 'Rest') return { ...restDay(d.day, d.note), muscle: d.muscle }
      if (d.type === 'Volleyball') return { ...d, exerciseCount: 0, exercises: [], note: 'Sport day · volleyball' }
      return trainingDay(d)
    })
  }

  // Selected-weekday placement: the trimmed training sequence lands on the chosen days in
  // week order, cycling when more days are picked than the split defines; non-selected
  // template volleyball days stay volleyball, everything else rests.
  const sequence = template.filter((d) => isTrainingType(d.type))
  let next = 0
  return DAY_ORDER.map((dayKey): PlannerDay => {
    if (weekdays.includes(dayKey) && sequence.length > 0) {
      const src = sequence[next % sequence.length]
      next++
      return trainingDay({ ...src, day: dayKey })
    }
    const templ = template.find((d) => d.day === dayKey)
    if (templ?.type === 'Volleyball') {
      return { ...templ, exerciseCount: 0, exercises: [], note: 'Sport day · volleyball' }
    }
    return restDay(dayKey)
  })
}
