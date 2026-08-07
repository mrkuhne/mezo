import { describe, expect, test } from 'vitest'
import { GOAL_PRESETS, SPLITS } from '@/data/train/train'
import { addWeeks, defaultWeekdays, generateProgram, getSeason, stepLabels } from '@/features/train/logic/planner'
import { structureLint, type StructureFinding } from '@/features/train/logic/structureLint'
import { BUDGET_GROUP_LABELS, GROUP_MEV, muscleBudgets } from '@/features/train/logic/setBudget'
import { FIT_CEILING } from '@/features/train/logic/programFit'

describe('addWeeks', () => {
  test('adds whole weeks across HU month boundaries', () => {
    // Jún 16 + 6 weeks (42 days) = Jún 58 → Jún has 30 days → Júl 28
    expect(addWeeks('Jún 16', 6)).toBe('Júl 28')
  })

  test('stays within the month when no overflow', () => {
    expect(addWeeks('Jún 1', 1)).toBe('Jún 8')
  })
})

describe('getSeason', () => {
  test('maps HU month to season', () => {
    expect(getSeason('Jún 16')).toBe('Nyár')
    expect(getSeason('Ápr 2')).toBe('Tavasz')
    expect(getSeason('Okt 9')).toBe('Ősz')
    expect(getSeason('Jan 1')).toBe('Tél')
  })
})

describe('stepLabels', () => {
  test('is the verbatim 4-step label list', () => {
    expect(stepLabels).toEqual(['Cél', 'Hossz + fázisok', 'Split + napok', 'Program'])
  })
})

