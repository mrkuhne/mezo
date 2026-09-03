// Mezo · KamraPickSheet — the category-chip + kind-wash picker face (mezo-byo1).
import type { ReactNode } from 'react'
import { render, screen, renderHook, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { KamraPickSheet } from '@/features/fuel/sheets/KamraPickSheet'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

function renderSheet(extra: { onPick?: (i: unknown) => void; addedRefIds?: string[] } = {}) {
  const { qc, wrapper } = setup()
  const view = render(
    <QueryClientProvider client={qc}>
      <KamraPickSheet onPick={extra.onPick ?? vi.fn()} onClose={vi.fn()} addedRefIds={extra.addedRefIds} />
    </QueryClientProvider>,
  )
  return { view, wrapper }
}

test('renders one color-dotted chip per category present on the shelf, plus Mind', () => {
  const { wrapper } = renderSheet()
  const pantry = renderHook(() => usePantry(), { wrapper }).result.current
  const cats = [...new Set(pantry.ingredients.map(i => i.category))].filter(Boolean)
  const group = screen.getByRole('group', { name: 'Kategória-szűrő' })
  // Mind + one chip per present category — never a chip for an absent category.
  expect(within(group).getAllByRole('button')).toHaveLength(cats.length + 1)
  expect(within(group).getByRole('button', { name: 'Mind' })).toHaveAttribute('aria-pressed', 'true')
})

test('a category chip narrows the list to its own items; tapping it again restores Mind', async () => {
  const { wrapper } = renderSheet()
  const pantry = renderHook(() => usePantry(), { wrapper }).result.current
  const cats = [...new Set(pantry.ingredients.map(i => i.category))].filter(Boolean)
  // Pick a category that does NOT cover the whole shelf, so narrowing is observable.
  const cat = cats.find(c => pantry.ingredients.some(i => i.category !== c))!
  const inCat = pantry.ingredients.filter(i => i.category === cat)
  const outOfCat = pantry.ingredients.find(i => i.category !== cat)!
  const label = pantry.categoryMeta[cat]?.label ?? cat

  const group = screen.getByRole('group', { name: 'Kategória-szűrő' })
  await userEvent.click(within(group).getByRole('button', { name: label }))
  expect(screen.getByText(inCat[0].name)).toBeInTheDocument()
  expect(screen.queryByText(outOfCat.name)).not.toBeInTheDocument()

  // Toggle off → the full shelf is back.
  await userEvent.click(within(group).getByRole('button', { name: label }))
  expect(screen.getByText(outOfCat.name)).toBeInTheDocument()
})

test('search and category chip compose; an empty intersection says so honestly', async () => {
  const { wrapper } = renderSheet()
  const pantry = renderHook(() => usePantry(), { wrapper }).result.current
  const cats = [...new Set(pantry.ingredients.map(i => i.category))].filter(Boolean)
  const cat = cats.find(c => pantry.ingredients.some(i => i.category !== c))!
  const outOfCat = pantry.ingredients.find(i => i.category !== cat)!
  const label = pantry.categoryMeta[cat]?.label ?? cat

  const group = screen.getByRole('group', { name: 'Kategória-szűrő' })
  await userEvent.click(within(group).getByRole('button', { name: label }))
  // Search for an item that exists but sits OUTSIDE the active category.
  await userEvent.type(screen.getByLabelText('Keresés a kamrában'), outOfCat.name)
  expect(screen.queryByText(outOfCat.name)).not.toBeInTheDocument()
  expect(screen.getByText('Nincs találat ebben a kategóriában.')).toBeInTheDocument()
})

test('an already-added item shows the ✓ state and cannot be re-picked', () => {
  const { wrapper } = setup()
  const pantry = renderHook(() => usePantry(), { wrapper }).result.current
  const ing = pantry.ingredients[0]
  renderSheet({ addedRefIds: [ing.id] })
  expect(screen.getByRole('button', { name: `${ing.name} hozzáadva` })).toBeDisabled()
})

test('picking an item calls onPick and the sheet STAYS OPEN (multi-add)', async () => {
  const onPick = vi.fn()
  const { wrapper } = renderSheet({ onPick })
  const pantry = renderHook(() => usePantry(), { wrapper }).result.current
  const ing = pantry.ingredients[0]
  await userEvent.click(screen.getByRole('button', { name: `${ing.name} hozzáadása` }))
  expect(onPick).toHaveBeenCalledTimes(1)
  // Still open: the title is still on screen.
  expect(screen.getByText('Válassz a polcról')).toBeInTheDocument()
})
