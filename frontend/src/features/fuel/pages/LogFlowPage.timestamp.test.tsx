import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MealInput } from '@/data/types'

// Single-hook override (the AiLogSheet.test idiom): keep every hook real (mock mode) via
// importOriginal and swap only logMeal for a spy, so we can read the outgoing payload.
const hoisted = vi.hoisted(() => ({ logMeal: null as null | ((input: MealInput) => void) }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => ({
      ...actual.useMealActions(date),
      ...(hoisted.logMeal ? { logMeal: hoisted.logMeal } : {}),
    }),
  }
})

import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.logMeal = null
  vi.unstubAllEnvs()
})

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('LogFlowPage loggedAt', () => {
  // Root cause of the pre-workout mis-score: a UTC `Z` timestamp made the backend classify the
  // meal's training role + timing against UTC wall-clock (1-2h off local), so a pre-workout
  // breakfast fell out of its pre-window and got the standard rubric. The local offset must ride
  // along, exactly as LogDoseSheet already does (offsetIso).
  it('sends an offset-bearing loggedAt, not a UTC Z string', () => {
    const { qc, wrapper } = setup()
    const pantry = renderHook(() => usePantry(), { wrapper })
    const ing = pantry.result.current.ingredients[0]
    const logSpy = vi.fn()
    hoisted.logMeal = logSpy as (input: MealInput) => void

    render(
      <QueryClientProvider client={qc}>
        <LogFlowPage prefill={{ source: 'pantry', pantryItemId: ing.id }} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /logolás · \+10 XP/i }))

    const payload = logSpy.mock.calls[0][0] as MealInput
    expect(payload.loggedAt).toMatch(/T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/)
    expect(payload.loggedAt).not.toMatch(/Z$/)
  })
})
