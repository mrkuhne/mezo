import { describe, expect, test } from 'vitest'
import { GOAL_PRESETS, SPLITS } from '@/data/train'
import { addWeeks, generateProgram, getSeason, stepLabels } from './planner'

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
    expect(stepLabels).toEqual(['Cél', 'Hossz + fázisok', 'Split + napok', 'Áttekintés'])
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
})