describe('generateProgram', () => {
  test('builds 7 day templates and injects the niggle warning on the relevant exercise', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[0],
      split: SPLITS[0],
      days: 5,
      niggle: 'shoulder',
    })
    expect(program).toHaveLength(7)

    const allExercises = program.flatMap((d) => d.exercises)
    const overhead = allExercises.find((e) => e.name === 'Overhead Press')
    expect(overhead).toBeDefined()
    expect(overhead?.warning).toBe('Cable variánssal helyettesítve')

    // PPL "Pull" day uses the longer wrist-friendly copy; the U/L "Upper" day
    // uses the shorter 'Pronated grif'. PPL is the split under test here.
    const latPulldown = allExercises.find((e) => e.name === 'Lat Pulldown · Pronated')
    expect(latPulldown?.warning).toBe('Pronated grif · csukló-kíméletes')
  })

  test('does not inject niggle warnings when niggle is absent', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[0],
      split: SPLITS[0],
      days: 5,
      niggle: null,
    })
    const overhead = program.flatMap((d) => d.exercises).find((e) => e.name === 'Overhead Press')
    expect(overhead?.warning).toBeUndefined()
  })

  test('generates the Láb+Plyo/Felső split with a weightless plyo lead and 6-8/RIR0 working sets', () => {
    const days = generateProgram({
      goal: GOAL_PRESETS.find((g) => g.id === 'erohipertrofia')!,
      split: 'Láb+Plyo / Felső', days: 4,
    })
    const lower = days.find((d) => d.type.startsWith('Láb+Plyo A'))!
    const plyo = lower.exercises[0]
    expect(plyo.type).toBe('plyo')
    expect(plyo.warmupSets).toBe(0)
    const squat = lower.exercises.find((e) => e.name === 'Barbell Squat')!
    expect([squat.repMin, squat.repMax]).toEqual([6, 8])
    expect(squat.targetRIR).toBe(0)
    expect(lower.exercises.length).toBeGreaterThanOrEqual(6)
  })

  // Hand-derived pin (mezo-oyhy.6): hypertrophy PPL-5 Hét (1st Push day), traced through all
  // 3 fitProgram phases by hand — see docs/superpowers/sdd/2026-08-07-generator-fitter/
  // task-2-report.md for the full derivation. Scheme (SCHEMES.hypertrophy): compound
  // {reps:8-10,rir:1,sets:4}, isolation {reps:10-12,rir:1,sets:3}; both RIR<=1 -> failure
  // style everywhere (cost 1/12/set). PPL-5 keeps Push x2 (Hét,Csü), Pull x2 (Kedd,Pén),
  // Legs x1 (Sze) — 'Legs · light' is trimmed to Rest at 5 days (trimmedTemplate only removes
  // light-labelled days).
  //
  // Phase 1 (rep-zone, per group in day-encounter order, slot0 keeps base range):
  //  - chest (Bench Hét, Incline Hét, Bench Csü, Incline Csü): base 8-10 -> heavy (repMax<=10)
  //    -> shift.heavy.compound=[12,15]. slot0 Bench-Hét stays 8-10; slot1 Incline-Hét (odd)
  //    -> 12-15; slot2 Bench-Csü (even) resets to 8-10; slot3 Incline-Csü (odd) -> 12-15.
  //  - shoulder (Overhead-Hét, Lateral-Hét, FacePull-Kedd, Overhead-Csü, Lateral-Csü,
  //    FacePull-Pén): slot0 Overhead-Hét keeps 8-10. Every OTHER slot is isolation in the
  //    'shoulder' group (Lateral Raise, Face Pull/rear-delt) -> the shoulder-isolation
  //    override fires unconditionally (varyRepZones, programFit.ts) -> 20-25 regardless of
  //    parity. So Lateral-Hét (slot1) -> 20-25.
  //  - triceps (Pushdown-Hét, OverheadExt-Hét, Pushdown-Csü, OverheadExt-Csü): base 10-12 ->
  //    moderate -> shift.moderate.isolation=[20,25]. slot0 Pushdown-Hét stays 10-12; slot1
  //    OverheadExt-Hét (odd) -> 20-25.
  //
  // Phase 2 (volume fit, alphabetical group order — chest, shoulder(rear-delt maps here too),
  // triceps all already >= their MEV, so only the trim-to-ceiling loop runs, floor 2):
  //  - chest: 4 slots x 4 sets = 16 sets / 12 (all failure) = 1.333. Trim picks the
  //    highest-sets/latest-day/latest-exIdx slot each round; by the time budget < 0.85 (10/12
  //    = 0.833) Hét's 2 exercises have been decremented ONCE each (4->3), Csü's TWICE each
  //    (4->2) — Hét ends at Bench=3, Incline=3 (Csü ends at 2/2, matching the trim's
  //    later-day-first tie-break).
  //  - shoulder: 6 slots, sets 4+3+3+4+3+3=20/12=1.667. Trimming toward the floor empties
  //    every slot to 2 (12/12=1.0, still >= 0.85) with NO legal floor-only fit — last resort
  //    tryRemoveDuplicate (programFit.ts) fires: Csü's Lateral Raise (latest day+exIdx) is
  //    legal to drop (Csü still has Overhead Press for the day's frequency rule; 'Overhead
  //    Press'/'Face Pull' remain 2 distinct weekly names; Csü's Push list has 6 exercises so
  //    removal leaves 5, at the session-size floor) -> Csü loses Lateral Raise entirely, and
  //    remaining total 10/12=0.833 clears the ceiling in the same step. Hét's Overhead Press
  //    and Lateral Raise both land on the floor, 2 sets each (trimmed before the removal, same
  //    as every other still-present slot).
  //  - triceps: 4 slots x 3 sets =12/12=1.0. Trim empties Csü's 2 slots to 2 first (later day),
  //    reaching 10/12=0.833 before Hét is touched — Hét's Pushdown/OverheadExt stay at 3 each.
  //
  // Phase 3 (session-length guard): Hét's 6 exercises (3+3+2+2+3+3 sets, 2 warmup each, 90s
  // transition each) estimate to ~63 min — inside the 45-90 band, no adjustment.
  test('hypertrophy PPL-5 Hét (1st Push day): fully hand-derived exact fitted values', () => {
    const program = generateProgram({ goal: GOAL_PRESETS.find((g) => g.id === 'hypertrophy')!, split: SPLITS[0], days: 5 })
    const het = program.find((d) => d.day === 'Hét')!
    expect(het.type).toBe('Push')
    const byName = Object.fromEntries(het.exercises.map((e) => [e.name, e]))
    expect(byName['Barbell Bench Press']).toMatchObject({ workingSets: 3, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1 })
    expect(byName['Incline DB Press']).toMatchObject({ workingSets: 3, warmupSets: 2, repMin: 12, repMax: 15, targetRIR: 1 })
    expect(byName['Overhead Press']).toMatchObject({ workingSets: 2, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1 })
    expect(byName['Lateral Raise']).toMatchObject({ workingSets: 2, warmupSets: 2, repMin: 20, repMax: 25, targetRIR: 1 })
    expect(byName['Tricep Pushdown']).toMatchObject({ workingSets: 3, warmupSets: 2, repMin: 10, repMax: 12, targetRIR: 1 })
    expect(byName['Overhead Tricep Ext']).toMatchObject({ workingSets: 3, warmupSets: 2, repMin: 20, repMax: 25, targetRIR: 1 })
    expect(het.exercises).toHaveLength(6)
  })
})

