import { describe, expect, test } from 'vitest'
import vectors from '../../../../api/fixtures/activity-energy-vectors.json'
import { band, netKcal, restKcalPerHour, metFor } from '@/data/train/activityEnergy'

// FE↔BE drift guard (mezo-32m82): the SAME vectors are asserted by backend ActivityEnergyVectorsTest.
describe('activityEnergy golden vectors', () => {
  test.each(vectors.restKcalPerHour)('restKcalPerHour %j', (v) => {
    expect(restKcalPerHour(v.bmr, v.weightKg)).toBe(v.expected)
  })
  test.each(vectors.netKcal)('netKcal %j', (v) => {
    expect(netKcal(v.kind, v.rpe, v.min, v.rest)).toBe(v.expected)
  })
})

describe('activityEnergy rules', () => {
  test('band from RPE', () => {
    expect(band(null)).toBe('moderate')
    expect(band(4)).toBe('light')
    expect(band(7)).toBe('moderate')
    expect(band(8)).toBe('hard')
  })
  test('unknown kind reads as other', () => {
    expect(metFor('kajak')).toBe(4.0)
    expect(metFor(undefined)).toBe(4.0)
  })
})
