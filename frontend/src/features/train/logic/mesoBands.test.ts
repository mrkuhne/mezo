import { describe, expect, it } from 'vitest'
import { deciderSentence, grindHeldGroups, nextRolloverChips, nextStep, phaseChip, runBands, weekDotClass, weekDots } from './mesoBands'
import type { Mesocycle } from '@/data/types'

const src = { baseline: { name: 'RP', mev: 10, mav: 16, mrv: 22 }, adjustments: [], confidence: 0.5, rationale: '', userOverride: null } as never
const meso = {
  id: 'm1', status: 'active', title: 'T', shortTitle: 'T', goal: '', startDate: '2026-09-01', endDate: '2026-10-12', weeks: 6, currentWeek: 3,
  split: 'Upper / Lower · 4×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  musclePriorities: { back: 'emphasize', calf: 'maintain' },
  volumePerMuscle: {
    back: { mev: 10, mav: 16, mrv: 22, current: 16, source: src },
    chest: { mev: 8, mav: 14, mrv: 20, current: 10, source: src },
    calf: { mev: 6, mav: 10, mrv: 16, current: 6, source: src },
  },
  // Real backend vocabulary (VolumeDecider.Lever + VolumeProgressionService.reasonFor):
  // HOLD lever's fixed reason string is "tartás" — the mock fixture (data/train/train.ts)
  // uses richer narrative reasons, but the live API mirrors reasonFor()'s 4 fixed strings.
  volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'chest', change: 'tart (10)', reason: 'tartás' }] },
} as unknown as Mesocycle

describe('mesoBands', () => {
  it('derives current → ceiling per group with tier and step', () => {
    const rows = runBands(meso)
    expect(rows[0]).toMatchObject({ group: 'back', current: 16, ceiling: 22, tier: 'emphasize', step: 'up' })
    expect(rows.find((r) => r.group === 'chest')).toMatchObject({ current: 10, ceiling: 14, tier: 'grow' })
    expect(rows.find((r) => r.group === 'calf')).toMatchObject({ current: 6, ceiling: 6, tier: 'maintain', step: 'hold' })
  })
  it('phase chip and week dots follow the curve and the current week', () => {
    expect(phaseChip(meso)).toBe('Rámpa')
    expect(phaseChip({ ...meso, currentWeek: 5 } as Mesocycle)).toBe('Csúcs')
    expect(weekDots(meso).map((d) => d.state)).toEqual(['done', 'done', 'now', 'future', 'future', 'future'])
    expect(weekDots(meso)[5].deload).toBe(true)
  })
  it('turns the recompute change into a Hungarian sentence and the next-rollover chips', () => {
    expect(deciderSentence(meso)).toContain('Mell')
    // `chest` is grind-HELD (reason 'tartás'), so its chip reads `tart` — the same thing the
    // week mosaic's own tile says. Before mezo-d20.15's fix wave the chip promised „Mell +2"
    // next to a tile reading „= tartás".
    expect(nextRolloverChips(meso)).toEqual([
      { label: 'Hát', text: 'Hát +2', tone: 'sage' },
      { label: 'Mell', text: 'Mell tart', tone: 'mut' },
      { label: 'Vádli', text: 'Vádli tart', tone: 'mut' },
    ])
  })

  it('grindHeldGroups reads the HOLD reason only', () => {
    expect([...grindHeldGroups(meso)]).toEqual(['chest'])
    const ramped = { ...meso, volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'chest', change: '+2', reason: 'cél teljesítve, nincs grind' }] } } as unknown as Mesocycle
    expect(grindHeldGroups(ramped).size).toBe(0)
    expect(grindHeldGroups({ ...meso, volumeRecompute: undefined } as unknown as Mesocycle).size).toBe(0)
  })

  it('nextStep clamps the nominal +2 to the headroom under the ceiling', () => {
    const bands = runBands(meso)
    expect(nextStep(bands.find((b) => b.group === 'back')!)).toBe(2) // 16 → 22: room for the full step
    expect(nextStep(bands.find((b) => b.group === 'calf')!)).toBe(0) // maintain: never ramps
    // current === ceiling − 1 → +1, not an overshooting +2.
    const nearCap = {
      ...meso,
      volumePerMuscle: { ...meso.volumePerMuscle, back: { mev: 10, mav: 16, mrv: 22, current: 21, source: src } },
      volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [] },
    } as unknown as Mesocycle
    expect(nextStep(runBands(nearCap).find((b) => b.group === 'back')!)).toBe(1)
    expect(nextRolloverChips(nearCap).find((c) => c.label === 'Hát')).toEqual({ label: 'Hát', text: 'Hát +1', tone: 'sage' })
    // at the ceiling: 'cap', no step at all
    const atCap = {
      ...nearCap,
      volumePerMuscle: { ...meso.volumePerMuscle, back: { mev: 10, mav: 16, mrv: 22, current: 22, source: src } },
    } as unknown as Mesocycle
    expect(nextStep(runBands(atCap).find((b) => b.group === 'back')!)).toBe(0)
    expect(nextRolloverChips(atCap).find((c) => c.label === 'Hát')?.text).toBe('Hát tart')
  })

  it('week-dot classes LAYER — a deload week that is also now keeps its now marker', () => {
    // meso-shaped 4-week block whose CURRENT week is the deload one.
    const deloadNow = { ...meso, weeks: 4, currentWeek: 4, phaseCurve: ['MEV', 'MAV', 'MRV', 'Deload'] } as unknown as Mesocycle
    expect(weekDots(deloadNow).map(weekDotClass)).toEqual(['done', 'done', 'done', 'now deload'])
    expect(weekDots(meso).map(weekDotClass)).toEqual(['done', 'done', 'now', undefined, undefined, 'deload'])
  })
  it('the hold sentence never leaks undefined when the changed muscle has no volume profile', () => {
    const noProfile = {
      ...meso,
      volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'shoulder', change: 'tart (12)', reason: 'tartás' }] },
    } as unknown as Mesocycle
    const sentence = deciderSentence(noProfile)
    expect(sentence).toContain('Váll')
    expect(sentence).not.toContain('undefined')
  })
})
