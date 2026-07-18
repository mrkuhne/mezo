import type { ReactNode } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MealAiDraft, MealEstimateInputItem, MealInput } from '@/data/types'

// resizeImage: mocked to return the input blob unchanged; a hoisted spy so the photo path can
// assert the downscale ran before the draft request went out.
const resizeSpy = vi.hoisted(() => vi.fn((f: Blob) => Promise.resolve(f)))
vi.mock('@/shared/lib/resizeImage', () => ({ resizeImage: resizeSpy }))

// Single-hook override idiom (mirrors ImportItemSheet.test): useMealActions stays real (mock mode)
// via importOriginal — the happy-path tests exercise the canned MOCK_AI_MEAL_DRAFT — while the
// empty/error/payload tests swap draftMealFromAi and spy on the write through the hoisted slots.
const hoisted = vi.hoisted(() => ({
  draft: null as null | (() => Promise<MealAiDraft>),
  logMeal: null as null | ((input: MealInput) => void),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useMealActions: (date?: string) => {
      const real = actual.useMealActions(date)
      return {
        ...real,
        ...(hoisted.draft ? { draftMealFromAi: hoisted.draft } : {}),
        ...(hoisted.logMeal ? { logMeal: hoisted.logMeal } : {}),
      }
    },
  }
})

import { AiLogSheet } from '@/features/fuel/sheets/AiLogSheet'

const DATE = '2026-07-18'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

function renderSheet(overrides: { onManualFallback?: () => void; onClose?: () => void } = {}) {
  return render(
    <AiLogSheet
      date={DATE}
      onClose={overrides.onClose ?? (() => {})}
      onManualFallback={overrides.onManualFallback ?? (() => {})}
    />,
    { wrapper: wrapper() },
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.draft = null
  hoisted.logMeal = null
  resizeSpy.mockClear()
  vi.unstubAllEnvs()
})

test('text path drafts the canned meal and previews both lines with Kamra + Becslés badges', async () => {
  // fireEvent (not userEvent) on purpose: userEvent v14 deadlocks under fake timers.
  vi.useFakeTimers()
  renderSheet()

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'csirkés wrap és latte' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))

  await act(async () => { vi.advanceTimersByTime(700) }) // mock ai-draft demo delay (600ms)
  vi.useRealTimers()

  expect(screen.getByText('Kamra')).toBeInTheDocument()
  expect(screen.getByText('Becslés')).toBeInTheDocument()
  expect(screen.getByText('Csirkés wrap')).toBeInTheDocument()
})

test('a needsReview line renders the AI-uncertainty warning', async () => {
  vi.useFakeTimers()
  renderSheet()

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'csirkés wrap' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))

  await act(async () => { vi.advanceTimersByTime(700) })
  vi.useRealTimers()

  expect(screen.getByText(/ellenőrizd a számokat/)).toBeInTheDocument()
})

test('photo path resizes the image before drafting and lands on the review', async () => {
  vi.useFakeTimers()
  renderSheet()

  const file = new File(['x'], 'ebed.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Étel fotó'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))

  // The resizeImage microtask must resolve (scheduling the draft timer) before we fire it.
  await act(async () => { await vi.advanceTimersByTimeAsync(700) })
  vi.useRealTimers()

  expect(resizeSpy).toHaveBeenCalledWith(file)
  expect(screen.getByText('Kamra')).toBeInTheDocument()
})

test('editing an amount and deleting a line confirms with the edited single item', async () => {
  vi.useFakeTimers()
  const logSpy = vi.fn()
  hoisted.logMeal = logSpy as (input: MealInput) => void
  renderSheet()

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'csirkés wrap' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))
  await act(async () => { vi.advanceTimersByTime(700) })
  vi.useRealTimers()

  const amounts = screen.getAllByLabelText('Mennyiség')
  fireEvent.change(amounts[0], { target: { value: '80' } })
  const deletes = screen.getAllByLabelText('Sor törlése')
  fireEvent.click(deletes[1]) // drop the estimate line
  fireEvent.click(screen.getByRole('button', { name: 'Naplózás' }))

  expect(logSpy).toHaveBeenCalledTimes(1)
  const payload = logSpy.mock.calls[0][0] as MealInput
  expect(payload.items).toHaveLength(1)
  expect(payload.items[0].amount).toBe(80)
})

test('confirm builds the ai-text provenance and copies the estimate snapshot fields', async () => {
  vi.useFakeTimers()
  const logSpy = vi.fn()
  hoisted.logMeal = logSpy as (input: MealInput) => void
  renderSheet()

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'csirkés wrap' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))
  await act(async () => { vi.advanceTimersByTime(700) })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: 'Naplózás' }))

  const payload = logSpy.mock.calls[0][0] as MealInput
  expect(payload.provenance?.origin).toBe('ai-text')
  expect(payload.provenance?.rawText).toBe('csirkés wrap')
  const est = payload.items.find(i => i.source === 'estimate') as MealEstimateInputItem
  expect(est).toBeTruthy()
  expect(est.per).toBe(1)
  expect(est.basisUnit).toBe('db')
  expect(est.kcal).toBe(450)
  expect(est.proteinG).toBe(28)
  expect(est.carbsG).toBe(40)
  expect(est.fatG).toBe(18)
})

test('an empty draft shows the not-recognised ghost + falls back to manual logging', async () => {
  hoisted.draft = () => Promise.resolve({ slot: 'snack', title: null, note: null, items: [] })
  const onManualFallback = vi.fn()
  renderSheet({ onManualFallback })

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'valami furcsa' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))

  expect(await screen.findByText(/Nem ismertem fel ételt/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Kézi naplózás' }))
  expect(onManualFallback).toHaveBeenCalled()
})

test('a draft rejection shows the error copy and returns to the input phase', async () => {
  hoisted.draft = () => Promise.reject(new Error('network'))
  renderSheet()

  fireEvent.change(screen.getByLabelText('Mit ettél?'), { target: { value: 'valami' } })
  fireEvent.click(screen.getByRole('button', { name: /AI naplózás/ }))

  expect(await screen.findByText(/Nem sikerült az AI-feldolgozás/)).toBeInTheDocument()
  // back to input: the free-text field is on screen again
  expect(screen.getByLabelText('Mit ettél?')).toBeInTheDocument()
})
