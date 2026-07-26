import { describe, expect, test } from 'vitest'
import { MET_BY_KIND } from '@/data/fuel/fuelConfig'

// DRIFT-GUARD (mezo-eujg): these MUST match backend `mezo.train.met` in application.yml.
// If you change one side, change the other — this test is the tripwire.
const BACKEND_MET = { gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }

describe('MET table FE↔backend drift-guard', () => {
  test('fuelConfig.MET_BY_KIND mirrors mezo.train.met', () => {
    expect(MET_BY_KIND).toEqual(BACKEND_MET)
  })
})
