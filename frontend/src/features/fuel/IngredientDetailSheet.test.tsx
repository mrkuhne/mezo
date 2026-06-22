import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { IngredientDetailSheet } from './IngredientDetailSheet'
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
