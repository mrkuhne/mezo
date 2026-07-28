import { describe, expect, it } from 'vitest'
import { ROLE_OPTIONS, roleLabel, roleRubricLabel } from '@/features/fuel/logic/recipeRole'

describe('recipeRole', () => {
  it('labels every role in Hungarian', () => {
    expect(roleLabel('standard')).toBe('Általános')
    expect(roleLabel('pre_workout')).toBe('Edzés előtt')
    expect(roleLabel('post_workout')).toBe('Edzés után')
  })

  // The rubric note attributes a noun („… mérce szerint"), where the postpositional
  // control labels are ungrammatical — hence a second, adjectival map (mezo-uavr).
  it('attributes the rubric with the adjectival role form', () => {
    expect(roleRubricLabel('standard')).toBe('általános')
    expect(roleRubricLabel('pre_workout')).toBe('edzés előtti')
    expect(roleRubricLabel('post_workout')).toBe('edzés utáni')
  })

  // Guards the regression this replaced: a `.toLowerCase()` of the control label. Only the
  // non-standard roles ever reach the note, and for those the two forms must differ.
  it('does not collapse into a lowercased control label for the rendered roles', () => {
    for (const id of ['pre_workout', 'post_workout'] as const) {
      expect(roleRubricLabel(id)).not.toBe(roleLabel(id).toLowerCase())
    }
  })

  it('offers the three roles in order', () => {
    expect(ROLE_OPTIONS.map(o => o.id)).toEqual(['standard', 'pre_workout', 'post_workout'])
  })
})
