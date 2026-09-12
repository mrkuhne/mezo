import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FuelStackAddPage } from '@/features/fuel/pages/FuelStackAddPage'
import { FuelStackManageMealsPage } from '@/features/fuel/pages/FuelStackManageMealsPage'
import { FuelStackManagePage } from '@/features/fuel/pages/FuelStackManagePage'
import { FuelStackManageProtocolPage } from '@/features/fuel/pages/FuelStackManageProtocolPage'
import { FuelStackManageTimingPage } from '@/features/fuel/pages/FuelStackManageTimingPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'

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

  // S2 (mezo-g2vl): a Kamra-oldal (`/fuel/stack/manage/add`) HÁROM LÉPÉSES adag-beállítóvá
  // nőtt, és a saját tesztfájljába költözött: FuelStackAddPage.test.tsx. A korábbi
  // „egy koppintás = felvéve" felület megszűnt — a koppintás most a termék adataihoz vezet,
  // a felvétel a javaslat után történik.
})
