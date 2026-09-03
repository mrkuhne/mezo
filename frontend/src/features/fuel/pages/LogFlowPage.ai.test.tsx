// ============================================================
// Mezo · LogFlowPage — AI-panel behaviours inherited from the retired AiLogSheet (mezo-d20.9.1).
// LogFlowPage.test.tsx already covers the panel's enable/disable gate, the mixed manual+AI line
// list, the ai-text provenance and the draft-failure path. The contracts retargeted HERE are the
// ones that lived only in AiLogSheet.test.tsx: the photo arm (downscale-before-draft, thumbnail,
// ai-photo provenance) and the slot-lock pair (mezo-53su). Separate file because the resizeImage
// mock has to be a spy, where LogFlowPage.test.tsx wants a plain passthrough.
// ============================================================
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MealInput } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

const resizeSpy = vi.hoisted(() => vi.fn((f: Blob) => Promise.resolve(f)))
vi.mock('@/shared/lib/resizeImage', () => ({ resizeImage: resizeSpy }))

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

const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // jsdom has no createObjectURL — provide one so the thumbnail can resolve a src.
  URL.createObjectURL = vi.fn(() => 'blob:thumb') as never
  URL.revokeObjectURL = vi.fn() as never
})
afterEach(() => {
  hoisted.logMeal = null
  resizeSpy.mockClear()
  vi.unstubAllEnvs()
})

async function openAiPanel(initialSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack') {
  render(<LogFlowPage initialSlot={initialSlot} onClose={vi.fn()} />, { wrapper })
  await userEvent.click(screen.getByRole('button', { name: '✨ AI · fotó vagy szöveg' }))
}

test('an attached photo renders a thumbnail preview, not just the filename (mezo-j4e6)', async () => {
  await openAiPanel()
  fireEvent.change(screen.getByLabelText('Étel fotó'),
    { target: { files: [new File(['x'], 'ebed.jpg', { type: 'image/jpeg' })] } })

  const thumb = await screen.findByAltText('Fotó előnézet') as HTMLImageElement
  expect(thumb.src).toContain('blob:thumb')
})

test('the photo path downscales the image before drafting, and saves ai-photo provenance (mezo-j4e6)', async () => {
  const logMeal = vi.fn()
  hoisted.logMeal = logMeal
  await openAiPanel()

  const file = new File(['x'], 'ebed.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Étel fotó'), { target: { files: [file] } })
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')

  expect(resizeSpy).toHaveBeenCalledWith(file)

  await userEvent.click(screen.getByRole('button', { name: /Logolás · \+10 XP/ }))
  const payload = logMeal.mock.calls[0][0] as MealInput
  expect(payload.provenance?.origin).toBe('ai-photo')
  expect(payload.provenance?.rawText).toBeNull() // photo-only: no free text
})

// MOCK_AI_MEAL_DRAFT proposes 'lunch' (Ebéd), so a launch on a DIFFERENT slot proves the lock;
// without initialSlot the draft's own slot wins.
test('slot-lock: an initialSlot survives the draft — the AI-proposed slot does not override it (mezo-53su)', async () => {
  await openAiPanel('breakfast')
  await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap')
  await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
  await screen.findByText('Csirkés wrap')

  expect(screen.getByRole('button', { name: 'Reggeli' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Ebéd' })).toHaveAttribute('aria-pressed', 'false')
})

test('no initialSlot: the AI-proposed slot wins (mezo-53su)', async () => {
  // 22:10 wall clock → defaultMealSlot() is 'snack', so 'lunch' can only come from the draft.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T22:10:00'))
  try {
    await openAiPanel()
    expect(screen.getByRole('button', { name: 'Snack' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByRole('textbox', { name: 'Mit ettél?' }), 'csirkés wrap')
    await userEvent.click(screen.getByRole('button', { name: '✨ Elemzés' }))
    await screen.findByText('Csirkés wrap')
    expect(screen.getByRole('button', { name: 'Ebéd' })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    vi.useRealTimers()
  }
})
