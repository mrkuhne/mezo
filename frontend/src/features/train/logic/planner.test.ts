import { afterAll, describe, expect, test } from 'vitest'
import { GOAL_PRESETS, SPLITS } from '@/data/train/train'
import { addWeeks, defaultWeekdays, generateProgram, getSeason, stepLabels } from '@/features/train/logic/planner'
import { structureLint, type StructureFinding } from '@/features/train/logic/structureLint'
import { BUDGET_GROUP_LABELS, GROUP_MEV, budgetOf, muscleBudgets } from '@/features/train/logic/setBudget'
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
  test('is the 5-step label list, Fókusz inserted before Program (mezo-3m5m)', () => {
    expect(stepLabels).toEqual(['Cél', 'Hossz + fázisok', 'Split + napok', 'Fókusz', 'Program'])
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
//  - `budget ≤ 1.0` stays hard, unconditionally, for every group — the FATIGUE budget
//    (`budgetOf(failureSets, volumeSets)`, the shared 12/20 caps programFit.ts itself targets),
//    NOT `muscleBudgets`' row.budget (tier-relative since mezo-3m5m, spec GD5 — the budget CARD's
//    scale, not the generator's).
//  - The soft ceiling (`budget < FIT_CEILING`) keeps its own NEAR_ALLOWED (floor-arithmetic
//    comment), unchanged in mechanism from the original design — same fatigue-budget quantity.
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
// (chest/lats/glute/ham/rear-delt) and wasn't expanded further in this pass. quad stays
// variety-shaped at every day count (Full · A always runs >=2x/week here). glute is
// variety-shaped only at 4/5d — at 3d (mezo-jpxl) the trimmedTemplate end-trim (planner.ts)
// drops Full · B to a single weekly occurrence, so the SAME split-inherent gap surfaces as
// 'frequency' (single day) instead of 'variety' (single name); see the frequency|glute FB[3]
// entry below.
allowStructural('variety', 'quad', 'Full body', [3, 4, 5], ALL_GOAL_IDS)
allowStructural('variety', 'glute', 'Full body', [4, 5], ALL_GOAL_IDS)
// Upper/Lower(/Sport): 'Upper' runs 2x/week with a single triceps exercise (Tricep Pushdown) —
// chest/shoulder got a 2nd distinct name in this curation pass (Incline DB Press / Face Pull,
// session size then at the 9-exercise band max), triceps did not (a 10th exercise would have
// exceeded SESSION_SIZE.max). The fitter's session-length guard happens to trim triceps under
// the variety gate (<6 weekly sets) for every goal except strength's higher isolation-adjacent
// compound volume, where 6 sets survive and the split-inherent single-name repeat surfaces.
allowStructural('variety', 'triceps', 'Upper / Lower', [3, 4], ['strength'])
allowStructural('variety', 'triceps', 'Upper / Lower / Sport', [4, 5], ['strength'])

// mezo-jpxl: trimmedTemplate's new end-trim stage (planner.ts) now correctly caps
// template-path training-day counts at `days` for splits without enough light days — for these
// 3 combos the no-weekdays template path becomes BYTE-IDENTICAL to the weekdays path (verified
// by direct comparison, not assumed), so every finding already documented in the WD_* allowlist
// below for the SAME combo re-derives here unchanged; comments here summarize, see the WD_*
// block for the full derivation of each trade-off.
//
// PPL @ 4d (toRemove=2: light Szo trimmed first, then the end-trim drops Pén, the 2nd Pull) —
// now Push x2 (Hét,Csü), Pull x1 (Kedd), Legs x1 (Sze): back + biceps (Pull-only) join the
// already-allowlisted quad/ham/glute (Legs-only) as single-day-frequency groups.
for (const group of ['back', 'biceps']) allowStructural('frequency', group, 'Pull / Push / Legs', [4], ALL_GOAL_IDS)
// Same Push x2 / Pull x1 skew pushes push:pull outside the ±1.6 silence band for the same 3
// goals as the WD PPL[4] entry (measured): cut-prep 1.8, recovery 1.7, sport 1.9.
allowStructural('push-pull', null, 'Pull / Push / Legs', [4], ['cut-prep', 'recovery', 'sport'])
// Upper / Lower @ 3d (toRemove=1, no light day to trim first, so the end-trim drops Pén, the
// 2nd Lower) — now Upper x2 (Hét,Csü), Lower x1 (Kedd): quad/ham/glute (Lower-only) read every
// weekly set on the single Kedd session.
for (const group of ['quad', 'ham', 'glute']) allowStructural('frequency', group, 'Upper / Lower', [3], ALL_GOAL_IDS)
// Full body @ 3d (toRemove=1, no light day, end-trim drops Szo, the 2nd Full · B) — now
// Full · A x2 (Hét,Pén), Full · B x1 (Sze): glute (Full · B-only) reads every weekly set on Sze.
allowStructural('frequency', 'glute', 'Full body', [3], ALL_GOAL_IDS)

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
// mezo-jpxl: PPL @ 4d's new Pull x1/week (see frequency entry above) halves biceps' weekly
// slots from 4 to 2 (Hammer Curl + Incline Curl) x cap 3 = 6 < GROUP_MEV.biceps 8 — same
// arithmetic as the WD PPL[4] biceps entry, now also true on the template path.
allowMev('biceps', 'Pull / Push / Legs', [4], ALL_GOAL_IDS)
// mezo-jpxl: Full body @ 3d's new Full · B x1/week (see frequency entry above) halves glute's
// only slot (Hip Thrust, 4 sets) — 4 < GROUP_MEV.glute 6 — same arithmetic as the WD FB[3]
// glute entry, now also true on the template path.
allowMev('glute', 'Full body', [3], ALL_GOAL_IDS)
// mezo-d20.14 (wizard v2 redesign): SESSION_MUSCLE_CAP tightened 11→8. Back trains only on
// the single weekly Pull day at PPL@4d (see the frequency|back entry above), so the cap now
// bounds its WEEKLY total too — fitVolume's topping loop can only add a set while
// daySetsForGroup+1 <= 8, so it stalls at 8 or 9, both < GROUP_MEV.back 10. cut-prep's lower
// -RIR seed starts one set higher than recovery/erohipertrofia's, landing on 9 vs 8 (measured
// actual output: cut-prep back:9, recovery back:8, erohipertrofia back:8 — hypertrophy/
// strength/sport's own baseline seeds already clear 10 before the cap is ever consulted).
allowMev('back', 'Pull / Push / Legs', [4], ['cut-prep', 'recovery', 'erohipertrofia'])

// Combos whose template floor structure cannot reach the soft ceiling — each entry must carry
// a derivation comment. Key: `${goalId}|${splitLabel}|${days}|${group}`. Empty after this
// curation pass: the original documented "6-day PPL back" case was resolved as a side effect
// of the Pull-day biceps curation (Incline Curl brought Pull to 6 exercises, which raised the
// last-resort duplicate-removal's session-size floor enough to legalize trimming 'back' below
// the ceiling); no other combo needs it. Mechanism kept for future template drift.
const NEAR_ALLOWED = new Set<string>([])

// Finding 2 (mezo-oyhy.6 fix wave): every ALLOWED entry must be exercised at least once by the
// sweep(s) below — a key nothing ever looks up is stale (template drift moved past it) and
// should be deleted, not silently kept. Tracked centrally so both the no-weekdays and the
// weekdays sweep (below) feed the same afterAll check.
const structuralConsumed = new Set<string>()
const mevConsumed = new Set<string>()
const nearConsumed = new Set<string>()

/** Shared assertion body for one generated program against one (allowlist-set, consumed-set)
 *  triple — used by both the no-weekdays and the weekdays sweep below. */
function assertInvariants(
  prog: ReturnType<typeof generateProgram>,
  goalId: string,
  splitLabel: string,
  d: number,
  label: string,
  structuralAllowed: Set<string>,
  structConsumed: Set<string>,
  mevAllowed: Set<string>,
  mevCons: Set<string>,
  nearAllowed: Set<string>,
  nearCons: Set<string>,
) {
  for (const f of structureLint(prog) as StructureFinding[]) {
    if (HARD_CLEAN_RULES.has(f.rule)) {
      throw new Error(`fitter-addressable finding [${f.rule}] on ${label}: ${f.label}`)
    }
    if (!STRUCTURAL_RULES.has(f.rule)) {
      throw new Error(`unexpected structureLint rule '${f.rule}' on ${label}: ${f.label}`)
    }
    const groupLabel = f.label.split(':')[0]
    const group = GROUP_LABEL_TO_KEY[groupLabel] ?? null
    const key = [goalId, splitLabel, d, f.rule, group].filter((v) => v !== null).join('|')
    expect(structuralAllowed.has(key), `unallowlisted structural finding ${key}: ${f.label}`).toBe(true)
    structConsumed.add(key)
  }
  for (const row of muscleBudgets(prog)) {
    // The oracle is the FATIGUE budget the generator (programFit.groupStats) itself targets —
    // NOT row.budget, which is tier-relative since mezo-3m5m (spec GD5, the budget card's own
    // scale). Recompute it directly from the row's own failure/volume split.
    const fatigueBudget = budgetOf(row.failureSets, row.volumeSets)
    expect(fatigueBudget).toBeLessThanOrEqual(1)
    const mev = GROUP_MEV[row.group]
    if (mev !== undefined) {
      const groupKey = `${goalId}|${splitLabel}|${d}|${row.group}`
      if (row.workingSets < mev) {
        expect(mevAllowed.has(groupKey), `unallowlisted MEV shortfall ${groupKey}: ${row.workingSets} < ${mev}`).toBe(true)
        mevCons.add(groupKey)
      }
      if (!nearAllowed.has(groupKey)) {
        expect(fatigueBudget).toBeLessThan(FIT_CEILING)
      } else {
        nearCons.add(groupKey)
      }
    }
  }
}

// ============================================================
// Finding 1 (mezo-oyhy.6 fix wave): the wizard (MesocyclePlannerPage.tsx) always calls
// generateProgram with `weekdays: defaultWeekdays(...)` — the plain no-weekdays sweep above
// never exercises that path. The two diverge whenever the split's trimmed-template training-day
// count doesn't exactly equal `days`:
//  - No-weekdays path: trimmedTemplate only ever REMOVES light-labelled days: when a split has
//    no (or not enough) light days to remove, its training-day count can stay ABOVE `days`, and
//    generateProgram maps the template verbatim (every day placed) regardless.
//  - Weekdays path: defaultWeekdays first PICKS the template's training days, capped at `days`
//    — any training day past the cap is dropped entirely. generateProgram's weekday branch then
//    replays only the picked days from `sequence = template.filter(isTrainingType)`, cycling
//    with `next % sequence.length` when more weekdays are picked than the split defines. So a
//    picked-and-cycled day can literally duplicate an earlier day's type+exercises, and a
//    dropped day silently loses its type — this reshapes weekly frequency independently of the
//    no-weekdays template path, hence a fully separate WD_* allowlist below.
// Every entry keeps its own derivation comment, verified against defaultWeekdays' actual output
// (not hand-traced blind) the same way the hand-derived Hét pin above was.
// ============================================================
const WD_STRUCTURAL_ALLOWED = new Set<string>()
function wdAllowStructural(rule: string, group: string | null, splitLabel: string, days: number[], goalIds: string[]) {
  for (const goalId of goalIds) for (const d of days) WD_STRUCTURAL_ALLOWED.add([goalId, splitLabel, d, rule, group].filter((v) => v !== null).join('|'))
}
const WD_MEV_ALLOWED = new Set<string>()
function wdAllowMev(group: string, splitLabel: string, days: number[], goalIds: string[]) {
  for (const goalId of goalIds) for (const d of days) WD_MEV_ALLOWED.add(`${goalId}|${splitLabel}|${d}|${group}`)
}
const WD_NEAR_ALLOWED = new Set<string>()
function wdAllowNear(group: string, splitLabel: string, days: number[], goalIds: string[]) {
  for (const goalId of goalIds) for (const d of days) WD_NEAR_ALLOWED.add(`${goalId}|${splitLabel}|${d}|${group}`)
}
const wdStructuralConsumed = new Set<string>()
const wdMevConsumed = new Set<string>()
const wdNearConsumed = new Set<string>()

// PPL @ 4d, weekdays=[Hét,Kedd,Sze,Csü]: trimmedTemplate(PPL,4) can only remove the ONE
// light-labelled day (Szo 'Legs · light'), so it still carries 5 training days (Push,Pull,Legs,
// Push,Pull on Hét..Pén) — defaultWeekdays then caps the picked weekdays at days=4, so it takes
// the FIRST 4 training days and drops Pén (the 2nd Pull). generateProgram's weekday branch places
// Push(Hét),Pull(Kedd),Legs(Sze),Push(Csü) and — since Pén was never picked — converts Pén (a
// template Pull day) to Rest. Result: Push x2 (Hét,Csü), Pull x1 (Kedd), Legs x1 (Sze). back +
// biceps (Pull-only) and quad/ham/glute (Legs-only) each read every weekly set on ONE day.
for (const group of ['back', 'biceps', 'quad', 'ham', 'glute']) wdAllowStructural('frequency', group, 'Pull / Push / Legs', [4], ALL_GOAL_IDS)
// Same Pull x1/week drop (above): biceps' 2 isolation slots (Hammer Curl + Incline Curl) x cap
// 3 = 6 < GROUP_MEV.biceps 8 — the 2nd weekly Pull day that would have doubled it to 12 was the
// one dropped by the days=4 cap.
wdAllowMev('biceps', 'Pull / Push / Legs', [4], ALL_GOAL_IDS)
// Same Push x2 / Pull x1 skew (above) pushes the push:pull ratio itself outside the ±1.6 silence
// band for the 3 goals whose scheme yields a wide enough push/pull set gap (measured, not
// assumed): cut-prep 32/18=1.78→1.8, recovery 30/18=1.67→1.7, sport 36/19=1.89→1.9 — all >1.6.
// hypertrophy (28/18=1.556→1.6), strength (32/20=1.6→1.6) and erohipertrofia (26/18=1.44→1.4)
// round to <=1.6 and stay silent.
wdAllowStructural('push-pull', null, 'Pull / Push / Legs', [4], ['cut-prep', 'recovery', 'sport'])
// PPL @ 5d, weekdays=[Hét,Kedd,Sze,Csü,Pén]: trimmedTemplate(PPL,5) removes the same light day
// (toRemove=6-5=1, exactly matches the one available), leaving exactly 5 training days that
// defaultWeekdays picks in full (no drop) — the weekdays branch places them 1:1, identical to
// the no-weekdays template path at this day count. Pull now runs 2x (Kedd,Pén) same as Push
// (Hét,Csü); only Legs stays 1x/week — same single-leg-day trade-off as the no-weekdays PPL[4,5]
// entry above, now re-derived for the weekdays path's own allowlist.
for (const group of ['quad', 'ham', 'glute']) wdAllowStructural('frequency', group, 'Pull / Push / Legs', [5], ALL_GOAL_IDS)

// Upper / Lower @ 3d, weekdays=[Hét,Kedd,Csü]: trimmedTemplate(UL,3) has no light days to trim
// (Upper/Lower never carries a 'light' label), so it keeps all 4 template training days
// (Upper,Lower,Upper,Lower); defaultWeekdays caps at 3 and takes the first 3 (Upper,Lower,Upper),
// dropping Pén (2nd Lower) — the weekdays branch converts the dropped Pén (template Lower) to
// Rest. Result: Upper x2 (Hét,Csü), Lower x1 (Kedd) — quad/ham/glute (Lower-only) read every
// weekly set on the single Kedd session.
for (const group of ['quad', 'ham', 'glute']) wdAllowStructural('frequency', group, 'Upper / Lower', [3], ALL_GOAL_IDS)
// Upper / Lower @ 3d and 4d: 'Upper' runs 2x/week (both day counts — at 4d weekdays=[Hét,Kedd,
// Csü,Pén] picks all 4 training days in order, identical to the no-weekdays template path) with
// a single triceps exercise (Tricep Pushdown) — same split-inherent single-name repeat as the
// no-weekdays UL[3,4] entry above, surfacing only for strength's heavier isolation-adjacent
// volume (6+ weekly sets clears the variety gate; every other goal's session-length trim keeps
// triceps under it).
wdAllowStructural('variety', 'triceps', 'Upper / Lower', [3, 4], ['strength'])

// Full body @ 3d, weekdays=[Hét,Sze,Pén]: trimmedTemplate(FB,3) has no light days either, keeps
// all 4 template training days (A,B,A,B on Hét,Sze,Pén,Szo); defaultWeekdays caps at 3, takes
// the first 3 (A,B,A), drops Szo (2nd B) — converted to Rest. Result: A x2 (Hét,Pén), B x1 (Sze).
// Quad only ever lives in Full · A (Barbell Squat) — 2 occurrences, but still 1 distinct weekly
// name (variety). Glute only ever lives in Full · B (Hip Thrust) — now a single B day, so every
// weekly glute set lands on Sze (frequency) AND the lone slot (workingSets 4) < GROUP_MEV.glute
// 6 (MEV — the 2nd B day that would have doubled it was dropped by the day-count cap).
wdAllowStructural('frequency', 'glute', 'Full body', [3], ALL_GOAL_IDS)
wdAllowStructural('variety', 'quad', 'Full body', [3], ALL_GOAL_IDS)
wdAllowMev('glute', 'Full body', [3], ALL_GOAL_IDS)
// Full body @ 4d, weekdays=[Hét,Sze,Pén,Szo]: defaultWeekdays picks all 4 training days in
// order — identical to the no-weekdays template path at this day count. Full body @ 5d,
// weekdays=[Hét,Kedd,Sze,Pén,Szo]: the 4 training days plus 1 padded rest day (Kedd) cause the
// weekday branch to CYCLE the 4-entry sequence across 5 slots (A,B,A,B,A→A x3, B x2) — quad
// (A-only) and glute (B-only) both clear their frequency floor now (3x/2x spread across
// distinct days) but keep reading a single distinct name each week (variety) — same
// split-inherent single-list trade-off as the no-weekdays FB[3,4,5] entry above.
wdAllowStructural('variety', 'quad', 'Full body', [4, 5], ALL_GOAL_IDS)
wdAllowStructural('variety', 'glute', 'Full body', [4, 5], ALL_GOAL_IDS)

// Upper / Lower / Sport @ 4d, weekdays=[Hét,Sze,Pén,Vas]: trimmedTemplate(ULS,4) keeps its only
// 3 training days (Upper,Lower,Upper on Hét,Sze,Pén — trainingCount 3 <= days, untouched);
// defaultWeekdays pads with the first rest day (Vas) to reach 4. The weekday branch cycles the
// 3-entry sequence across the 4 picked days: Hét→Upper, Sze→Lower, Pén→Upper, Vas→sequence[0]
// AGAIN → Upper (a literal duplicate of Hét's day). Result: Upper x3 (Hét,Pén,Vas), Lower x1
// (Sze) — quad/ham/glute (Lower-only) read every set on one day (frequency); triceps (single
// Tricep Pushdown, Upper-only) keeps its one distinct weekly name across all 3 duplicated
// occurrences (variety) — the same single-name repeat as the no-weekdays ULS entry above, now
// unconditional on every goal (not just strength) because 3x/week clears the variety gate
// regardless of scheme.
for (const group of ['quad', 'ham', 'glute']) wdAllowStructural('frequency', group, 'Upper / Lower / Sport', [4], ALL_GOAL_IDS)
wdAllowStructural('variety', 'triceps', 'Upper / Lower / Sport', [4, 5], ALL_GOAL_IDS)
// erohipertrofia @ ULS 4d and 5d only: 'back' (Chest Supported Row + Lat Pulldown, 2 slots per
// Upper day) trained on 3 Upper days at the RIR-0 failure scheme lands its budget at
// sets=11/FAILURE_WEEKLY_CAP(12)=0.9167 — over the FIT_CEILING(0.85) soft ceiling but under the
// hard 1.0 cap (mev=10 is already met, so this is a near-ceiling waiver, not an MEV shortfall).
// The programFit.ts session-length-guard fix (this same change) is what makes back reach exactly
// this budget: it now pads Chest Supported Row on the cycled-duplicate day toward the 45-min
// floor instead of stopping dead at the soft ceiling — a hard rule (session-length) legitimately
// outranks the soft ceiling here.
wdAllowNear('back', 'Upper / Lower / Sport', [4, 5], ['erohipertrofia'])

// Láb+Plyo / Felső @ 4d (its only option), weekdays=[Hét,Kedd,Csü,Pén]: this split has no light
// days and trainingCount already equals days=4, so trimmedTemplate is a no-op and defaultWeekdays
// picks all 4 training days in template order — the weekdays branch places them 1:1, IDENTICAL
// to the no-weekdays template path. Same mechanism as the no-weekdays Láb+Plyo/Felső entries
// above (glute sourced only from Láb+Plyo B; biceps' 2 isolation slots x cap 3 = 6 < MEV 8),
// re-derived here for the weekdays path's own allowlist.
wdAllowStructural('frequency', 'glute', 'Láb+Plyo / Felső', [4], ALL_GOAL_IDS)
wdAllowMev('biceps', 'Láb+Plyo / Felső', [4], ALL_GOAL_IDS)

// calf: PPL 4/5-day weekdays path keeps the same 1-slot-only 'Legs' day as the no-weekdays path
// (see the no-weekdays calf entry above) — 1 isolation slot (Standing Calf Raise) x cap 3 = 3 <
// GROUP_MEV.calf 4, on both day counts.
wdAllowMev('calf', 'Pull / Push / Legs', [4, 5], ALL_GOAL_IDS)
// mezo-d20.14 (wizard v2 redesign): PPL@4d's weekdays path is byte-identical to the
// no-weekdays template path at this day count (see the frequency|back WD entry above) —
// same SESSION_MUSCLE_CAP 11→8 back-topping stall as the no-weekdays back entry above
// (measured: cut-prep back:9, recovery back:8, erohipertrofia back:8, all < MEV 10).
wdAllowMev('back', 'Pull / Push / Legs', [4], ['cut-prep', 'recovery', 'erohipertrofia'])

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
          assertInvariants(prog, goal.id, split.label, d, label, STRUCTURAL_ALLOWED, structuralConsumed, MEV_ALLOWED, mevConsumed, NEAR_ALLOWED, nearConsumed)
        })
        test(`${label} · weekdays: fitter-hard-clean, structural findings allowlisted, MEV/ceiling honoured`, () => {
          const weekdays = defaultWeekdays({ split, days: d })
          const prog = generateProgram({ goal, split, days: d, weekdays })
          assertInvariants(
            prog, goal.id, split.label, d, `${label} · weekdays`,
            WD_STRUCTURAL_ALLOWED, wdStructuralConsumed, WD_MEV_ALLOWED, wdMevConsumed, WD_NEAR_ALLOWED, wdNearConsumed,
          )
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

  // Finding 2 (mezo-oyhy.6 fix wave): a self-enforcing allowlist — every entry above must be
  // consumed by at least one combo in the two sweeps, or it's stale (the fitter/template moved
  // on and the entry no longer describes anything real) and must be deleted, not left to rot.
  afterAll(() => {
    for (const key of STRUCTURAL_ALLOWED) expect(structuralConsumed.has(key), `stale STRUCTURAL_ALLOWED entry (never fired): ${key}`).toBe(true)
    for (const key of MEV_ALLOWED) expect(mevConsumed.has(key), `stale MEV_ALLOWED entry (never fired): ${key}`).toBe(true)
    for (const key of NEAR_ALLOWED) expect(nearConsumed.has(key), `stale NEAR_ALLOWED entry (never fired): ${key}`).toBe(true)
    for (const key of WD_STRUCTURAL_ALLOWED) expect(wdStructuralConsumed.has(key), `stale WD_STRUCTURAL_ALLOWED entry (never fired): ${key}`).toBe(true)
    for (const key of WD_MEV_ALLOWED) expect(wdMevConsumed.has(key), `stale WD_MEV_ALLOWED entry (never fired): ${key}`).toBe(true)
    for (const key of WD_NEAR_ALLOWED) expect(wdNearConsumed.has(key), `stale WD_NEAR_ALLOWED entry (never fired): ${key}`).toBe(true)
  })
})
