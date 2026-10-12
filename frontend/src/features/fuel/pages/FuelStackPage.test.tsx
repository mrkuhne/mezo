// ============================================================
// Mezo · FuelStackPage tesztek (Fuel Titanium S2, mezo-g2vl — manifeszt D1).
//
// A hub főnézete a MAI lista, idősávokra bontva, egyérintéses pipálással (owner). A korábbi
// négy-csempés hub + `/fuel/stack/today` páros ÖSSZEVONT: a mai lista itt él.
//
// Folyadék F5 (mezo-n4wf5.5): a hős a nap adagjai kapszulákban + „Következik: …" a Bevettem gombbal;
// minden napszak egy számozott szekció a saját kártyájával; a három ajtó egy kártya sorai.
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
    expect(container.querySelector('.fo-page.fk-page')).toBeInTheDocument()
    // the old skin is gone: no Mozaik page, no glass, no page head of its own
    expect(container.querySelector('.mz-page, .glass, .mz-page-head, .mz-page-hero')).toBeNull()
    // one numbered section per part of the day, then „Protokoll és beállítás"
    const sections = screen.getAllByRole('heading', { level: 2 })
    expect(sections.length).toBeGreaterThan(2)
    expect(sections[0]).toHaveTextContent(/^1Reggel · \d \/ \d/)
    expect(sections[sections.length - 1]).toHaveTextContent('Protokoll és beállítás')
    expect(screen.getByText(/^Mit veszek be ma\? · \d \/ 8 bevéve$/)).toBeInTheDocument()
    // the hero's verdict is the next dose, with the one-tap button on the liquid
    expect(screen.getByText(/^Következik: .+\.$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bevettem' })).toBeInTheDocument()
    expect(container.querySelector('[data-kalauz-anchor="stack-hero"]')).toHaveClass('fo-hero')
    // the icons are the Folyadék-jel sprite
    expect(container.querySelector('use[href="#t-protocol"]')).toBeInTheDocument()
    expect(container.querySelector('use[href="#i-kiegeszito"]')).toBeNull()
  })

  // The day's doses are capsules (no ring): one per dose, named for screen readers.
  test('a nap adagjai kapszulákban állnak, a készültség fel van olvasva', () => {
    renderView()
    const caps = screen.getByRole('img', { name: /^A mai adagok napszakonként: \d \/ 8 bevéve$/ })
    expect(caps.querySelectorAll('i')).toHaveLength(8)
    expect(caps.querySelectorAll('i.nx')).toHaveLength(1)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  test('egy érintés bevettre állítja a tételt, és a bevétel visszavonható', async () => {
    renderView()
    const tick = screen.getAllByRole('button', { name: /Origin PWO: bevettem/ })[0]
    await userEvent.click(tick)
    expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO bevéve')
    // the taken mark is the kit's round tick; the state is aria-pressed
    const taken = screen.getAllByRole('button', { name: /Origin PWO: visszavonom/ })[0]
    expect(taken).toHaveClass('fo-tk', 'on')
    expect(taken).toHaveAttribute('aria-pressed', 'true')
    expect(taken.textContent).not.toMatch(/✓/)
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonás' }))
    await waitFor(() => expect(
      screen.getAllByRole('button', { name: /Origin PWO: bevettem/ })[0],
    ).toHaveAttribute('aria-pressed', 'false'))
  })

  // A most esedékes sáv kiemelten áll, de a többi nem tűnik el.
  test('a most esedékes sáv kiemelt', () => {
    const { container } = renderView()
    expect(screen.getAllByText('most esedékes')).toHaveLength(1)
    expect(container.querySelectorAll('.fo-sec.fk-bandsec').length).toBeGreaterThan(1)
  })

  // Egy tétel koppintása a részletező dobozt nyitja (világos lap).
  test('a tétel koppintása a részletező dobozt nyitja', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /D3 \+ K2 részletei/ }))
    const box = screen.getByRole('dialog')
    expect(box.className).toContain('fo-sheet')
    expect(box.className).not.toContain('glass')
    expect(within(box).getByRole('heading', { name: 'D3 + K2' })).toBeInTheDocument()
    expect(within(box).getByText(/Miért/i)).toBeInTheDocument()
    expect(within(box).getByText(/nem orvosi tanács/i)).toBeInTheDocument()
    await userEvent.click(within(box).getByRole('button', { name: 'Bezárom' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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
    expect(await screen.findByText('A protokollod még üres.')).toBeInTheDocument()
    expect(document.querySelector('[data-kalauz-anchor="stack-hero"]')).toHaveClass('fo-hero')
    expect(screen.queryByRole('button', { name: 'Bevettem' })).not.toBeInTheDocument()
    // the hero's own button is the next step
    await userEvent.click(screen.getAllByRole('button', { name: /Új elem/ })[0])
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
    await screen.findByText('A protokollod még üres.')
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
