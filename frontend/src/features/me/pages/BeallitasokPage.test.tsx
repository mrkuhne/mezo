import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Beállítások oldal — a korábbi téma-only SettingsSheet utódja (hub-tile-reorg spec).
// Csoportosított lista: Téma választó helyben + Értesítések / AI-napló sorok, amelyek a
// meglévő oldalakra navigálnak. A téma-viselkedés a sheet-teszt kontraktusának portja.

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.setItem('mezo-theme', 'light')
})
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/me/beallitasok']}>
          <>
            <Routes>
              <Route path="/me/beallitasok" element={<BeallitasokPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('a Téma választó helyben él az oldalon és átbillenti a data-theme-et', async () => {
  renderPage()
  expect(await screen.findByText('Téma')).toBeInTheDocument()
  // Manual light => no attribute (light is the CSS base); choosing Sötét flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('az Értesítések sor a kapcsolók oldalára navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Értesítések' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek/beallitasok')
})

test('az AI-napló sor az AI-napló oldalra navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'AI-napló' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ai-usage')
})

test('a vissza-chip az Én hubra visz', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('loc')).toHaveTextContent(/^\/me$/)
})
