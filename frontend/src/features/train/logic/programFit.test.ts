import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { GROUP_MEV, muscleBudgets } from '@/features/train/logic/setBudget'
import { repZoneOf } from '@/features/train/logic/structureLint'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { fitProgram, FIT_CEILING } from '@/features/train/logic/programFit'

let seq = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `e${seq++}`, name: over.name ?? `X${seq}`, muscle, warmupSets: 2, workingSets,
  repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', ...over,
})
const day = (dayKey: string, exercises: GymExercise[]): MesoDay =>
  ({ day: dayKey, type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises })

describe('phase 1 — rep-zone variation', () => {
  it('keeps slot 0, shifts slot 1 into a different zone', () => {
    const out = fitProgram([day('Hét', [
      ex('chest-mid', 3, { name: 'A' }), ex('chest-upper', 3, { name: 'B' }),
      ex('back-mid', 3), ex('quad', 3), ex('ham', 3), ex('biceps-long', 2, { type: 'isolation', repMin: 10, repMax: 12 }),
    ])], 'hypertrophy')
    const chest = out[0].exercises.filter((e) => e.muscle.startsWith('chest'))
    const z0 = repZoneOf(chest[0].repMin, chest[0].repMax)
    const z1 = repZoneOf(chest[1].repMin, chest[1].repMax)
    expect(chest[0]).toMatchObject({ repMin: 8, repMax: 10 }) // slot 0 untouched
    expect(z1).not.toBe(z0)
  })
  it('shoulder isolation slots ≥1 go light (20-25)', () => {
    const out = fitProgram([day('Hét', [
      ex('shoulder-front', 3), ex('shoulder-side', 3, { name: 'L', type: 'isolation', repMin: 10, repMax: 12 }),
      ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
    ])], 'hypertrophy')
    const lat = out[0].exercises.find((e) => e.name === 'L')!
    expect([lat.repMin, lat.repMax]).toEqual([20, 25])
  })
  it('shoulder isolation slots ≥1 ALWAYS go light, even at even indices (2, 4, …)', () => {
    const out = fitProgram([day('Hét', [
      ex('shoulder-front', 3), ex('shoulder-side', 3, { name: 'L1', type: 'isolation', repMin: 10, repMax: 12 }),
      ex('shoulder-rear', 3, { name: 'L2', type: 'isolation', repMin: 10, repMax: 12 }),
      ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
    ])], 'hypertrophy')
    const l1 = out[0].exercises.find((e) => e.name === 'L1')!
    const l2 = out[0].exercises.find((e) => e.name === 'L2')!
    expect([l1.repMin, l1.repMax]).toEqual([20, 25])
    expect([l2.repMin, l2.repMax]).toEqual([20, 25]) // slot index 2 (even) — must not revert to the base range
  })
  it('plyo exercises are never touched', () => {
    const plyo = ex('quad', 3, { name: 'Box Jump', type: 'plyo', repMin: 5, repMax: 5, targetRIR: 0, warmupSets: 0 })
    const out = fitProgram([day('Hét', [plyo, ex('quad', 3), ex('ham', 3), ex('chest-mid', 3), ex('back-mid', 3)])], 'hypertrophy')
    expect(out[0].exercises.find((e) => e.name === 'Box Jump')).toMatchObject({ workingSets: 3, repMin: 5, repMax: 5 })
  })
})

