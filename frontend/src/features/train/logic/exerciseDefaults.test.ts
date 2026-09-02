import { describe, expect, test } from 'vitest'
import { libraryToGymExercise, addExerciseWithDefaults } from './exerciseDefaults'
import { suggestedWarmupSets } from '@/features/train/logic/warmupSuggest'
import { countsForVolume } from '@/features/train/logic/setBudget'
import type { ExerciseLibraryItem, GymExercise, MesoDay } from '@/data/types'

const compound: ExerciseLibraryItem = {
  id: 'c1', name: 'Front Squat', muscle: 'quad', type: 'compound', stim: 0, fatigue: 0,
}
const iso: ExerciseLibraryItem = {
  id: 'i1', name: 'Leg Extension', muscle: 'quad', type: 'isolation', stim: 0, fatigue: 0,
}
const plyo: ExerciseLibraryItem = {
  id: 'p1', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0, fatigue: 0,
}

describe('libraryToGymExercise', () => {
  test('hypertrophy scheme fills a compound as 4×8-10 RIR1', () => {
    const ex = libraryToGymExercise(compound, 'hypertrophy')
    expect([ex.workingSets, ex.repMin, ex.repMax, ex.targetRIR]).toEqual([4, 8, 10, 1])
  })

  test('no preset falls back to the hypertrophy scheme', () => {
    expect(libraryToGymExercise(iso, null).workingSets).toBe(3)
  })

  test('plyo is 3×5, zero warmups, RIR0, exempt from volume', () => {
    const ex = libraryToGymExercise(plyo, 'hypertrophy')
    expect([ex.warmupSets, ex.workingSets, ex.repMin, ex.repMax, ex.targetRIR]).toEqual([0, 3, 5, 5, 0])
    expect(countsForVolume(ex)).toBe(false)
  })

  // mezo-szsi item 6: the picker's plyo used to carry an explicit
  // `countsTowardVolume: false` that the generator's own inline plyo seed
  // (planner.ts) never sets — a redundant field, since the "Számít a
  // volumenbe" checkbox (ExerciseAccordionRow/ExerciseRecipeRow) always reads
  // countsForVolume(ex), not the raw field. Pin that both origins now render
  // the identical (absent-field) shape and the identical derived state.
  test('plyo carries no explicit countsTowardVolume, matching the generator plyo seed shape', () => {
    const ex = libraryToGymExercise(plyo, 'hypertrophy')
    expect('countsTowardVolume' in ex).toBe(false)
    // The generator's plyo seed (planner.ts generateProgram) never sets the field either —
    // both origins resolve to the same "exempt from volume" checkbox state via the shared
    // countsForVolume fallback (`type !== 'plyo'`), with no redundant flag on either side.
    const generatorPlyoShape = { type: 'plyo' } as GymExercise
    expect(countsForVolume(ex)).toBe(countsForVolume(generatorPlyoShape))
    expect(countsForVolume(ex)).toBe(false)
  })

  test('catalogId is present when the library item carries one', () => {
    const withCatalog: ExerciseLibraryItem = { ...compound, catalogId: 'cat-1' }
    const ex = libraryToGymExercise(withCatalog, 'hypertrophy')
    expect(ex.catalogId).toBe('cat-1')
  })

  test('catalogId key is absent (not just undefined) when the library item carries none', () => {
    const ex = libraryToGymExercise(compound, 'hypertrophy') // fixture has no catalogId
    expect('catalogId' in ex).toBe(false)
  })
})

describe('addExerciseWithDefaults', () => {
  test('refines warmups from warmupSuggest on the inserted day', () => {
    const day: MesoDay = { day: 'Hét', type: 'Push', muscle: 'quad', exerciseCount: 0, exercises: [] }
    const next = addExerciseWithDefaults(day, compound, 'hypertrophy')
    const added = next.exercises[0]
    expect(next.exercises).toHaveLength(1)
    expect(added.warmupSets).toBe(suggestedWarmupSets(next, added.id))
  })

  test('plyo keeps 0 warmups through the post-insert warmup refinement, and exerciseCount is incremented', () => {
    const day: MesoDay = { day: 'Hét', type: 'Push', muscle: 'quad', exerciseCount: 0, exercises: [] }
    const next = addExerciseWithDefaults(day, plyo, 'hypertrophy')
    expect(next.exerciseCount).toBe(1)
    expect(next.exercises).toHaveLength(1)
    expect(next.exercises[0].warmupSets).toBe(0)
  })
})
