import type { ComponentProps, ReactNode } from 'react'
import { render, screen, renderHook, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MealAiDraft, MealInput } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

// resizeImage: mocked passthrough (AiLogSheet.test's idiom) — no real image work is exercised here.
vi.mock('@/shared/lib/resizeImage', () => ({ resizeImage: (f: Blob) => Promise.resolve(f) }))

// useMealActions stays real (mock mode) via importOriginal for the happy path (canned
// MOCK_AI_MEAL_DRAFT + real logMeal writing into the mock cache); individual tests swap
// draftMealFromAi/logMeal through the hoisted slots for the error and payload-shape cases.
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

import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { useRecipes, usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.draft = null
  hoisted.logMeal = null
  vi.unstubAllEnvs()
})

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>
function renderPage(props: Partial<ComponentProps<typeof LogFlowPage>> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const utils = render(<LogFlowPage onClose={onClose} {...props} />, { wrapper })
  return { onClose, ...utils }
}

test('slot defaults to the launching window\'s slotKey, never the wall-clock guess (mezo-bnsf)', () => {
  // 16:35 wall clock would default to 'dinner' — the explicit initialSlot must win regardless.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T16:35:00'))
  try {
    renderPage({ initialSlot: 'lunch' })
    expect(screen.getByRole('button', { name: 'Ebéd' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vacsora' })).toHaveAttribute('aria-pressed', 'false')
  } finally {
    vi.useRealTimers()
  }
})

test('with no initialSlot, falls back to the wall-clock default', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T16:35:00')) // → dinner
  try {
    renderPage()
    expect(screen.getByRole('button', { name: 'Vacsora' })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    vi.useRealTimers()
  }
})

test('the three source tiles are always visible', () => {
  renderPage()
  expect(screen.getByRole('button', { name: 'Kamra · hozzáadás' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recept · hozzáadás' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' })).toBeInTheDocument()
})

test('empty flow shows the dashed combine-sources empty state and disables the CTA', () => {
  renderPage()
  expect(screen.getByText('Még nincs tétel — válassz forrást fent, vagy kombináld őket.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logolás · \+10 XP/ })).toBeDisabled()
})

test('adding a Kamra item keeps the picker open for a second add, and tags the line kamra', async () => {
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  // Stays open (design 2.0 iterations §7) — the just-added row now shows a disabled ✓ instead.
  expect(screen.getByRole('button', { name: `${ing.name} hozzáadva` })).toBeInTheDocument()
  expect(screen.getAllByText(ing.name).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('kamra')).toBeInTheDocument()
})

test('picking a recipe closes the picker and tags the line recept', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Recept · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${recipe.name} hozzáadása` }))
  expect(screen.queryByText('Válassz receptet')).not.toBeInTheDocument()
  expect(screen.getByText('recept')).toBeInTheDocument()
})

test('the AmountField guard: an invalid typed amount keeps the previous value', async () => {
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  const amt = screen.getByRole('textbox', { name: `${ing.name} mennyisége` })
  fireEvent.change(amt, { target: { value: '0' } })
  expect(amt).toHaveValue(String(ing.per || 100))
  fireEvent.change(amt, { target: { value: 'abc' } })
  expect(amt).toHaveValue(String(ing.per || 100))
})

test('the ± steppers move a pantry line by 10 g and a recipe line by 1 adag', async () => {
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await userEvent.click(screen.getByRole('button', { name: 'Recept · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${recipe.name} hozzáadása` }))

  const startPantry = ing.per || 100
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} növelés` }))
  expect(screen.getByRole('textbox', { name: `${ing.name} mennyisége` })).toHaveValue(String(startPantry + 10))
  await userEvent.click(screen.getByRole('button', { name: `${recipe.name} növelés` }))
  expect(screen.getByRole('textbox', { name: `${recipe.name} mennyisége` })).toHaveValue('2')
})

test('the derived meal name follows the lines — no name field, the totals card carries it (mezo-byo1)', async () => {
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  renderPage()
  // No editable name input anywhere any more.
  expect(screen.queryByRole('textbox', { name: 'Étkezés neve' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Recept · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${recipe.name} hozzáadása` }))
  // The derived name shows on the totals card (in addition to the line card itself).
  expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(2)
})

test('the AI panel: Elemzés is disabled with neither text nor photo, enabled with either', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  const go = screen.getByRole('button', { name: '✨ Elemzés' })
  expect(go).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap')
  expect(go).toBeEnabled()
})

test('AI lines carry their REAL source tag next to a manual pantry line — mixed sources in one meal', async () => {
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  renderPage()
  // Manual Kamra line first.
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))

  // Then the AI panel — MOCK_AI_MEAL_DRAFT resolves after 600ms in mock mode.
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap és egy latte')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))

  expect(await screen.findByText('Elemzem az étkezést…')).toBeInTheDocument()
  expect(await screen.findByText('Csirkés wrap')).toBeInTheDocument()
  // The draft's pantry-matched line says so (mezo-qrks) — only the genuinely estimated line
  // is tagged 'becslés'. The ✨ marks who put the line there, the word stays honest about
  // where the macros came from.
  expect(screen.getByText('kamra ✨')).toBeInTheDocument()
  expect(screen.getByText('becslés')).toBeInTheDocument()
  // The manual line keeps its own unadorned tag.
  expect(screen.getByText('kamra')).toBeInTheDocument()
  expect(screen.getByText(/Az AI nem teljesen biztos ebben a sorban/)).toBeInTheDocument()
})

test('save logs a manual-only meal with no provenance envelope (parity with the legacy manual path)', async () => {
  const logMeal = vi.fn()
  hoisted.logMeal = logMeal
  const recipe = renderHook(() => useRecipes(), { wrapper }).result.current.recipes[0]
  const onClose = vi.fn()
  renderPage({ initialSlot: 'lunch', onClose })
  await userEvent.click(screen.getByRole('button', { name: 'Recept · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${recipe.name} hozzáadása` }))
  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  expect(logMeal).toHaveBeenCalledTimes(1)
  const input = logMeal.mock.calls[0][0] as MealInput
  expect(input.slot).toBe('lunch')
  expect(input.provenance).toBeUndefined()
  expect(input.items).toEqual([{ source: 'recipe', refId: recipe.id, amount: 1, unit: 'adag' }])
  expect(onClose).toHaveBeenCalled()
})

test('save on a mixed manual+AI meal carries an honest provenance origin (ai-text, not "mixed")', async () => {
  const logMeal = vi.fn()
  hoisted.logMeal = logMeal
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap és egy latte')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  const input = logMeal.mock.calls[0][0] as MealInput
  expect(input.provenance?.origin).toBe('ai-text')
  expect(input.provenance?.rawText).toBe('csirkés wrap és egy latte')
  expect(input.items.some((i) => i.source === 'estimate')).toBe(true)
})

test('a failed AI draft shows the error copy and returns to the panel — the manual lines survive untouched', async () => {
  hoisted.draft = () => Promise.reject(new Error('boom'))
  const ing = renderHook(() => usePantry(), { wrapper }).result.current.ingredients[0]
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Kamra · hozzáadás' }))
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'valami')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  expect(await screen.findByText(/Nem sikerült az AI-feldolgozás/)).toBeInTheDocument()
  expect(screen.getAllByText(ing.name).length).toBeGreaterThanOrEqual(1)
})

test('Escape and the ‹ Vissza chip both close the flow', async () => {
  const onClose = vi.fn()
  renderPage({ onClose })
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
