import { describe, expect, it } from 'vitest'
import { generateInput, initialWizardState, toUpsert, wizardReducer } from './wizardState'

describe('wizardReducer', () => {
  const s0 = initialWizardState('2026-09-02')
  it('starts with 4 recommended days, 6 weeks, grow-only priorities and a seasonal name', () => {
    expect(s0.daysOfWeek).toEqual(['Hét', 'Sze', 'Pén', 'Szo'])
    expect(s0.weeks).toBe(6)
    expect(s0.name).toBe('Hypertrophy · Ősz')
  })
  it('setDayCount swaps in the recommended pattern and setDays keeps DAY_ORDER', () => {
    expect(wizardReducer(s0, { type: 'setDayCount', n: 2 }).daysOfWeek).toEqual(['Hét', 'Csü'])
    expect(wizardReducer(s0, { type: 'setDays', days: ['Szo', 'Hét'] }).daysOfWeek).toEqual(['Hét', 'Szo'])
  })
  it('generateInput sends a sparse priority map and null goal when empty', () => {
    const s = wizardReducer(s0, { type: 'setPriorities', priorities: { back: 'emphasize', chest: 'grow' } })
    expect(generateInput(s)).toEqual({ daysOfWeek: ['Hét', 'Sze', 'Pén', 'Szo'], weeks: 6, priorities: { back: 'emphasize' }, goalText: null })
  })
  it('editProgram marks dirty; generated resets it and copies the days', () => {
    const proposal = { template: { title: 't', weeks: 6, phaseCurve: ['MEV', 'Deload'], days: [] }, days: [{ day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 0, exercises: [], id: 'd1' }], rationale: 'r', llmUsed: false } as never
    const g = wizardReducer(s0, { type: 'generated', proposal })
    expect(g.dirty).toBe(false)
    expect(g.program).toHaveLength(1)
    expect(wizardReducer(g, { type: 'editProgram', program: [] }).dirty).toBe(true)
    expect(toUpsert(g)).toMatchObject({ title: 'Hypertrophy · Ősz', weeks: 6, musclePriorities: null, days: [{ day: 'Hét', type: 'Upper' }] })
  })
})
