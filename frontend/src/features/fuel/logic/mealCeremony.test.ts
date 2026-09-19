import { describe, expect, test } from 'vitest'
import { mealStars, mealVerdict, scoreOutOfTen } from './mealCeremony'

describe('a kaja-ünneplés pontszám-matekja', () => {
  test('a 0..1-es drót-pontszám a minta 0..10-es skálájára fordul', () => {
    expect(scoreOutOfTen(0.83)).toBe(8.3)
    expect(scoreOutOfTen(0.5)).toBe(5)
    expect(scoreOutOfTen(1)).toBe(10)
  })

  test('a csillag FELFELÉ kerekít, és sosem esik 1 alá (minta §Star mapping)', () => {
    expect(mealStars(8.3)).toBe(5)
    expect(mealStars(7.4)).toBe(4)
    expect(mealStars(5.2)).toBe(3)
    expect(mealStars(0.4)).toBe(1) // a leggyengébb tányér is EGY csillag: rögzítetted
    expect(mealStars(10)).toBe(5)
  })

  test('a verdikt-létra a prototípus szövegeit adja', () => {
    expect(mealVerdict(5)).toBe('Hibátlan választás.')
    expect(mealVerdict(4)).toBe('Erős tányér.')
    expect(mealVerdict(3)).toBe('Rendben van.')
    expect(mealVerdict(2)).toBe('Ez is számít.')
    expect(mealVerdict(1)).toBe('Rögzítve — minden adat segít.')
  })
})