describe('defaultWeekdays', () => {
  test('PPL with 5 days defaults to the template training weekdays', () => {
    expect(defaultWeekdays({ split: SPLITS[0], days: 5 })).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén'])
  })

  test('caps at the requested day count', () => {
    expect(defaultWeekdays({ split: SPLITS[0], days: 4 })).toEqual(['Hét', 'Kedd', 'Sze', 'Csü'])
  })

  test('pads thin templates (Upper/Lower/Sport has 3 gym days) up to the count, rest days first', () => {
    const days = defaultWeekdays({ split: 'Upper / Lower / Sport', days: 5 })
    expect(days).toHaveLength(5)
    expect(days).toEqual(['Hét', 'Kedd', 'Sze', 'Pén', 'Vas']) // Hét/Sze/Pén gym + Vas rest-pad + Kedd vb-pad, week-ordered
  })
})

describe('generateProgram · weekdays placement', () => {
  test('puts the training sequence on the selected weekdays, everything else rests', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[0], split: SPLITS[0], days: 3,
      weekdays: ['Kedd', 'Csü', 'Szo'], niggle: null,
    })
    expect(program).toHaveLength(7)
    const byDay = Object.fromEntries(program.map((d) => [d.day, d]))
    expect(byDay['Kedd'].type).toBe('Push')
    expect(byDay['Csü'].type).toBe('Pull')
    expect(byDay['Szo'].type).toBe('Legs')
    for (const off of ['Hét', 'Sze', 'Pén', 'Vas']) {
      expect(byDay[off].type).toBe('Rest')
      expect(byDay[off].exercises).toHaveLength(0)
    }
  })

  test('keeps template volleyball days that were not selected as gym days', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[4], split: 'Upper / Lower / Sport', days: 3,
      weekdays: ['Hét', 'Sze', 'Pén'], niggle: null,
    })
    const byDay = Object.fromEntries(program.map((d) => [d.day, d]))
    expect(byDay['Kedd'].type).toBe('Volleyball')
    expect(byDay['Csü'].type).toBe('Volleyball')
    expect(byDay['Szo'].type).toBe('Volleyball')
    expect(byDay['Hét'].type).toBe('Upper')
    expect(byDay['Sze'].type).toBe('Lower')
  })

  test('cycles the training sequence when more days are selected than the split defines', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[4], split: 'Upper / Lower / Sport', days: 5,
      weekdays: ['Hét', 'Kedd', 'Sze', 'Pén', 'Vas'], niggle: null,
    })
    const types = program.filter((d) => d.exerciseCount > 0).map((d) => d.type)
    expect(types).toEqual(['Upper', 'Lower', 'Upper', 'Upper', 'Lower']) // 3-entry sequence cycled to 5
  })
})

describe('generateProgram · custom split', () => {
  test('custom days start empty (no auto-filled exercises), names cycle Body A/B', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[0], split: 'Custom split', days: 4,
      weekdays: ['Kedd', 'Csü', 'Szo', 'Vas'], niggle: null,
    })
    const byDay = Object.fromEntries(program.map((d) => [d.day, d]))
    expect(byDay['Kedd'].type).toBe('Body A')
    expect(byDay['Csü'].type).toBe('Body B')
    expect(byDay['Szo'].type).toBe('Body A')
    expect(byDay['Vas'].type).toBe('Body A') // 3-entry template cycles: A,B,A -> 4th = A
    for (const d of ['Kedd', 'Csü', 'Szo', 'Vas']) {
      expect(byDay[d].exercises).toHaveLength(0) // the user picks — no auto-fill
      expect(byDay[d].exerciseCount).toBe(0)
    }
  })

  test('non-custom splits keep the auto-filled exercises', () => {
    const program = generateProgram({
      goal: GOAL_PRESETS[0], split: SPLITS[0], days: 5,
      weekdays: ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén'], niggle: null,
    })
    const trainings = program.filter((d) => d.type !== 'Rest' && d.type !== 'Volleyball')
    expect(trainings.every((d) => d.exercises.length > 0)).toBe(true)
  })
})

