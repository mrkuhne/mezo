// ============================================================
// Mezo · Fuel Napló page (mezo-d20.4.1) — the hub's 6th tile → its own page.
// Scope: the day's honest record (AI average, today's totals, the logged meals with
// their scores). The designed WEEK-centric trend (iterations §6) is F3.6 + the F6.2
// backend series; nothing here fabricates a trend it cannot source.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { FuelNaploPage } from '@/features/fuel/pages/FuelNaploPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FuelMeal } from '@/data/types'

const hoisted = vi.hoisted(() => ({ meals: null as FuelMeal[] | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelDay: (date?: string) => {
      const real = actual.useFuelDay(date)
      if (hoisted.meals == null) return real
      return { ...real, fuel: { ...real.fuel, meals: hoisted.meals } }
    },
  }
})

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  vi.unstubAllEnvs()
  hoisted.meals = null
})

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'm1', slot: 'breakfast', title: 'Skyr-bowl', score: 0.9,
  kcal: 420, p: 36, c: 48, f: 9, mealItems: [], items: [], tags: [],
  loggedAt: '2026-05-22T07:30:00', mealDate: '2026-05-22',
  ...over,
} as FuelMeal)

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel', '/fuel/naplo']} initialIndex={1}>
        <Routes>
          <Route path="/fuel" element={<div>fuel-hub</div>} />
          <Route path="/fuel/naplo" element={<FuelNaploPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('the hero is the day\'s AI average on the sky page tone, with a back chip to the hub', async () => {
  hoisted.meals = [meal({ score: 0.9 }), meal({ id: 'm2', score: 0.8 })]
  renderPage()
  expect(await screen.findByText('Napló')).toBeInTheDocument()
  expect(screen.getByText('85')).toBeInTheDocument() // (90 + 80) / 2
  expect(screen.getByText('AI-átlag · ma')).toBeInTheDocument()
  expect(document.querySelector('.mz-page.mz-p-sky')).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('fuel-hub')).toBeInTheDocument()
})

test('nothing scored yet → the hero shows an em dash, never a fabricated 0 pont', async () => {
  hoisted.meals = [meal({ score: null })]
  renderPage()
  expect(await screen.findByText('—')).toBeInTheDocument()
  expect(screen.getByText('✨ folyamatban')).toBeInTheDocument()
})

test('each logged meal is a row with its time, kcal, protein and score chip', async () => {
  hoisted.meals = [meal({ title: 'Túrós zabkása', kcal: 580, p: 42, score: 0.92 })]
  renderPage()
  expect(await screen.findByText('Túrós zabkása')).toBeInTheDocument()
  expect(screen.getByText('07:30 · 580 kcal · 42 g P')).toBeInTheDocument()
  expect(screen.getByText('✨ 92 p')).toBeInTheDocument()
})

test('a day with no logged meal says so instead of drawing an empty chart', async () => {
  hoisted.meals = []
  renderPage()
  expect(await screen.findByText('Ma még nincs logolt étkezés.')).toBeInTheDocument()
  expect(document.querySelectorAll('.fh-naplorow')).toHaveLength(0)
})
