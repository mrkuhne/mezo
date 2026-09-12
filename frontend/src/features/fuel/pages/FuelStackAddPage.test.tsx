// ============================================================
// Mezo · FuelStackAddPage tesztek (Fuel Titanium S2, mezo-g2vl — manifeszt D3).
//
// Owner: az új elem felvétele ÖNÁLLÓ OLDAL — nem felugró, ami drawerbe vált. Ezt a teszt
// lépésenként ellenőrzi: egyetlen lépésnél sem nyílhat modális réteg.
//
// Őszinte-null: ismeretlen hatóanyagnál nem adunk adagot, ismeretlen termékerősségnél nincs
// darabszám — és minden adag-felületen ott áll, hogy ez nem orvosi tanács.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackAddPage } from '@/features/fuel/pages/FuelStackAddPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

function LocationProbe() { return <div data-testid="location">{useLocation().pathname}</div> }

function renderAdd() {
  return render(
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={['/fuel/stack/manage/add']}>
      <LocationProbe />
      <Routes>
        <Route path="/fuel/stack/manage/add" element={<FuelStackAddPage />} />
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter></ToastProvider></QueryWrapper>,
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('FuelStackAddPage — a beállító egyetlen oldalon', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  // Owner: az új elem felvétele ÖNÁLLÓ OLDAL — nem felugró, ami drawerbe vált.
  test('a felvétel egyetlen oldalon fut végig, nem nyit modális réteget', async () => {
    renderAdd()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Beírom kézzel/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Termék neve/), 'D3-vitamin')
    await userEvent.type(screen.getByLabelText(/Egy egységben/), '2000')
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText('Javaslat').length).toBeGreaterThan(0)
  })

  // A termék linkről is megadható, mint a kamra beolvasásnál.
  test('a termék linkről is megadható ugyanazzal a beolvasó képességgel', async () => {
    let scrapeCalls = 0
    server.use(http.post(`${API_BASE}/api/pantry-import/scrape`, () => {
      scrapeCalls += 1
      return HttpResponse.json({ result: null })
    }))
    renderAdd()
    await userEvent.click(screen.getByRole('button', { name: /Termék linkje/ }))
    await userEvent.type(screen.getByLabelText(/Termék linkje/), 'https://example.test/d3')
    await userEvent.click(screen.getByRole('button', { name: /Beolvasom/ }))
    // Mock mód a konzervet adja vissza lekérés nélkül — a lényeg, hogy a beolvasó ág él és a
    // lap NEM vált modális rétegre.
    expect(scrapeCalls).toBe(0)
    expect(await screen.findByLabelText(/Termék neve/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('a javaslat megmutatja a napi mennyiséget, a darabszámot és az indokot', async () => {
    renderAdd()
    await userEvent.click(screen.getByRole('button', { name: /Beírom kézzel/ }))
    await userEvent.type(screen.getByLabelText(/Termék neve/), 'D3-vitamin')
    await userEvent.type(screen.getByLabelText(/Egy egységben/), '1000')
    await userEvent.type(screen.getByLabelText(/Mértékegység/), 'NE')
    await userEvent.type(screen.getByLabelText(/Dobozban/), '120')
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.getByText(/4 kapszula/)).toBeInTheDocument()
    expect(screen.getAllByText(/4000 NE/).length).toBeGreaterThan(0)
    expect(screen.getByText(/zsíros étkezéssel/i)).toBeInTheDocument()
    expect(screen.getByText(/~30 napra elég/)).toBeInTheDocument()
  })

  // Határvonal: ez tájékoztatás, nem orvosi tanács — minden adag-felületen ott áll.
  test('az adag-felület kimondja, hogy nem orvosi tanács', async () => {
    renderAdd()
    expect(screen.getByText(/nem orvosi tanács/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Beírom kézzel/ }))
    await userEvent.type(screen.getByLabelText(/Termék neve/), 'Cink')
    await userEvent.type(screen.getByLabelText(/Egy egységben/), '15')
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.getByText(/nem orvosi tanács/i)).toBeInTheDocument()
    // A referencia figyelmeztetése eljut a felületig.
    expect(screen.getByText(/éhgyomorra/i)).toBeInTheDocument()
  })

  // Őszinte-null: ismeretlen hatóanyagra nem találunk ki adagot.
  test('ismeretlen terméknél nem ad adagot, hanem megmondja, mit nem tud', async () => {
    renderAdd()
    await userEvent.click(screen.getByRole('button', { name: /Beírom kézzel/ }))
    await userEvent.type(screen.getByLabelText(/Termék neve/), 'Valami ismeretlen por')
    await userEvent.type(screen.getByLabelText(/Egy egységben/), '500')
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.getByText(/nem találok ki hozzá adagot/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Adag \(ahogy szeded\)/)).toBeInTheDocument()
  })

  // Őszinte-null: ismert hatóanyag, ismeretlen termékerősség — nincs darabszám.
  test('ismeretlen termékerősségnél nincs darabszám, csak a napi sáv', async () => {
    renderAdd()
    await userEvent.click(screen.getByRole('button', { name: /Beírom kézzel/ }))
    await userEvent.type(screen.getByLabelText(/Termék neve/), 'D3-vitamin')
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.getByText(/2000–4000/)).toBeInTheDocument()
    expect(screen.getByText(/darabszámot\s+nem mondok/i)).toBeInTheDocument()
    expect(screen.queryByText(/napra elég/)).toBeNull()
  })

  // A Kamrából indított ág végigfut: a mentés a meglévő add-protocol-item úton megy.
  test('a Kamrából választott termék felvehető a protokollba', async () => {
    renderAdd()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Keresés a Kamrában' }), 'cink')
    await userEvent.click(screen.getByRole('button', { name: /Cink-biszglicinát/ }))
    await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    await userEvent.click(screen.getByRole('button', { name: /Felveszem a protokollba/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Cink-biszglicinát hozzáadva')
  })

  test('a "null" keresőszó nem illeszkedik egy null márkájú tételre (mezo-xaq5)', async () => {
    // Regressziós őrszem: egy `${item.brand}` sablon a null márkát a „null" szóra fordítja, és
    // egy ilyen tétel hamisan illeszkedne a „null" keresőszóra. Ezt csak futásidejű állítás fogja.
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [{
        id: 'null-brand', name: 'Magnézium-glicinát', brand: null, type: 'supplement', category: 'sleep',
        dose: '300mg', form: 'kapszula', stock: 10, stockUnit: 'db', protocol: '', timing: 'evening', taken: false,
        macros: { kcal: null, p: null, c: null, f: null },
      }] })),
    )
    renderAdd()
    const search = await screen.findByRole('searchbox', { name: 'Keresés a Kamrában' })
    expect(await screen.findByRole('button', { name: /Magnézium-glicinát/ })).toBeInTheDocument()
    await userEvent.type(search, 'null')
    expect(screen.queryByRole('button', { name: /Magnézium-glicinát/ })).not.toBeInTheDocument()
  })
})

test('rejected add nem mutat success-toastot', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [{
      id: 'k', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle', dose: '5g',
      form: 'por', stock: 10, stockUnit: 'adag', protocol: '', timing: 'morning', taken: false,
      macros: { kcal: null, p: null, c: null, f: null },
    }] })),
    http.post(`${API_BASE}/api/fuel/protocol/items`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
  )
  renderAdd()
  await userEvent.click(await screen.findByRole('button', { name: /Kreatin/ }))
  await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
  await userEvent.click(screen.getByRole('button', { name: /Felveszem a protokollba/ }))
  expect(screen.queryByText('Kreatin hozzáadva')).not.toBeInTheDocument()
})
