import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { structureLint } from '@/features/train/logic/structureLint'

let seq = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `e${seq++}`, name: over.name ?? `X${seq}`, muscle, warmupSets: 1, workingSets,
  repMin: 8, repMax: 10, targetRIR: 2, type: 'compound', ...over,
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })
// A quiet 6-exercise day that trips no rule on its own (2 groups × 2 days handled per test).
const rules = (days: MesoDay[]) => structureLint(days).map((f) => f.rule)

// Balanced 2-day base: every group 2×/week, 3 sets/exercise, 6 exercises/day,
// push:pull ≈ 1:1, ham present vs quad — the clean fixture single tests mutate.
const cleanWeek = (): MesoDay[] => [
  day('Hét', [
    ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
    ex('ham', 3), ex('shoulder-side', 3), ex('biceps-long', 3),
  ]),
  day('Csü', [
    ex('chest-mid', 3, { name: 'B1', repMin: 12, repMax: 15 }), ex('back-mid', 3, { name: 'B2', repMin: 12, repMax: 15 }), ex('quad', 3, { name: 'B3', repMin: 12, repMax: 15 }),
    ex('ham', 3, { name: 'B4', repMin: 12, repMax: 15 }), ex('triceps-long', 3, { name: 'B5', repMin: 12, repMax: 15 }), ex('back-wide', 3, { name: 'B6', repMin: 12, repMax: 15 }),
  ]),
]

describe('clean week', () => {
  it('produces zero findings', () => {
    expect(structureLint(cleanWeek())).toEqual([])
  })
})

describe('exercises-per-muscle (R1)', () => {
  it('flags 4 chest exercises in one session, not 3', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('chest-upper', 2, { name: 'C2' }), ex('chest-lower', 2, { name: 'C3' }))
    expect(rules(w)).not.toContain('exercises-per-muscle') // 3 chest on Hét
    w[0].exercises.push(ex('chest-mid', 2, { name: 'C4', type: 'isolation' }))
    const found = structureLint(w).filter((f) => f.rule === 'exercises-per-muscle')
    expect(found).toHaveLength(1)
    expect(found[0].day).toBe('Hét')
    expect(found[0].label).toContain('Mell')
  })
  it('ham is stricter: 3 hamstring exercises flag, 2 do not', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('ham', 2, { name: 'H2', type: 'isolation' }))
    expect(rules(w)).not.toContain('exercises-per-muscle')
    w[0].exercises.push(ex('ham', 2, { name: 'H3', type: 'isolation' }))
    expect(rules(w)).toContain('exercises-per-muscle')
  })
})

describe('sets-per-exercise (R2)', () => {
  it('flags a 5-set compound and a 1-set compound; 4 and 2 are silent', () => {
    const w = cleanWeek()
    w[0].exercises[0].workingSets = 4
    expect(rules(w)).not.toContain('sets-per-exercise')
    w[0].exercises[0].workingSets = 5
    expect(rules(w)).toContain('sets-per-exercise')
    w[0].exercises[0].workingSets = 1
    expect(rules(w)).toContain('sets-per-exercise')
  })
  it('isolation band is 2–3: a 4-set isolation flags', () => {
    const w = cleanWeek()
    w[0].exercises[5] = ex('biceps-long', 4, { type: 'isolation' })
    expect(rules(w)).toContain('sets-per-exercise')
  })
  it('plyo is exempt at any set count', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('quad', 1, { name: 'Box Jump', type: 'plyo' }))
    expect(rules(w)).not.toContain('sets-per-exercise')
  })
  // mezo-gbo7: countsTowardVolume: true no longer skips the loop via !countsForVolume(ex),
  // so a plyo exercise the user explicitly flips to counting reaches the SETS_PER_EXERCISE
  // lookup — which has no 'plyo' key. Without the band-existence guard this throws
  // (band.min off undefined); with it, R2 stays silent (no established plyo band).
  it('a plyo exercise explicitly counted toward volume does not throw and stays silent under R2', () => {
    const w = cleanWeek()
    w[0].exercises.push(ex('quad', 1, { name: 'Counted Box Jump', type: 'plyo', countsTowardVolume: true }))
    expect(() => structureLint(w)).not.toThrow()
    expect(rules(w)).not.toContain('sets-per-exercise')
  })
})

describe('frequency (R3)', () => {
  it('flags a group with ≥4 weekly sets all on one day; <4 sets stays silent', () => {
    const w = cleanWeek()
    // biceps only on Hét with 3 sets → below the 4-set gate
    expect(rules(w)).not.toContain('frequency')
    w[0].exercises[5].workingSets = 4 // biceps 4 sets, single day
    const found = structureLint(w).filter((f) => f.rule === 'frequency')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('Bicepsz')
  })
})