// ============================================================
// Calibrated invariant suite (mezo-oyhy.6, amendment 2026-08-07) — see the "Amendment" section
// of docs/superpowers/specs/2026-08-07-generator-fitter-design.md. The first invariant run
// found the original "structureLint === [] everywhere" goal partly wrong: several findings
// encode a SPLIT-INHERENT trade-off (a thin day-count training legs 1x/week, a repeated
// day-type sharing one movement list) that the lint exists to surface, not hide. Resolution:
//  - Rule families the fitter is actually responsible for (rep-zone, sets-per-exercise,
//    session-size, session-length, exercises-per-muscle) must be clean on EVERY combo — a
//    finding here is a fitProgram/template bug, never allowlisted.
//  - `frequency` / `variety` / `push-pull` / `ham-quad` findings may appear ONLY on a combo
//    (+rule+group) listed in STRUCTURAL_ALLOWED, with a comment naming the trade-off.
//  - `sets ≥ GROUP_MEV[group]` may be waived ONLY via MEV_ALLOWED (arithmetic comment proving
//    every slot of the group is already saturated at its SETS_PER_EXERCISE kind cap).
//  - `budget ≤ 1.0` stays hard, unconditionally, for every group.
//  - The soft ceiling (`budget < FIT_CEILING`) keeps its own NEAR_ALLOWED (floor-arithmetic
//    comment), unchanged in mechanism from the original design.
// ============================================================
const HARD_CLEAN_RULES = new Set(['rep-zone', 'sets-per-exercise', 'session-size', 'session-length', 'exercises-per-muscle'])
const STRUCTURAL_RULES = new Set(['frequency', 'variety', 'push-pull', 'ham-quad'])
const ALL_GOAL_IDS = GOAL_PRESETS.map((g) => g.id)
const GROUP_LABEL_TO_KEY = Object.fromEntries(Object.entries(BUDGET_GROUP_LABELS).map(([k, v]) => [v, k]))

// Split-inherent frequency/variety/push-pull/ham-quad findings. Key:
// `${goalId}|${splitLabel}|${days}|${rule}` (push-pull/ham-quad, no group) or
// `${goalId}|${splitLabel}|${days}|${rule}|${group}` (frequency/variety).
const STRUCTURAL_ALLOWED = new Set<string>()
function allowStructural(rule: string, group: string | null, splitLabel: string, days: number[], goalIds: string[]) {
  for (const goalId of goalIds) for (const d of days) STRUCTURAL_ALLOWED.add([goalId, splitLabel, d, rule, group].filter((v) => v !== null).join('|'))
}
// PPL / Upper-Lower-Sport at 4/5 days: trimmedTemplate (planner.ts) only trims light-labelled
// days, so at these day counts the split's single non-light Legs-type day ('Legs' / 'Lower')
// is the ONLY weekly leg session — quad/ham/glute train 1x/week by the split's own day-count
// choice (PPL 6-day keeps both Legs + Legs · light, clearing this). The lint is truthful.
for (const splitLabel of ['Pull / Push / Legs', 'Upper / Lower / Sport']) {
  for (const group of ['quad', 'ham', 'glute']) allowStructural('frequency', group, splitLabel, [4, 5], ALL_GOAL_IDS)
}
// Láb+Plyo / Felső (single 4-day option): glute is sourced only from Láb+Plyo B (Hip Thrust +
// Bulgarian Split Squat), the split's only glute-bearing day — same single-leg-day trade-off.
allowStructural('frequency', 'glute', 'Láb+Plyo / Felső', [4], ALL_GOAL_IDS)
// Full body: Full · A sources quad (Barbell Squat) and Full · B sources glute (Hip Thrust) —
// each lives in only ONE of the two 5-exercise A/B lists, so each reads 1 distinct weekly name
// once sets cross the variety gate. A differently-named 2nd quad/glute movement in the other
// list would clear it, but Full · B was curated to the coordinator-specified 5 exercises
// (chest/lats/glute/ham/rear-delt) and wasn't expanded further in this pass.
for (const group of ['quad', 'glute']) allowStructural('variety', group, 'Full body', [3, 4, 5], ALL_GOAL_IDS)
// Upper/Lower(/Sport): 'Upper' runs 2x/week with a single triceps exercise (Tricep Pushdown) —
// chest/shoulder got a 2nd distinct name in this curation pass (Incline DB Press / Face Pull,
// session size then at the 9-exercise band max), triceps did not (a 10th exercise would have
// exceeded SESSION_SIZE.max). The fitter's session-length guard happens to trim triceps under
// the variety gate (<6 weekly sets) for every goal except strength's higher isolation-adjacent
// compound volume, where 6 sets survive and the split-inherent single-name repeat surfaces.
allowStructural('variety', 'triceps', 'Upper / Lower', [3, 4], ['strength'])
allowStructural('variety', 'triceps', 'Upper / Lower / Sport', [4, 5], ['strength'])

