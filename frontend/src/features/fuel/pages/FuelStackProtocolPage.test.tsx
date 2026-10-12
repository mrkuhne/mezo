// ============================================================
// Mezo · FuelStackProtocolPage tesztek (Fuel Titanium S2, mezo-g2vl — manifeszt D2 · D3 · D4 · D7).
//
// A Protokoll SAJÁT oldal, mert a kombinált görgetés átláthatatlan volt (owner). Tételenként
// mutatja a miértet és az elhelyezést; a szerkesztés (D3) és az étkezési kötések (D4) ennek a
// lapnak a szekciói. D7: a verziótörténet adat marad, felület nélkül.
//
// Folyadék F5 (mezo-n4wf5.5): a hős idősávonként egy fiola + három tény + ítélet; minden idősáv egy
// kártya a fejében a zónával és az idővel, soraiban az adag, a „kézi / automatikus" és a tárolt indok.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackProtocolPage } from '@/features/fuel/pages/FuelStackProtocolPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

function LocationProbe() { return <div data-testid="location">{useLocation().pathname}</div> }

function renderProtocol() {
  return render(
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/fuel/stack/protocol']}>
      <Routes>
        <Route path="/fuel/stack/protocol" element={<FuelStackProtocolPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter></ToastProvider></QueryWrapper>,
  )
}

/** Egy tételes real-mode protokoll — a `reason` és a `history` per-teszt állítható. */
function serveProtocol(opts: { reason?: string | null; history?: unknown[] } = {}) {
  const reason = opts.reason === undefined
    ? 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.'
    : opts.reason
  server.use(
    http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({
      ingredients: [],
      stash: [{
        id: 'd3k2', name: 'D3 + K2', brand: null, type: 'supplement', category: 'vitamin',
        dose: '4000 IU', form: 'kapszula', stock: 90, stockUnit: 'db', protocol: '',
        timing: 'lunch', taken: false, macros: { kcal: null, p: null, c: null, f: null },
      }],
    })),
    http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({
      active: {
        id: 'proto-1', version: 3, builtAt: '2026-09-04T06:00:00Z', status: 'active',
        confidence: 0.86,
        items: [{
          id: 'occ-1', pantryItemId: 'd3k2', slotKey: 'lunch', pinned: false,
          placementSource: 'rule', placementReason: reason, dose: '4000 IU',
        }],
      },
      history: opts.history ?? [],
    })),
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('FuelStackProtocolPage', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  // D2 (mezo-g2vl): a Protokoll SAJÁT oldal, mert a kombinált görgetés átláthatatlan volt (owner).
  test('a protokoll tételenként mutatja a miértet és az elhelyezést', async () => {
    serveProtocol()
    renderProtocol()
    const row = await screen.findByRole('listitem', { name: /D3 \+ K2/ })
    // the slot is the card's head; the row says the dose, who placed it and the stored reason
    expect(screen.getByRole('heading', { level: 3, name: /^Ebéd · \d\d:\d\d · 1$/ })).toBeInTheDocument()
    expect(within(row).getByText(/4000 IU · automatikus/)).toBeInTheDocument()
    expect(within(row).getByText(/zsíros étkezéssel/i)).toBeInTheDocument()
    expect(screen.getByText('Minden elemet én időzítettem.')).toBeInTheDocument()
    expect(screen.getByText(/3\. változat · 86%-os megbízhatóság\./)).toBeInTheDocument()
  })

  // D2: az elhelyezés INDOKA a motorból jön — nem a felület találja ki.
  test('az elhelyezés indoka a protokollból jön, nem a felületről', async () => {
    serveProtocol({ reason: null })
    renderProtocol()
    const row = await screen.findByRole('listitem', { name: /D3 \+ K2/ })
    expect(within(row).queryByText(/zsíros étkezéssel/i)).toBeNull()
    expect(within(row).queryByText(/automatikusan időzítve/i)).toBeNull()
  })

  // D7: a verziótörténet adat marad, felület nélkül.
  test('a verziótörténet nem jelenik meg', async () => {
    serveProtocol({ history: [{ version: 2, builtAt: '2026-09-01T06:00:00Z', reason: 'teszt' }] })
    renderProtocol()
    await screen.findByRole('listitem', { name: /D3 \+ K2/ })
    expect(screen.queryByText(/verzió|előzmény/i)).toBeNull()
  })

  // D3: a szerkesztés IDE olvad be — a sor a meglévő tétel-sheetet nyitja.
  test('egy sor koppintása a szerkesztő sheetet nyitja', async () => {
    serveProtocol()
    renderProtocol()
    await userEvent.click(await screen.findByRole('button', { name: 'D3 + K2 beállítások' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Dózis')).toBeInTheDocument()
    expect(within(dialog).getByText('Áthelyezés másik idősávba')).toBeInTheDocument()
  })

  test('a betöltési hiba őszinte, nem üres lista', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.error()))
    renderProtocol()
    expect(await screen.findByText('A protokoll most nem tölthető be.')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).toBeNull()
    // the live error face has no retry
    expect(screen.queryByRole('button', { name: /Újra/ })).toBeNull()
  })

  test('az Új elem ajtó a beállító oldalra visz', async () => {
    serveProtocol()
    renderProtocol()
    // loaded: the door is the hero's button (while loading it is a row of its own)
    await screen.findByRole('listitem', { name: /D3 \+ K2/ })
    await userEvent.click(screen.getByRole('button', { name: 'Új elem beállítása' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage/add')
  })
})

describe('FuelStackProtocolPage — mock', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  // D4: az étkezési kötések ennek a lapnak az al-szekciója, nem külön oldal.
  test('az étkezési kötések al-szekcióként jelennek meg', () => {
    renderProtocol()
    const section = screen.getByRole('region', { name: 'Étkezési kötések' })
    expect(screen.getByRole('heading', { level: 2, name: /Étkezéshez · \d/ })).toBeInTheDocument()
    expect(within(section).getByText('Étkezés-egyeztetés · makró és mikro')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: /Csirke \+ édesburgonya \+ spenót/ }))
      .toHaveAttribute('href', expect.stringMatching(/^\/fuel\/recipes\//))
  })

  test('a teljes protokoll minden zónáját és eredetét mutatja', () => {
    const { container } = renderProtocol()
    expect(screen.getByText(/^A napi rended · \d idősáv$/)).toBeInTheDocument()
    // the three facts of the hero: items · time slots · placed by hand
    const facts = container.querySelector('.fo-facts')!
    expect(facts).toHaveTextContent(/^8elem\didősáv\dkézzel elhelyezve$/)
    expect(screen.getByText(/3\. változat · 86%-os megbízhatóság\./)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Kreatin monohidrát/ })).toBeInTheDocument()
    expect(screen.getAllByText(/· automatikus/).length).toBeGreaterThan(0)
    // one vial per time slot in the hero; every slot is a white card with its head — no glass
    expect(container.querySelectorAll('.fk-zv .fo-vial').length).toBe(screen.getAllByRole('heading', { level: 3 }).length)
    expect(container.querySelector('.glass, .mz-page')).toBeNull()
    expect(screen.queryByRole('button', { name: /bevétel jelölése/ })).not.toBeInTheDocument()
  })

  test('visszalép a Stack hubra', async () => {
    renderProtocol()
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack')
  })
})
