import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FuelSlot, MealInput } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { MealComposer, type MealComposerProps } from '@/features/fuel/components/MealComposer'

const spies = vi.hoisted(() => ({ logMealAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => ({ ...actual.useMealActions(date), logMealAsync: spies.logMealAsync }),
  }
})

const planWindows: FuelSlot[] = [
  { time: '08:00', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending', windowFrom: '07:00', windowTo: '10:00' },
  { time: '16:30', kind: 'snack', label: 'Uzsonna', slotKey: 'snack', state: 'pending', windowFrom: '16:00', windowTo: '17:30' },
]

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 30, 14, 10))
  spies.logMealAsync.mockReset().mockResolvedValue({ id: 'saved' })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function renderComposer(options: Partial<MealComposerProps> & { seedLine?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const prefill = options.seedLine
    ? { source: 'recipe' as const, recipeId: renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0].id }
    : null
  const { seedLine: _seedLine, ...props } = options
  const onSaved = vi.fn()
  render(
    <MealComposer prefill={prefill} shellOwnsEntry eatingTimeWindows={planWindows}
      onSaved={onSaved} onCancel={() => {}} {...props} />,
    { wrapper },
  )
  return { onSaved }
}

test('empty draft has no time control; confirmation starts collapsed at the current time', () => {
  renderComposer()
  expect(screen.queryByRole('button', { name: /Mikor ettél/ })).not.toBeInTheDocument()
  cleanup()
  renderComposer({ seedLine: true })
  const toggle = screen.getByRole('button', { name: /Mikor ettél/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(toggle).toHaveTextContent('Most · 14:10')
  expect(screen.queryByLabelText('Evés időpontja')).not.toBeInTheDocument()
  expect(screen.queryByText('MIKOR')).not.toBeInTheDocument()
})

test('opening and closing keeps the draft node and scroll position', async () => {
  const user = userEvent.setup()
  renderComposer({ seedLine: true, aiPanelOpenOnMount: true })
  const text = screen.getByLabelText('Mit ettél?')
  const scroller = text.closest('.logflow-composer') as HTMLElement
  scroller.scrollTop = 44
  const toggle = screen.getByRole('button', { name: /Mikor ettél/ })
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('Evés időpontja')).toHaveValue('14:10')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByLabelText('Mit ettél?')).toBe(text)
  expect(scroller.scrollTop).toBe(44)
})

test('edited time previews its window; Most restores the live clock', async () => {
  const user = userEvent.setup()
  renderComposer({ seedLine: true })
  await user.click(screen.getByRole('button', { name: /Mikor ettél/ }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '09:15' } })
  expect(screen.getByRole('button', { name: /Mikor ettél/ })).toHaveTextContent('Reggeli · 07:00–10:00')
  vi.setSystemTime(new Date(2026, 8, 30, 14, 12))
  await user.click(screen.getByRole('button', { name: 'Most' }))
  expect(screen.getByLabelText('Evés időpontja')).toHaveValue('14:12')
})

test('future time today blocks save, while edit mode keeps its existing time field', async () => {
  const user = userEvent.setup()
  renderComposer({ seedLine: true })
  await user.click(screen.getByRole('button', { name: /Mikor ettél/ }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '15:00' } })
  expect(screen.getByText(/jövőbeli időpontot nem lehet menteni/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logolás/ })).toBeDisabled()
  cleanup()
  renderComposer({ editMealId: 'existing', seedLine: true })
  expect(screen.getByLabelText('Mikor ettél?')).toBeInTheDocument()
})

test('an emptied time field cannot send an invalid timestamp', async () => {
  const user = userEvent.setup()
  renderComposer({ seedLine: true })
  await user.click(screen.getByRole('button', { name: /Mikor ettél/ }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '' } })
  expect(screen.getByRole('button', { name: /Logolás/ })).toBeDisabled()
})

test('untouched time is read at save', async () => {
  const user = userEvent.setup()
  renderComposer({ seedLine: true, logDate: '2026-09-27' })
  vi.setSystemTime(new Date(2026, 8, 30, 16, 20))
  await user.click(screen.getByRole('button', { name: /Logolás/ }))
  await waitFor(() => expect(spies.logMealAsync).toHaveBeenCalled())
  const current = spies.logMealAsync.mock.calls[0][0] as MealInput
  expect(current.loggedAt).toContain('2026-09-27T16:20')
  expect(current.slot).toBe('snack')
  expect(current.window).toEqual({ from: '16:00', to: '17:30' })
})

test('edited time sends the selected day, matching slot and matching window', async () => {
  const user = userEvent.setup()
  const { onSaved } = renderComposer({ seedLine: true, logDate: '2026-09-27', fixedSlot: 'snack',
    window: { from: '16:00', to: '17:30' } })
  await user.click(screen.getByRole('button', { name: /Mikor ettél/ }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '09:15' } })
  await user.click(screen.getByRole('button', { name: /Logolás/ }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  const input = spies.logMealAsync.mock.calls[0][0] as MealInput
  expect(input.loggedAt).toContain('2026-09-27T09:15')
  expect(input.slot).toBe('breakfast')
  expect(input.window).toEqual({ from: '07:00', to: '10:00' })
})

test('a rejected save leaves the edited time and draft in place', async () => {
  spies.logMealAsync.mockRejectedValueOnce(new Error('offline'))
  const user = userEvent.setup()
  const { onSaved } = renderComposer({ seedLine: true, logDate: '2026-09-27' })
  await user.click(screen.getByRole('button', { name: /Mikor ettél/ }))
  fireEvent.change(screen.getByLabelText('Evés időpontja'), { target: { value: '09:15' } })
  await user.click(screen.getByRole('button', { name: /Logolás/ }))
  await waitFor(() => expect(spies.logMealAsync).toHaveBeenCalled())
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Evés időpontja')).toHaveValue('09:15')
  expect(screen.getByText('TÉTELEK')).toBeInTheDocument()
})
