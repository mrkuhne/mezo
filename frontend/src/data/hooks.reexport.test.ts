import { describe, it, expect } from 'vitest'
import * as hooks from '@/data/hooks'
import { useFuelDay as fromFuelHooks, useMealActions as actionsFromFuelHooks } from '@/data/fuelHooks'

describe('hooks.ts re-exports the dual-mode fuel-day hooks', () => {
  it('useFuelDay is the fuelHooks implementation (not the retired one-liner)', () => {
    expect(hooks.useFuelDay).toBe(fromFuelHooks)
  })
  it('useMealActions is re-exported', () => {
    expect(hooks.useMealActions).toBe(actionsFromFuelHooks)
  })
})
