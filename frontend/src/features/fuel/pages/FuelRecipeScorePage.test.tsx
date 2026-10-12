// ============================================================
// Mezo · FuelRecipeScorePage (Folyadék F5, mezo-n4wf5.5) — a recept értékelése a közös `FuelScoreSurface`-en.
// Mock módban a recept és a bontása a seedből jön (`useRecipes`, `useRecipeBreakdown`).
// ============================================================
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useRecipes } from '@/data/hooks'
import { RECIPES_KEY } from '@/data/fuel/queryKeys'
import { fmtGrouped } from '@/shared/lib/format'
import { FuelRecipeScorePage } from '@/features/fuel/pages/FuelRecipeScorePage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
function recipesOf(qc: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useRecipes(), { wrapper }).result.current.recipes
}
function Probe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
function mount(id: string, qc = newQc()) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}/ertekeles`]}>
        <Routes>
          <Route path="/fuel/recipes/:id/ertekeles" element={<FuelRecipeScorePage />} />
          <Route path="/fuel/recipes/:id" element={<Probe />} />
          <Route path="/fuel/recipes" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('a hős felirata a sablonról szól, EGY ADAG kcal-jával — nem az egész receptével', () => {
  const qc = newQc()
  const all = recipesOf(qc)
  const rec = all.find(r => !!r.templateBreakdown)!
  // a seed receptjei egyadagosak: a két bázis csak többadagos recepten válik el
  qc.setQueryData(RECIPES_KEY, all.map(r => (r.id === rec.id ? { ...r, servings: 2 } : r)))
  const { container } = mount(rec.id, qc)
  const per = fmtGrouped(Math.round(rec.macros.kcal / 2))
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent(`Recept · sablon · 1 adag · ${per} kcal`)
  expect(container.textContent).not.toContain(`${fmtGrouped(rec.macros.kcal)} kcal`)
  expect(container.textContent).not.toContain('/ adag')
  expect(container.textContent).not.toMatch(/AI ÉRTÉKELÉS|Bizonyosság/)
  // ugyanaz a felület, mint az étkezésé
  expect(container.querySelectorAll('.fe-8 .fo-vial').length).toBe(rec.templateBreakdown!.dimensions.length)
  expect(screen.getByRole('heading', { name: /Miből áll össze\?/ })).toBeInTheDocument()
  expect(container.querySelector('[class*="fmx-"], .glass')).toBeNull()
})

test('a jegyzet a sablonról beszél; nem-általános szerepnél megnevezi a mércét', () => {
  const qc = newQc()
  const all = recipesOf(qc)
  const pre = all.find(r => r.role === 'pre_workout' && !!r.templateBreakdown)!
  const { container, unmount } = mount(pre.id, qc)
  expect(container.querySelector('.fe-fbc')).toHaveTextContent(
    'A recept pontszáma a sablonra szól, egy adagra vetítve; nem arra, amit végül megettél. A mérce ehhez a szerephez igazodik: edzés előtti. Amit belőle logolsz, a saját étkezés-értékelését kapja.')
  unmount()
  const std = all.find(r => r.role === 'standard' && !!r.templateBreakdown)!
  const second = mount(std.id, newQc())
  expect(second.container.querySelector('.fe-fbc')).toHaveTextContent('Amit belőle logolsz, a saját étkezés-értékelését kapja.')
  expect(second.container.textContent).not.toMatch(/mérce/)
})

test('a hős gombja vissza a recepthez visz', async () => {
  const qc = newQc()
  const rec = recipesOf(qc).find(r => !!r.templateBreakdown)!
  mount(rec.id, qc)
  await userEvent.click(screen.getByRole('button', { name: 'A recept részletei' }))
  expect(screen.getByTestId('location')).toHaveTextContent(`/fuel/recipes/${rec.id}`)
})

test('a recept nincs meg: őszinte üres arc, vissza a Receptekhez', async () => {
  mount('nincs-ilyen')
  expect(screen.getByText('Ez a recept nincs meg.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a Receptekhez' }))
  expect(screen.getByTestId('location')).toHaveTextContent('/fuel/recipes')
})

test('bontás nélkül: „még nincs értékelés", vissza a recepthez', async () => {
  const qc = newQc()
  const all = recipesOf(qc)
  const bare = all.find(r => !r.templateBreakdown)
  if (!bare) throw new Error('no seed recipe without a template breakdown')
  mount(bare.id, qc)
  expect(screen.getByText('Ehhez a recepthez még nincs értékelés.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a recepthez' }))
  expect(screen.getByTestId('location')).toHaveTextContent(`/fuel/recipes/${bare.id}`)
})
