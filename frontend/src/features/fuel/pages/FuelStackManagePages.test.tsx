import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackAddPage } from '@/features/fuel/pages/FuelStackAddPage'
import { FuelStackManageMealsPage } from '@/features/fuel/pages/FuelStackManageMealsPage'
import { FuelStackManagePage } from '@/features/fuel/pages/FuelStackManagePage'
import { FuelStackManageProtocolPage } from '@/features/fuel/pages/FuelStackManageProtocolPage'
import { FuelStackManageTimingPage } from '@/features/fuel/pages/FuelStackManageTimingPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

function LocationProbe() { return <div data-testid="location">{useLocation().pathname}</div> }

function renderPage(path: string) {
  return render(<QueryWrapper><ToastProvider><MemoryRouter initialEntries={[path]}>
    <LocationProbe />
    <Routes>
      <Route path="/fuel/stack/manage" element={<FuelStackManagePage />} />
      <Route path="/fuel/stack/manage/protocol" element={<FuelStackManageProtocolPage />} />
      <Route path="/fuel/stack/manage/timing" element={<FuelStackManageTimingPage />} />
      <Route path="/fuel/stack/manage/meals" element={<FuelStackManageMealsPage />} />
      <Route path="/fuel/stack/manage/add" element={<FuelStackAddPage />} />
    </Routes>
  </MemoryRouter></ToastProvider></QueryWrapper>)
}

afterEach(() => vi.unstubAllEnvs())

describe('Stack management — mock', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('a Kezelés hub valós darabszámokkal négy oldalra bontja a feladatokat', async () => {
    const { container } = renderPage('/fuel/stack/manage')
    expect(screen.getByText('Protokoll kezelése')).toBeInTheDocument()
    expect(container.querySelector('.mz-page.mz-p-lav')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Protokoll tételei' })).toHaveTextContent('8 tétel')
    expect(screen.getByRole('button', { name: 'Időzítési rend' })).toHaveTextContent('5 zóna')
    expect(screen.getByRole('button', { name: 'Étkezési horgonyok' })).toHaveTextContent('2 tétel')
    expect(screen.getByRole('button', { name: 'Új tétel a Kamrából' })).toHaveTextContent('9 kamratétel')
    await userEvent.click(screen.getByRole('button', { name: 'Időzítési rend' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage/timing')
  })

  test('a protokoll-lencséből a teljes szerkesztő sheet elérhető', async () => {
    renderPage('/fuel/stack/manage/protocol')
    expect(screen.getByText('Protokoll tételei')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mentés' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Kreatin monohidrát beállítások' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Dózis')).toBeInTheDocument()
    expect(within(dialog).getByText('Mozgatás másik zónába')).toBeInTheDocument()
    expect(within(dialog).getByText('+ Még egy bevétel')).toBeInTheDocument()
    expect(within(dialog).getByText(/Eltávolítás a stackből/)).toBeInTheDocument()
  })

  test('az időzítési lencse minden zónát, időt és horgonyt mutat', () => {
    renderPage('/fuel/stack/manage/timing')
    expect(screen.getByText('Időzítési rend')).toBeInTheDocument()
    expect(screen.getByText('06:45')).toBeInTheDocument()
    expect(screen.getAllByText(/edzés előtt/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Mentés' })).not.toBeInTheDocument()
  })

  test('az étkezési lencse csak étkezési zónákat mutat', () => {
    renderPage('/fuel/stack/manage/meals')
    expect(screen.getByText('Étkezési horgonyok')).toBeInTheDocument()
    expect(screen.getByText('Ebéd')).toBeInTheDocument()
    expect(screen.queryByText('Edzés előtt')).not.toBeInTheDocument()
  })

  test.each(['/fuel/stack/manage/protocol', '/fuel/stack/manage/timing', '/fuel/stack/manage/meals'])(
    '%s visszalép a kezelési hubra', async path => {
      renderPage(path)
      await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
      expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage')
    },
  )

  test('a Kamra-oldal szűr, jelöl és egymás után több tételt ad hozzá toasttal', async () => {
    renderPage('/fuel/stack/manage/add')
    const search = screen.getByRole('searchbox', { name: 'Keresés a Kamrában' })
    await userEvent.type(search, 'cink')
    await userEvent.click(screen.getByRole('button', { name: /Cink-biszglicinát/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Cink-biszglicinát hozzáadva')
    await userEvent.clear(search)
    await userEvent.type(search, 'kreatin')
    const kreatin = screen.getByRole('button', { name: /Kreatin monohidrát/ })
    expect(kreatin).toHaveTextContent('a stackben')
    await userEvent.click(kreatin)
    expect(await screen.findByText('Kreatin monohidrát hozzáadva')).toBeInTheDocument()
    expect(search).toBeInTheDocument()
  })
})

test('rejected add nem mutat success-toastot', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [{
      id: 'k', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle', dose: '5g',
      form: 'por', stock: 10, stockUnit: 'adag', protocol: '', timing: 'morning', taken: false,
    }] })),
    http.post(`${API_BASE}/api/fuel/protocol/items`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
  )
  renderPage('/fuel/stack/manage/add')
  await userEvent.click(await screen.findByRole('button', { name: /Kreatin/ }))
  expect(screen.queryByText('Kreatin hozzáadva')).not.toBeInTheDocument()
})

test('a "null" keresőszó nem illeszkedik egy null márkájú tételre (mezo-xaq5)', async () => {
  // Regression guard: a template literal (`${item.name} ${item.brand}`) stringifies a null
  // brand to the literal word "null" — a bare `${item.brand}` (no `?? ''` boundary guard) would
  // make a null-brand stash row falsely match the search term "null". pnpm build cannot catch
  // this: the template literal accepts any type, so only a runtime assertion proves it.
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [{
      id: 'null-brand', name: 'Magnézium-glicinát', brand: null, type: 'supplement', category: 'sleep',
      dose: '300mg', form: 'kapszula', stock: 10, stockUnit: 'db', protocol: '', timing: 'evening', taken: false,
      macros: { kcal: null, p: null, c: null, f: null },
    }] })),
  )
  renderPage('/fuel/stack/manage/add')
  const search = await screen.findByRole('searchbox', { name: 'Keresés a Kamrában' })
  expect(await screen.findByRole('button', { name: /Magnézium-glicinát/ })).toBeInTheDocument()
  await userEvent.type(search, 'null')
  expect(screen.queryByRole('button', { name: /Magnézium-glicinát/ })).not.toBeInTheDocument()
})