// MEV shortfalls where every slot of the group is already saturated at its
// SETS_PER_EXERCISE kind cap — arithmetic proves the floor is unreachable given the
// template's slot count, not a fitter bug. Key: `${goalId}|${splitLabel}|${days}|${group}`.
const MEV_ALLOWED = new Set<string>()
function allowMev(group: string, splitLabel: string, days: number[], goalIds: string[]) {
  for (const goalId of goalIds) for (const d of days) MEV_ALLOWED.add(`${goalId}|${splitLabel}|${d}|${group}`)
}
// calf: PPL 4/5-day only ever has the (non-light) 'Legs' day — 1 isolation slot (Standing Calf
// Raise) x SETS_PER_EXERCISE.isolation.max 3 = 3 < GROUP_MEV.calf 4. The 2nd, differently-named
// calf slot lives on 'Legs · light', which only survives trimmedTemplate at PPL 6-day.
allowMev('calf', 'Pull / Push / Legs', [4, 5], ALL_GOAL_IDS)
// biceps: Láb+Plyo/Felső's only day-count (4) gives biceps exactly 2 isolation slots (Hammer
// Curl on Felső A, Incline Curl on Felső B) x cap 3 = 6 < GROUP_MEV.biceps 8 — already 2
// distinct names (variety is fine), just short on volume; a 3rd slot wasn't added in this pass.
allowMev('biceps', 'Láb+Plyo / Felső', [4], ALL_GOAL_IDS)

// Combos whose template floor structure cannot reach the soft ceiling — each entry must carry
// a derivation comment. Key: `${goalId}|${splitLabel}|${days}|${group}`. Empty after this
// curation pass: the original documented "6-day PPL back" case was resolved as a side effect
// of the Pull-day biceps curation (Incline Curl brought Pull to 6 exercises, which raised the
// last-resort duplicate-removal's session-size floor enough to legalize trimming 'back' below
// the ceiling); no other combo needs it. Mechanism kept for future template drift.
const NEAR_ALLOWED = new Set<string>([])

describe('generator invariants (mezo-oyhy.6)', () => {
  for (const goal of GOAL_PRESETS) {
    for (const split of SPLITS) {
      for (const d of split.days) {
        const label = `${goal.id} · ${split.label} · ${d}d`
        if (split.label === 'Custom split') {
          test(`${label}: custom days pass through empty`, () => {
            const prog = generateProgram({ goal, split, days: d })
            for (const pd of prog) expect(pd.exercises).toHaveLength(0)
          })
          continue
        }
        test(`${label}: fitter-hard-clean, structural findings allowlisted, MEV/ceiling honoured`, () => {
          const prog = generateProgram({ goal, split, days: d })
          for (const f of structureLint(prog) as StructureFinding[]) {
            if (HARD_CLEAN_RULES.has(f.rule)) {
              throw new Error(`fitter-addressable finding [${f.rule}] on ${label}: ${f.label}`)
            }
            if (!STRUCTURAL_RULES.has(f.rule)) {
              throw new Error(`unexpected structureLint rule '${f.rule}' on ${label}: ${f.label}`)
            }
            const groupLabel = f.label.split(':')[0]
            const group = GROUP_LABEL_TO_KEY[groupLabel] ?? null
            const key = [goal.id, split.label, d, f.rule, group].filter((v) => v !== null).join('|')
            expect(STRUCTURAL_ALLOWED.has(key), `unallowlisted structural finding ${key}: ${f.label}`).toBe(true)
          }
          for (const row of muscleBudgets(prog)) {
            expect(row.budget).toBeLessThanOrEqual(1)
            const mev = GROUP_MEV[row.group]
            if (mev !== undefined) {
              if (row.workingSets < mev) {
                const mevKey = `${goal.id}|${split.label}|${d}|${row.group}`
                expect(MEV_ALLOWED.has(mevKey), `unallowlisted MEV shortfall ${mevKey}: ${row.workingSets} < ${mev}`).toBe(true)
              }
              if (!NEAR_ALLOWED.has(`${goal.id}|${split.label}|${d}|${row.group}`)) {
                expect(row.budget).toBeLessThan(FIT_CEILING)
              }
            }
          }
        })
      }
    }
  }

  test('niggle warnings survive fitting', () => {
    const goal = GOAL_PRESETS.find((g) => g.id === 'hypertrophy')!
    const prog = generateProgram({ goal, split: 'Pull / Push / Legs', days: 5, niggle: 'shoulder' })
    const warned = prog.flatMap((pd) => pd.exercises).filter((e) => e.warning)
    expect(warned.length).toBeGreaterThan(0)
  })
})
