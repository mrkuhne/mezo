// ============================================================
// Fuel Titanium S5 (mezo-qt5q): a visszavont `RecipeCard` EGYETLEN szerződése, amit a Titán
// `RecipeTile` átvett — az ADAGRA vetített kcal. A `RecipeCard.test.tsx` „a makró-strip egy
// adagra vetít — a bázis nem a teljes recept" köre a kártyával együtt ment, de a VISELKEDÉST a
// csempe tovább hordozza, ezért a mérce ide került át, nem töröltük.
//
// Saját fájl, mert a mock-seed MINDEN receptje egy adagos (`pantry.ts` `servings: 1`), tehát a
// lap alap-tesztje ezt nem tudná megmérni: itt a `useRecipes` ad egy négy adagos receptet.
// ============================================================
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Recipe } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'

const FOUR_SERVINGS: Recipe = {
  id: 'r-multi',
  name: 'Bolognai egytálétel',
  slot: 'dinner',
  category: 'dinner',
  createdDate: '2026-09-01',
  timesLogged: 0,
  avgScore: 0,
  lastLogged: '',
  servings: 4,
  prepMins: 10,
  cookMins: 35,
  tags: [],
  ingredients: [],
  // A TELJES recept makrói — a csempének ezt kell elosztania.
  macros: { kcal: 2480, p: 140, c: 240, f: 84 },
  novaDominant: 1,
  mezoFit: { score: null, fitsFor: [] },
  starred: false,
  role: 'standard',
}

vi.mock('@/data/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/data/hooks')>(),
  useRecipes: () => ({ recipes: [FOUR_SERVINGS], pending: false, error: null }),
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('a csempe kcal-száma egy ADAGRA vetít, nem a teljes receptre', async () => {
  const { FuelRecipesPage } = await import('@/features/fuel/pages/FuelRecipesPage')
  render(
    <QueryWrapper><MemoryRouter><FuelRecipesPage /></MemoryRouter></QueryWrapper>,
  )
  const card = screen.getByRole('button', { name: new RegExp(FOUR_SERVINGS.name) })
  // 2480 / 4 = 620 — és SOHA a teljes 2 480.
  expect(card).toHaveTextContent('620')
  expect(card.textContent).not.toContain('2 480')
  expect(card).toHaveTextContent('kcal / adag')
})
