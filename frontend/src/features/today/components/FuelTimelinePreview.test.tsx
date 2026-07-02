import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelSlot } from '@/data/types'
import { FuelTimelinePreview } from '@/features/today/components/FuelTimelinePreview'
import { QueryWrapper } from '@/test/queryWrapper'

// Override useFuelPreview ONLY when a test seeds `hoisted.preview` (e.g. the budget-only case);
// otherwise the real dual-mode hook runs so the existing mock-seed assertions stay untouched.
const hoisted = vi.hoisted(() => ({ preview: null as { visible: FuelSlot[]; nextStack: FuelSlot | null } | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useFuelPreview: () => hoisted.preview ?? actual.useFuelPreview() }
})

// The tap mounts LogMealSheet, which reads the dual-mode useFuelDay/useRecipes/usePantry
// TanStack queries — pin mock mode + wrap in a QueryClientProvider so the sheet renders
// off the synchronous mock seed (no MSW round-trips).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => { hoisted.preview = null; vi.unstubAllEnvs() })

const renderPreview = () =>
  render(
    <QueryWrapper>
      <FuelTimelinePreview />
    </QueryWrapper>,
  )

test('shows the fuel header and a MOST chip on the active slot', () => {
  renderPreview()
  expect(screen.getByText('Mai fuel · timeline')).toBeInTheDocument()
  expect(screen.getByText('MOST')).toBeInTheDocument()
})
test('opens the LogMealSheet when the log affordance is tapped', async () => {
  renderPreview()
  fireEvent.click(screen.getByRole('button', { name: /log/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})
test('a budget-only planner slot renders its label (no mealName) with no "undefined"', () => {
  hoisted.preview = {
    visible: [{ time: '12:30', kind: 'meal', label: 'Ebéd', state: 'now', kcal: 700, p: 45, c: 70, f: 22 }],
    nextStack: null,
  }
  renderPreview()
  expect(screen.getByText('Ebéd')).toBeInTheDocument()
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
})
