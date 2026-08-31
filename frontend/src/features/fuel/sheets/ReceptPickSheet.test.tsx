// Mezo · ReceptPickSheet — the ★-filter + coral kind-wash picker face (mezo-byo1).
import type { ReactNode } from 'react'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { ReceptPickSheet } from '@/features/fuel/sheets/ReceptPickSheet'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

function renderSheet(onPick = vi.fn(), onClose = vi.fn()) {
  const { qc, wrapper } = setup()
  render(
    <QueryClientProvider client={qc}>
      <ReceptPickSheet onPick={onPick} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { wrapper, onPick, onClose }
}

test('the ★ csillagos chip narrows to starred recipes; toggling off restores the full list', async () => {
  const { wrapper } = renderSheet()
  const { recipes } = renderHook(() => useRecipes(), { wrapper }).result.current
  const starred = recipes.find(r => r.starred)
  const unstarred = recipes.find(r => !r.starred)
  // The mock seed carries both kinds — the filter is only testable with both present.
  expect(starred).toBeTruthy()
  expect(unstarred).toBeTruthy()

  await userEvent.click(screen.getByRole('button', { name: '★ csillagos' }))
  expect(screen.getByText(starred!.name)).toBeInTheDocument()
  expect(screen.queryByText(unstarred!.name)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '★ csillagos' }))
  expect(screen.getByText(unstarred!.name)).toBeInTheDocument()
})

test('the ★ filter composes with search; an empty intersection says so honestly', async () => {
  const { wrapper } = renderSheet()
  const { recipes } = renderHook(() => useRecipes(), { wrapper }).result.current
  const unstarred = recipes.find(r => !r.starred)!
  await userEvent.click(screen.getByRole('button', { name: '★ csillagos' }))
  await userEvent.type(screen.getByLabelText('Keresés a receptek között'), unstarred.name)
  expect(screen.queryByText(unstarred.name)).not.toBeInTheDocument()
  expect(screen.getByText('Nincs ilyen recept.')).toBeInTheDocument()
})

test('picking a recipe calls onPick and CLOSES the sheet (single-add)', async () => {
  const { wrapper, onPick, onClose } = renderSheet()
  const { recipes } = renderHook(() => useRecipes(), { wrapper }).result.current
  await userEvent.click(screen.getByRole('button', { name: `${recipes[0].name} hozzáadása` }))
  expect(onPick).toHaveBeenCalledTimes(1)
  // The Sheet animates out before reporting the close.
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('a starred recipe row carries the ★ mark', () => {
  const { wrapper } = renderSheet()
  const { recipes } = renderHook(() => useRecipes(), { wrapper }).result.current
  const starredCount = recipes.filter(r => r.starred).length
  expect(screen.getAllByLabelText('csillagos')).toHaveLength(starredCount)
})