describe('variety (R4)', () => {
  it('flags 6 distinct chest movements in the week; 5 silent', () => {
    const w = cleanWeek()
    w[1].exercises.push(
      ex('chest-upper', 2, { name: 'V1' }), ex('chest-lower', 2, { name: 'V2' }), ex('chest-mid', 2, { name: 'V3' }),
    )
    expect(rules(w)).not.toContain('variety') // 5 distinct chest names
    w[1].exercises.push(ex('chest-mid', 2, { name: 'V4', type: 'isolation' }))
    expect(rules(w)).toContain('variety')
  })
  it('flags a single movement carrying ≥6 weekly sets; 1 movement with 4 sets silent', () => {
    const base = [day('Hét', [ex('chest-mid', 2, { name: 'Bench' })]), day('Csü', [ex('chest-mid', 2, { name: 'Bench' })])]
    expect(structureLint(base).filter((f) => f.rule === 'variety')).toHaveLength(0)
    const heavy = [day('Hét', [ex('chest-mid', 3, { name: 'Bench' })]), day('Csü', [ex('chest-mid', 3, { name: 'Bench' })])]
    expect(structureLint(heavy).filter((f) => f.rule === 'variety')).toHaveLength(1)
  })
})

describe('session-size (R5)', () => {
  it('flags a 4-exercise day and a 10-exercise day; 5 and 9 silent', () => {
    const small = cleanWeek()
    small[0].exercises = small[0].exercises.slice(0, 4)
    expect(structureLint(small).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(1)
    const big = cleanWeek()
    big[0].exercises.push(
      ex('glute', 2, { name: 'G1' }), ex('calf', 2, { name: 'G2' }), ex('core', 2, { name: 'G3' }), ex('glute', 2, { name: 'G4', type: 'isolation' }),
    )
    expect(structureLint(big).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(1)
  })
  it('plyo counts as a session slot', () => {
    const w = cleanWeek()
    w[0].exercises = [...w[0].exercises.slice(0, 4), ex('quad', 3, { name: 'Depth Jump', type: 'plyo' })]
    // 5 slots incl. plyo → silent
    expect(structureLint(w).filter((f) => f.rule === 'session-size' && f.day === 'Hét')).toHaveLength(0)
  })
})

describe('push-pull (R6)', () => {
  it('stays silent at ratio 1.6, flags above', () => {
    // push 8 (chest), pull 5 (back) → 1.6 exactly → silent
    const edge = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4), ex('back-mid', 5)])]
    expect(structureLint(edge).filter((f) => f.rule === 'push-pull')).toHaveLength(0)
    const over = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 5), ex('back-mid', 5)])]
    const found = structureLint(over).filter((f) => f.rule === 'push-pull')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('1.8')
  })
  it('needs both sides: a legs-only week never flags', () => {
    const legs = [day('Hét', [ex('quad', 4), ex('ham', 3), ex('glute', 3)])]
    expect(structureLint(legs).filter((f) => f.rule === 'push-pull')).toHaveLength(0)
  })
  it('stays silent at ratio 0.6, flags below', () => {
    // push 3 (chest), pull 5 (back) → 0.6 exactly → silent
    const edge = [day('Hét', [ex('chest-mid', 3), ex('back-mid', 5)])]
    expect(structureLint(edge).filter((f) => f.rule === 'push-pull')).toHaveLength(0)
    // push 3 (chest), pull 6 (back) → 0.5 → flags
    const under = [day('Hét', [ex('chest-mid', 3), ex('back-mid', 6)])]
    const found = structureLint(under).filter((f) => f.rule === 'push-pull')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('0.5')
  })
})

describe('ham-quad (R7)', () => {
  it('flags ham:quad 0.33 when quad has ≥6 weekly sets; quad 5 sets silent', () => {
    const flagged = [day('Hét', [ex('quad', 6), ex('ham', 2), ex('chest-mid', 4), ex('back-mid', 4)])]
    const found = structureLint(flagged).filter((f) => f.rule === 'ham-quad')
    expect(found).toHaveLength(1)
    expect(found[0].label).toContain('0.3')
    const smallQuad = [day('Hét', [ex('quad', 5), ex('ham', 1), ex('chest-mid', 4), ex('back-mid', 4)])]
    expect(structureLint(smallQuad).filter((f) => f.rule === 'ham-quad')).toHaveLength(0)
  })
})

describe('unknown muscle (budgetGroup → null)', () => {
  it('is skipped by every group-keyed rule and never throws', () => {
    const w = cleanWeek()
    // 'sport' has no budgetGroup mapping — still occupies a session slot (7th, in-band).
    w[0].exercises.push(ex('sport', 2))
    expect(() => structureLint(w)).not.toThrow()
    expect(structureLint(w)).toEqual([])
  })
})

