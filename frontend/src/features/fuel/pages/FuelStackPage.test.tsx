import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function renderView() {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <MemoryRouter initialEntries={['/fuel/stack']}>
          <Routes>
            <Route path="/fuel/stack" element={<FuelStackPage />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryWrapper>,
  )
}

const kreatinStashRow = {
  id: 'kreatin', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle',
  dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false,
}

afterEach(() => vi.unstubAllEnvs())

describe('FuelStackPage — mock hub', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('közvetlenül a következő-bevétel heróval indul, duplikált page header nélkül', () => {
    const { container } = renderView()
    expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
    expect(container.querySelector('.mz-page-head')).toBeNull()
    expect(container.querySelector('.mz-page-hero')).toBeNull()
    const hero = container.querySelector('.mz-page-body')?.firstElementChild
    expect(hero).toHaveClass('stk-hub-next')
    expect(within(hero as HTMLElement).getByText('MOST KÖVETKEZIK')).toBeInTheDocument()
    expect(within(hero as HTMLElement).getByText('Origin PWO')).toBeInTheDocument()
    expect(within(hero as HTMLElement).getByText('20g')).toBeInTheDocument()
    expect(within(hero as HTMLElement).getByText(/Pump-stack ~40 perccel/)).toBeInTheDocument()
    expect(container.querySelector('use[href="#i-stack"]')).toBeInTheDocument()
  })

  test('hozzáférhető progress és legfeljebb háromsoros napi előnézet látszik', () => {
    const { container } = renderView()
    const progress = screen.getByRole('progressbar', { name: 'Mai Stack haladás' })
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '8')
    expect(container.querySelectorAll('.stk-rhythm-row').length).toBeLessThanOrEqual(3)
    expect(screen.getByRole('button', { name: 'Mind a 8 bevétel' })).toBeInTheDocument()
  })

  test.each([
    ['Teljes protokoll', '/fuel/stack/protocol'],
    ['Mai ritmus', '/fuel/stack/today'],
    ['Étkezéshez', '/fuel/stack/meals'],
    ['Kezelés', '/fuel/stack/manage'],
  ])('%s csempe a saját route-jára visz', async (label, path) => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByTestId('location')).toHaveTextContent(path)
  })

  test('sikeres pipa név szerinti toastot ad exact visszavonással', async () => {
    renderView()
    const tick = screen.getByRole('button', { name: 'Origin PWO bevétel jelölése' })
    await userEvent.click(tick)
    expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO bevéve')
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonás' }))
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'Origin PWO bevétel jelölése' }),
    ).toHaveAttribute('aria-pressed', 'false'))
  })
})

describe('FuelStackPage — real honest states', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('üres protokoll nem 0/0 siker, hanem a valódi add route-ra vezet', async () => {
    renderView()
    expect(await screen.findByText('A protokollod még üres')).toBeInTheDocument()
    expect(screen.queryByText('A mai stack kész')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tétel hozzáadása' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage/add')
  })

  test('egy bevett occurrence külön all-done állapotot mutat', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [kreatinStashRow] })),
      http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({ active: {
        id: 'proto-1', version: 1, builtAt: '2026-09-04T06:00:00Z', status: 'active', confidence: 0.9,
        items: [{ id: 'occ-1', pantryItemId: 'kreatin', slotKey: 'wake', pinned: false, placementSource: 'rule' }],
      }, history: [] })),
      http.get(`${API_BASE}/api/fuel/intake/:date`, () => HttpResponse.json({ intakes: [{
        id: 'intake-1', pantryItemId: 'kreatin', slotKey: 'wake', dose: '5g',
        takenAt: '2026-09-04T06:30:00Z', takenDate: '2026-09-04',
      }] })),
    )
    renderView()
    expect(await screen.findByText('A mai stack kész')).toBeInTheDocument()
    expect(screen.getByText('1 / 1 bevéve')).toBeInTheDocument()
  })

  test('nem kér le célt és üres real állapotban nem mutat success-toastot', async () => {
    let goalsCalls = 0
    server.use(http.get(`${API_BASE}/api/goals`, () => { goalsCalls += 1; return HttpResponse.json([]) }))
    renderView()
    await screen.findByText('A protokollod még üres')
    expect(goalsCalls).toBe(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('rejected log mutation nem mutat success-toastot', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [kreatinStashRow] })),
      http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({ active: {
        id: 'proto-1', version: 1, builtAt: '2026-09-04T06:00:00Z', status: 'active', confidence: 0.9,
        items: [{ id: 'occ-1', pantryItemId: 'kreatin', slotKey: 'wake', pinned: false, placementSource: 'rule' }],
      }, history: [] })),
      http.post(`${API_BASE}/api/fuel/intake`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
    )
    renderView()
    const tick = await screen.findByRole('button', { name: 'Kreatin bevétel jelölése' })
    await userEvent.click(tick)
    await waitFor(() => expect(screen.queryByText('Kreatin bevéve')).not.toBeInTheDocument())
  })
})
