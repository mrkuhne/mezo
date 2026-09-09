import { describe, expect, it } from 'vitest'
import type { MesoDay, MesoPhase } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import type { MesoPlanProposal } from '@/data/train/mesoPlanHooks'
import {
  generateInput, initialWizardState, toUpsert, wizardReducer, type WizardState,
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
  return { draftId: 'draft-1', template, days, rationale: 'r', llmUsed: false }
}

const generate = (s: WizardState, proposal = makeProposal()) =>
  wizardReducer(s, { type: 'generated', proposal })

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
  // mezo-yty6: the 3 numeric steps collapsed into interview → editor.
  it('the wizard starts on the interview and generation moves it to the editor', () => {
    expect(s0.step).toBe('interview')
    const s1 = wizardReducer(s0, { type: 'step', step: 'editor' })
    expect(s1.step).toBe('editor')
    expect(s1.activeDay).toBeNull()
  })
  it('renaming a day rewrites only that day and marks the draft dirty', () => {
    const base: WizardState = { ...s0, program: [day('Hét', 'Upper'), day('Kedd', 'Push')] }
    const next = wizardReducer(base, { type: 'renameDay', day: 'Kedd', name: 'Nyomónap' })
    expect(next.program.map((d) => d.type)).toEqual(['Upper', 'Nyomónap'])
    expect(next.dirty).toBe(true)
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
})
