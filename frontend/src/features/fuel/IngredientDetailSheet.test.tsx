import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IngredientDetailSheet } from './IngredientDetailSheet'
import { buildKamraItems } from './kamraItems'
import { usePantry } from '@/data/hooks'
import { supplementsStash } from '@/data/fuel'
import { QueryWrapper } from '@/test/queryWrapper'

// IngredientDetailSheet reads usePantry (categoryMeta) — a dual-mode TanStack query since Task 7.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const item = { id: 'ing-x', name: 'Görög joghurt', brand: 'Mizo', source: 'kifli.hu', category: 'dairy',
  kind: 'food', per: 100, unit: 'g', macros: { kcal: 119, p: 6, c: 4, f: 9 }, price: 1790,
  priceUnit: 'Ft/500g', pkg: '500g', micros: [{ name: 'Ca', pct: 78 }], nova: 3,
  stock: { qty: 400, unit: 'g', expires: 'Máj 25' }, lastUsed: 'tegnap', usedInRecipes: 2 } as any

test('renders macro hero + micros + stock and closes', async () => {
  const onClose = vi.fn()
  render(<IngredientDetailSheet item={item} onClose={onClose} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Görög joghurt')).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyag-density')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// Regression (mezo-9xu): buildKamraItems prefixes stash card ids with 'stash-'.
// Before the fix, Törlés/Frissítés/Szerkesztés forwarded that prefixed id, so the
// mock cache mutators (which match on the raw stash id) never matched — deleting a
// supplement was a silent no-op. This drives a STASH card end-to-end under a shared
// QueryClient and proves deleteItem now hits the unprefixed id.
test('deletes a stash supplement via the unprefixed backend id', async () => {
  // ONE QueryClient so the detail sheet's deleteItem and the read hook share a cache.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )

  // Build the unified card from the real seed so id ('stash-d3k2') + kind are authentic.
  const stashSeed = supplementsStash.find(s => s.id === 'd3k2')!
  const card = buildKamraItems([], [stashSeed]).find(i => i.id === 'stash-d3k2')!
  expect(card.id).toBe('stash-d3k2')
  expect(card.kind).toBe('supplement')

  const { result } = renderHook(() => usePantry(), { wrapper })
  // Seed is present before deletion.
  await waitFor(() => expect(result.current.stash.some(s => s.id === 'd3k2')).toBe(true))

  const onClose = vi.fn()
  render(<IngredientDetailSheet item={card} onClose={onClose} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: /Törlés a kamrából/ }))

  // The supplement must actually leave the shared cache — only possible if
  // deleteItem received 'd3k2', not 'stash-d3k2'.
  await waitFor(() => expect(result.current.stash.some(s => s.id === 'd3k2')).toBe(false))
  expect(onClose).toHaveBeenCalled()
})
