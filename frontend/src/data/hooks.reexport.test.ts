import { describe, it, expect } from 'vitest'
import * as hooks from '@/data/hooks'
import { useFuelDay as fromFuelHooks, useMealActions as actionsFromFuelHooks } from '@/data/fuel/fuelHooks'
import { useIntakes as useIntakesFromStackHooks } from '@/data/fuel/stackHooks'
import { useStackDay as useStackDayFromStackDayHooks } from '@/data/fuel/stackDayHooks'

describe('hooks.ts re-exports the dual-mode fuel-day hooks', () => {
  it('useFuelDay is the fuelHooks implementation (not the retired one-liner)', () => {
    expect(hooks.useFuelDay).toBe(fromFuelHooks)
  })
  it('useMealActions is re-exported', () => {
    expect(hooks.useMealActions).toBe(actionsFromFuelHooks)
  })
})

describe('hooks.ts re-exports useIntakes (mezo-vx9v)', () => {
  it('useIntakes is the stackHooks implementation', () => {
    expect(hooks.useIntakes).toBe(useIntakesFromStackHooks)
  })
})

describe('hooks.ts re-exports useStackDay (mezo-vx9v Task 8)', () => {
  it('useStackDay is the stackDayHooks implementation', () => {
    expect(hooks.useStackDay).toBe(useStackDayFromStackDayHooks)
  })
  it('useStackContext and useStackRecommendations are retired (Task 8 dead-code removal)', () => {
    expect('useStackContext' in hooks).toBe(false)
    expect('useStackRecommendations' in hooks).toBe(false)
  })
})