describe('phase 2 — volume fit', () => {
  it('tops an under-MEV group up to its MEV', () => {
    // biceps MEV 8; two isolation slots at 2+2 = 4 → must reach 8 (3+3 caps at 6 → needs... see cap note below)
    // isolation cap is 3/exercise → two slots max 6 < 8: fitter saturates at caps; use THREE slots to make MEV reachable.
    const out = fitProgram([
      day('Hét', [ex('biceps-long', 2, { type: 'isolation', repMin: 10, repMax: 12 }), ex('biceps-short', 2, { name: 'C2', type: 'isolation', repMin: 10, repMax: 12 }), ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3)]),
      day('Csü', [ex('biceps-brachialis', 2, { name: 'C3', type: 'isolation', repMin: 10, repMax: 12 }), ex('chest-upper', 3), ex('back-wide', 3), ex('ham', 3), ex('glute', 3)]),
    ], 'hypertrophy')
    const bi = muscleBudgets(out).find((r) => r.group === 'biceps')!
    expect(bi.workingSets).toBeGreaterThanOrEqual(GROUP_MEV.biceps) // 8 via 3+3+2? no — 3+3+3 = 9 ≥ 8 (isolation cap 3)
    expect(bi.budget).toBeLessThan(FIT_CEILING)
  })
  it('trims an over-ceiling group down below the ceiling', () => {
    const out = fitProgram([
      day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4, { name: 'B' }), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)]),
      day('Csü', [ex('chest-mid', 4, { name: 'C' }), ex('chest-lower', 4, { name: 'D' }), ex('back-wide', 3), ex('glute', 3), ex('calf', 2, { type: 'isolation', repMin: 12, repMax: 15 })]),
    ], 'hypertrophy')
    const chest = muscleBudgets(out).find((r) => r.group === 'chest')!
    expect(chest.budget).toBeLessThan(FIT_CEILING)
    expect(chest.workingSets).toBeGreaterThanOrEqual(GROUP_MEV.chest)
    for (const d of out) for (const e of d.exercises) expect(e.workingSets).toBeGreaterThanOrEqual(2)
  })
  it('does not mutate the input', () => {
    const input = [day('Hét', [ex('chest-mid', 4), ex('chest-upper', 4, { name: 'B' }), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)])]
    const before = JSON.stringify(input)
    fitProgram(input, 'hypertrophy')
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('phase 3 — session length', () => {
  it('pads a too-short day toward 45 minutes within caps', () => {
    const short = [day('Hét', [ex('chest-mid', 2), ex('back-mid', 2), ex('quad', 2), ex('ham', 2), ex('shoulder-side', 2, { type: 'isolation', repMin: 10, repMax: 12 })])]
    const out = fitProgram(short, 'hypertrophy')
    expect(estimateSessionMinutes(out[0].exercises)).toBeGreaterThanOrEqual(45)
  })
})

describe('countsForVolume — exempt (non-plyo) exercises are gated out like plyo (mezo-yqpf)', () => {
  it('an exempt exercise\'s sets are NOT counted in the group\'s volume slots — top-up ignores it and never touches it', () => {
    // biceps MEV 8. Three COUNTED isolation slots start at 2 each (6 total, below MEV) —
    // same shape as the sibling "tops an under-MEV group up to its MEV" test above. A fourth,
    // EXEMPT (countsTowardVolume: false) exercise sits in the same group with 8 sets already —
    // enough to look like the group has already reached MEV if it were wrongly counted as a slot.
    const out = fitProgram([
      day('Hét', [
        ex('biceps-short', 2, { type: 'isolation', repMin: 10, repMax: 12 }),
        ex('biceps-long', 8, { name: 'ExemptCurl', countsTowardVolume: false }),
        ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3),
      ]),
      day('Csü', [
        ex('biceps-brachialis', 2, { name: 'C2', type: 'isolation', repMin: 10, repMax: 12 }),
        ex('biceps', 2, { name: 'C3', type: 'isolation', repMin: 10, repMax: 12 }),
        ex('chest-upper', 3), ex('back-wide', 3), ex('ham', 3),
      ]),
    ], 'hypertrophy')
    const exempt = out.flatMap((d) => d.exercises).find((e) => e.name === 'ExemptCurl')!
    expect(exempt.workingSets).toBe(8) // never touched by the fitter
    const bi = muscleBudgets(out).find((r) => r.group === 'biceps')!
    // muscleBudgets already excludes exempt sets — this only passes if the fitter's OWN
    // top-up loop also ignored the exempt exercise's 8 sets when deciding the group was
    // already at MEV (a buggy fitter that counts them stops topping up before reaching 8).
    expect(bi.workingSets).toBeGreaterThanOrEqual(GROUP_MEV.biceps)
    expect(bi.exemptSets).toBe(8)
  })

  it('the too-long trim never decrements the exempt exercise even when it has the most sets', () => {
    // traps has no GROUP_MEV entry, so if the exempt exercise were wrongly treated as a normal
    // slot it would be a completely unprotected, highest-set-count victim — the fitter's first
    // and easiest pick every guard iteration. chest (MEV 4, starting at 6) is the only legitimate
    // trim target and has plenty of headroom above its floor.
    const long = [day('Hét', [
      ex('traps', 12, { name: 'ExemptShrug', countsTowardVolume: false }),
      ex('chest-mid', 6),
      ex('back-mid', 10),
    ])]
    const out = fitProgram(long, 'hypertrophy')
    const exempt = out[0].exercises.find((e) => e.name === 'ExemptShrug')!
    expect(exempt.workingSets).toBe(12) // never decremented, despite having the most sets
    expect(estimateSessionMinutes(out[0].exercises)).toBeLessThanOrEqual(90)
    const chest = out[0].exercises.find((e) => e.muscle === 'chest-mid')!
    expect(chest.workingSets).toBeLessThan(6) // the real, protectable exercise absorbs the trim instead
  })
})

describe('passthrough', () => {
  it('off/sport/empty days and warnings survive untouched', () => {
    const rest: MesoDay = { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] }
    const warned = day('Hét', [ex('shoulder-front', 3, { warning: 'Cable variánssal helyettesítve' }), ex('chest-mid', 3), ex('back-mid', 3), ex('quad', 3), ex('ham', 3)])
    const out = fitProgram([warned, rest], 'hypertrophy')
    expect(out[1]).toEqual(rest)
    expect(out[0].exercises[0].warning).toBe('Cable variánssal helyettesítve')
  })
})
