import { describe, expect, test } from 'vitest'
import { GOAL_PRESETS, SPLITS } from '@/data/train/train'
import { addWeeks, defaultWeekdays, generateProgram, getSeason, stepLabels } from '@/features/train/logic/planner'

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
