import { describe, expect, it } from 'vitest'
import { ROLE_OPTIONS, roleLabel } from '@/features/fuel/logic/recipeRole'

describe('recipeRole', () => {
  it('labels every role in Hungarian', () => {
    expect(roleLabel('standard')).toBe('Általános')
    expect(roleLabel('pre_workout')).toBe('Edzés előtt')
    expect(roleLabel('post_workout')).toBe('Edzés után')
  })

  it('offers the three roles in order', () => {
    expect(ROLE_OPTIONS.map(o => o.id)).toEqual(['standard', 'pre_workout', 'post_workout'])
  })
})
