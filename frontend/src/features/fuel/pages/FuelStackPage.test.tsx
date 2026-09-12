// ============================================================
// Mezo · FuelStackPage tesztek (Fuel Titanium S2, mezo-g2vl — manifeszt D1).
//
// A hub főnézete a MAI lista, idősávokra bontva, egyérintéses pipálással (owner). A korábbi
// négy-csempés hub + `/fuel/stack/today` páros ÖSSZEVONT: a mai lista itt él.
// ============================================================
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

  // D1 (mezo-g2vl): a főnézet a mai lista, idősávokra bontva, egyérintéses pipálással.
  test('a mai lista idősávokban jelenik meg, duplikált page header nélkül', () => {
    const { container } = renderView()
    expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
    expect(container.querySelector('.mz-page-head')).toBeNull()
    expect(container.querySelector('.mz-page-hero')).toBeNull()
    expect(container.querySelectorAll('.fsx-band').length).toBeGreaterThan(0)
    expect(screen.getByText('MIT VESZEK BE MA?')).toBeInTheDocument()
    expect(container.querySelector('use[href="#i-kiegeszito"]')).toBeInTheDocument()
  })

  test('hozzáférhető haladás-műszer mutatja a mai készültséget', () => {
    renderView()
    const progress = screen.getByRole('progressbar', { name: 'Mai kiegészítő-haladás' })
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '8')
  })

  test('egy érintés bevettre állítja a tételt, és a bevétel visszavonható', async () => {
    renderView()
    const tick = screen.getAllByRole('button', { name: /Origin PWO: bevettem/ })[0]
    await userEvent.click(tick)
    expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO bevéve')
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonás' }))
    await waitFor(() => expect(
      screen.getAllByRole('button', { name: /Origin PWO: bevettem/ })[0],
    ).toHaveAttribute('aria-pressed', 'false'))
  })

  // A most esedékes sáv kiemelten áll, de a többi nem tűnik el.
  test('a most esedékes sáv kiemelt', () => {
    const { container } = renderView()
    expect(container.querySelectorAll('.fsx-band.is-due')).toHaveLength(1)
    expect(container.querySelectorAll('.fsx-band').length).toBeGreaterThan(1)
  })

  // Egy tétel koppintása üvegkártyát nyit a részleteivel.
  test('a tétel koppintása üvegkártyát nyit', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /D3 \+ K2 részletei/ }))
    const box = screen.getByRole('dialog')
    expect(box.className).toContain('glass')
    expect(within(box).getByText(/Miért/i)).toBeInTheDocument()
    expect(within(box).getByText(/nem orvosi tanács/i)).toBeInTheDocument()
    await userEvent.click(within(box).getByRole('button', { name: 'Bezárom' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test.each([
    ['Protokoll', '/fuel/stack/protocol'],
    ['Új elem', '/fuel/stack/manage/add'],
    ['Gyógyszer', '/fuel/gyogyszer'],
  ])('a %s ajtó a saját route-jára visz', async (label, path) => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    expect(screen.getByTestId('location')).toHaveTextContent(path)
  })
})

describe('FuelStackPage — real honest states', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  // Üres stack: hívás cselekvésre, nem üres képernyő.
  test('üres stacknél a felvétel a következő lépés', async () => {
    renderView()
    expect(await screen.findByText('A protokollod még üres')).toBeInTheDocument()
    expect(screen.queryByText('MIT VESZEK BE MA?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Új elem/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage/add')
  })

  test('egy bevett occurrence all-done műszert mutat', async () => {
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
    expect(await screen.findByText(/Mára minden megvan/)).toBeInTheDocument()
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
    const tick = await screen.findByRole('button', { name: /Kreatin: bevettem/ })
    await userEvent.click(tick)
    await waitFor(() => expect(screen.queryByText('Kreatin bevéve')).not.toBeInTheDocument())
  })
})
