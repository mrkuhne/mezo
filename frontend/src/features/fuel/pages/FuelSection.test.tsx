import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelSection reads the composed dual-mode fuel hooks (Mai's whole tree, via the Outlet) — pin
// mock mode for the static Phase-1 seed, mirroring FuelMaiPage.test.tsx's own setup.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
}

test('the header dropdown lists all six Fuel sub-views', async () => {
  renderApp('/fuel/stack')
  await userEvent.click(screen.getByRole('button', { name: 'Stack' }))
  for (const label of ['Mai', 'Terv', 'Stack', 'Receptek', 'Kamra', 'Gyógyszer']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  expect(document.querySelector('.np-pills')).toBeNull()
})

test('the Fuel alnavigáció dropdown carries a ⚙️ Fuel-beállítások extra action that opens FuelSettingsSheet', async () => {
  renderApp('/fuel')
  await userEvent.click(screen.getByRole('button', { name: 'Mai' }))
  const item = screen.getByRole('menuitem', { name: /Fuel-beállítások/ })
  expect(item).toBeInTheDocument()
  await userEvent.click(item)
  const dialog = await screen.findByRole('dialog', { name: 'Fuel beállítások' })
  // Something real from the sheet, not just the title — the meals-per-day segmented control.
  expect(within(dialog).getByText(/étkezés\/nap/i)).toBeInTheDocument()
})

test('KeretHero carries no settings entry of its own — Fuel-beállítások lives only in the dropdown', () => {
  renderApp('/fuel')
  expect(screen.queryByRole('button', { name: /szerkeszt/i })).toBeNull()
})
