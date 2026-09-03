import { describe, expect, it } from 'vitest'
import type { MesoDay, MesoPhase } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import type { MesoPlanProposal } from '@/data/train/mesoPlanHooks'
import {
  generateInput, initialWizardState, inputChanged, toUpsert, wizardReducer, type WizardState,
} from './wizardState'

const day = (d: string, type: string): MesoDay =>
  ({ id: `id-${d}`, day: d, type, muscle: 'back', exerciseCount: 0, exercises: [] })

/** A minimal but fully typed proposal — no `as never`, so a contract change breaks here. */
function makeProposal(over: Partial<MesoTemplateUpsertRequest> = {}, days: MesoDay[] = [day('Hét', 'Upper')]): MesoPlanProposal {
  const template: MesoTemplateUpsertRequest = {
    title: 't',
    shortTitle: null,
    goal: null,
    goalPreset: 'hypertrophy',
    musclePriorities: null,
    weeks: 6,
    split: 'Upper / Lower',
    style: null,
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'] as MesoPhase[],
    notes: null,
    volumePerMuscle: null,
    days: [],
    ...over,
  }
  return { template, days, rationale: 'r', llmUsed: false }
}

/** The generated action now carries the input that produced the proposal (mezo-d20.14, I3). */
const generate = (s: WizardState, proposal = makeProposal()) =>
  wizardReducer(s, { type: 'generated', proposal, input: generateInput(s) })

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
    const g = generate(s0)
    expect(g.dirty).toBe(false)
    expect(g.program).toHaveLength(1)
    expect(wizardReducer(g, { type: 'editProgram', program: [] }).dirty).toBe(true)
    expect(toUpsert(g)).toMatchObject({ title: 'Hypertrophy · Ősz', weeks: 6, musclePriorities: null, days: [{ day: 'Hét', type: 'Upper' }] })
  })
  it('derives the saved phase curve from weeks, so a post-generation length change stays honest', () => {
    const s = wizardReducer(generate(s0, makeProposal({}, [])), { type: 'setWeeks', weeks: 8 })
    const saved = toUpsert(s)
    expect(saved.weeks).toBe(8)
    expect(saved.phaseCurve).toHaveLength(8)
    expect(saved.phaseCurve.at(-1)).toBe('Deload')
  })

  // I3: without proposalInput, a post-generation day/tier change was silent — toUpsert then
  // wrote the NEW musclePriorities next to the OLD program.
  describe('inputChanged', () => {
    it('is false before a generation and right after one', () => {
      expect(inputChanged(s0)).toBe(false)
      expect(inputChanged(generate(s0))).toBe(false)
    })
    it('turns true when the days move after a generation', () => {
      const g = generate(s0)
      expect(inputChanged(wizardReducer(g, { type: 'setDayCount', n: 5 }))).toBe(true)
      expect(inputChanged(wizardReducer(g, { type: 'setDays', days: ['Hét', 'Sze'] }))).toBe(true)
    })
    it('turns true when the tiers move after a generation, but ignores a grow-only no-op', () => {
      const g = generate(s0)
      expect(inputChanged(wizardReducer(g, { type: 'setPriorities', priorities: { back: 'emphasize' } }))).toBe(true)
      // grow is the default tier — it never travels, so it is not a change
      expect(inputChanged(wizardReducer(g, { type: 'setPriorities', priorities: { back: 'grow' } }))).toBe(false)
    })
    it('turns true when the length moves, and key ORDER alone never fakes a change', () => {
      const withTiers = wizardReducer(s0, { type: 'setPriorities', priorities: { back: 'emphasize', chest: 'maintain' } })
      const g = generate(withTiers)
      expect(inputChanged(wizardReducer(g, { type: 'setWeeks', weeks: 8 }))).toBe(true)
      expect(inputChanged(wizardReducer(g, { type: 'setPriorities', priorities: { chest: 'maintain', back: 'emphasize' } }))).toBe(false)
    })
    it('a re-generation re-baselines it', () => {
      const changed = wizardReducer(generate(s0), { type: 'setDayCount', n: 3 })
      expect(inputChanged(changed)).toBe(true)
      expect(inputChanged(generate(changed))).toBe(false)
    })
  })
})
