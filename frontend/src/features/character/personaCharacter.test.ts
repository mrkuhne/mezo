import { describe, expect, test } from 'vitest'
import { personaCharacter, personaName } from './personaCharacter'

describe('personaCharacter (mezo-me75u.9)', () => {
  test.each([
    ['doki', 'Derű'], ['pszichologus', 'Derű'], ['edzo', 'Mocor'], ['drill', 'Mocor'],
    ['taplalkozo', 'Falat'], ['szomnologus', 'Szunya'], ['antropologus', 'Mezo'],
    ['mezo', 'Mezo'], ['szkeptikus', 'Szkeptikus'],
  ])('%s → %s', (key, name) => {
    expect(personaName(key)).toBe(name)
  })

  test('a key that already is a team character id maps to itself (evening edition rows)', () => {
    expect(personaName('falat')).toBe('Falat')
    expect(personaName('deru')).toBe('Derű')
    expect(personaName('szunya')).toBe('Szunya')
  })

  test('unknown and missing keys fall back to Mezo', () => {
    expect(personaCharacter('valaki').id).toBe('mezo')
    expect(personaCharacter(null).id).toBe('mezo')
  })
})