describe('session-length (R8, mezo-oyhy.3)', () => {
  it('flags a too-short and a too-long day; the clean week stays silent', () => {
    expect(structureLint(cleanWeek()).filter((f) => f.rule === 'session-length')).toHaveLength(0)
    // Short: one 2-set exercise ≈ 13 min (< 45)
    const short = [day('Hét', [ex('chest-mid', 2)])]
    const shortFound = structureLint(short).filter((f) => f.rule === 'session-length')
    expect(shortFound).toHaveLength(1)
    expect(shortFound[0].day).toBe('Hét')
    expect(shortFound[0].label).toMatch(/^Hét: ~\d+ perc\.$/)
    // Long: pile sets past 90 min — 8 compounds × 4 sets ≈ 105 min
    const long = [day('Hét', Array.from({ length: 8 }, (_, i) => ex('chest-mid', 4, { name: `L${i}` })))]
    expect(structureLint(long).filter((f) => f.rule === 'session-length')).toHaveLength(1)
  })
})

describe('scoping & ordering', () => {
  it('skips off-days and empty days entirely', () => {
    const w = [...cleanWeek(), { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] }]
    expect(structureLint(w)).toEqual([])
  })
  it('session-scoped findings precede weekly ones', () => {
    const w = cleanWeek()
    w[0].exercises[0].workingSets = 5 // session-scoped R2
    w[0].exercises[5].workingSets = 4 // weekly R3 (biceps single-day 4 sets)
    const out = structureLint(w)
    expect(out.findIndex((f) => f.rule === 'sets-per-exercise')).toBeLessThan(out.findIndex((f) => f.rule === 'frequency'))
  })
})

describe('rep-zone (R9, mezo-oyhy.4)', () => {
  // Zone refresher: repMax ≤ 10 → heavy; repMin ≥ 20 → light; else moderate.
  const heavy = { repMin: 5, repMax: 8 }
  const light = { repMin: 20, repMax: 25 }

  it('rebalanced clean week stays silent', () => {
    expect(structureLint(cleanWeek()).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
  })
  it('classification boundaries: repMax 10 is heavy, repMin 20 is light, 8-12 is moderate', () => {
    // chest 6 sets: 3 heavy (8-10) + 3 moderate (8-12) → 50% — silent
    const mixed = [day('Hét', [ex('chest-mid', 3), ex('chest-upper', 3, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(mixed).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    // chest 6 sets all repMax 10 → 100% heavy — flags
    const mono = [day('Hét', [ex('chest-mid', 3), ex('chest-upper', 3, { name: 'M2' })])]
    const found = structureLint(mono).filter((f) => f.rule === 'rep-zone')
    expect(found).toHaveLength(1)
    expect(found[0].label).toBe('Mell: a heti szettek 100%-a nehéz zónában.')
    expect(found[0].day).toBeUndefined()
  })
  it('gate: 5 mono sets silent, 6 flag', () => {
    const five = [day('Hét', [ex('chest-mid', 5)])]
    expect(structureLint(five).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const six = [day('Hét', [ex('chest-mid', 6)])]
    expect(structureLint(six).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('mono threshold: 79% silent, 80% flags', () => {
    // 15 heavy + 4 moderate = 19 sets → 78.9% — silent
    const below = [day('Hét', [ex('chest-mid', 15), ex('chest-upper', 4, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(below).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    // 16 heavy + 4 moderate = 20 → 80% — flags
    const at = [day('Hét', [ex('chest-mid', 16), ex('chest-upper', 4, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(at).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('skew exceptions: shoulder-light and ham-heavy silent; shoulder-heavy flags', () => {
    const shoulderLight = [day('Hét', [ex('shoulder-side', 3, { ...light, type: 'isolation' }), ex('shoulder-rear', 3, { name: 'S2', ...light, type: 'isolation' })])]
    expect(structureLint(shoulderLight).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const hamHeavy = [day('Hét', [ex('ham', 6, heavy)])]
    expect(structureLint(hamHeavy).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const shoulderHeavy = [day('Hét', [ex('shoulder-side', 6, heavy)])]
    expect(structureLint(shoulderHeavy).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('plyo sets never count toward the zone mix', () => {
    const w = [day('Hét', [ex('quad', 5), ex('quad', 6, { name: 'P', type: 'plyo', repMin: 5, repMax: 5 })])]
    expect(structureLint(w).filter((f) => f.rule === 'rep-zone')).toHaveLength(0) // 5 < gate
  })
})
