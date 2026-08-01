import { describe, expect, it } from 'vitest'
import { libraryToGymExercise } from '@/features/train/logic/exerciseDefaults'

describe('libraryToGymExercise', () => {
  it('defaults a new pick to volume style (RIR 2) with the standard recipe', () => {
    const gx = libraryToGymExercise({ id: 'lib1', name: 'Fekvenyomás', muscle: 'chest-mid', type: 'compound' } as never)
    expect(gx).toMatchObject({ name: 'Fekvenyomás', muscle: 'chest-mid', warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 2, type: 'compound' })
    expect(gx.id.startsWith('lib1-')).toBe(true)
  })
  it('carries catalogId only when present', () => {
    expect('catalogId' in libraryToGymExercise({ id: 'a', name: 'X', muscle: 'quad', type: 'isolation' } as never)).toBe(false)
    expect(libraryToGymExercise({ id: 'a', name: 'X', muscle: 'quad', type: 'isolation', catalogId: 'c1' } as never).catalogId).toBe('c1')
  })
})
