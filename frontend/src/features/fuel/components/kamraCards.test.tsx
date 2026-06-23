import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { KamraCard } from './KamraCard'
import { SuggestionCard } from './SuggestionCard'
import { QueryWrapper } from '@/test/queryWrapper'
import type { PantryItem } from '@/data/types'

// Direction A KamraCard is a pure presentational meal-card (no usePantry dependency).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const foodItem: PantryItem = {
  id: 'ing-x', name: 'Görög joghurt', brand: 'Mizo', source: 'kifli.hu',
  category: 'dairy', kind: 'food', per: 100, unit: 'g', macros: { kcal: 119, p: 6, c: 4, f: 9 },
  price: 1790, priceUnit: 'Ft/500g', pkg: '500g', micros: [], nova: 3,
  stock: { qty: 400, unit: 'g', expires: 'Máj 25' }, lastUsed: 'tegnap', usedInRecipes: 2,
}

test('food card shows macros + stock; click opens', async () => {
  const onOpen = vi.fn()
  render(<KamraCard item={foodItem} onOpen={onOpen} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Görög joghurt')).toBeInTheDocument()
  expect(screen.getByText('400')).toBeInTheDocument() // stock qty in the 44px slot
  expect(screen.getByText('119')).toBeInTheDocument() // kcal on the right
  await userEvent.click(screen.getByText('Görög joghurt'))
  expect(onOpen).toHaveBeenCalled()
})

test('SuggestionCard shows reason + Polcra button', () => {
  render(<SuggestionCard sug={{ name: 'ZMA', source: 'myprotein.hu', price: '4 990 Ft', reason: 'Alvás-minőség' }} />)
  expect(screen.getByText('Alvás-minőség')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Polcra' })).toBeInTheDocument()
})
