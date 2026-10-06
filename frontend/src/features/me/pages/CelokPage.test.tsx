import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelokPage } from '@/features/me/pages/CelokPage'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderHub() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals']}>
    <Routes><Route path="/me/goals" element={<CelokPage />} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /><Route path="/me/goals/new" element={<div>WIZARD</div>} /><Route path="/me/goals/signals" element={<div>SIGNALS PAGE</div>} /><Route path="/me/goals/weight" element={<div>SULYCEL</div>} /><Route path="/me/goals/weight/new" element={<div>WEIGHT WIZARD</div>} /></Routes>
  </MemoryRouter></QueryWrapper>)
}

test('renders the three active goals as tiles, Spanyol B2 parked, three live dimension chips', () => {
  renderHub()
  expect(screen.getByRole('button', { name: 'Kockahas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Side hustle' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Az utolsó barátnő' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Spanyol B2 · parkol/ })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '3 életcél' })).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-dimchip:not(.empty)')).toHaveLength(3)
})

test('is a tab page: no back chip', () => {
  renderHub()
  expect(screen.queryByRole('button', { name: 'Vissza' })).not.toBeInTheDocument()
})

test('hub shows arrow counters and live tile dots', async () => {
  renderHub()
  await screen.findByText('Célok')
  expect(screen.queryByText(/Az irány-nyíl a 2\. szelettel jön/)).toBeNull()
  // Üveg (mezo-me75u.6): the goal tile is a glass tile (`.enc-tile`); its seven dots stay `.lg-wk7`.
  expect(document.querySelectorAll('.enc-tile.glass .lg-wk7 i.h').length).toBeGreaterThan(0)
})

test('tile tap opens the goal page; ＋ Új cél opens the wizard', () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Kockahas' }))
  expect(screen.getByText('GOAL PAGE')).toBeInTheDocument()
})

test('a Jelek sor az élő/alvó forrásarányt mondja és a jel-oldalra visz', async () => {
  renderHub()
  const row = await screen.findByRole('button', { name: /Jelek/ })
  expect(row).toHaveTextContent('32 forrás · 10 él · 22 alszik')
  fireEvent.click(row)
  expect(screen.getByText('SIGNALS PAGE')).toBeInTheDocument()
})

test('the parked row exposes two distinct focusable buttons — navigate and Vissza', () => {
  renderHub()
  const navBtn = screen.getByRole('button', { name: 'Spanyol B2 · parkol' })
  const visszaBtn = screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' })
  expect(navBtn).not.toBe(visszaBtn)
  expect(navBtn.tagName).toBe('BUTTON')
  expect(visszaBtn.tagName).toBe('BUTTON')
  // neither button is nested inside the other — both are real, independently focusable controls
  expect(navBtn.contains(visszaBtn)).toBe(false)
  expect(visszaBtn.contains(navBtn)).toBe(false)
})

test('Vissza on a parked goal re-activates it without navigating', async () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' }))
  await waitFor(() => expect(screen.getByRole('img', { name: '4 életcél' })).toBeInTheDocument())
  expect(screen.queryByText('GOAL PAGE')).not.toBeInTheDocument()
})

// ── Real mode: the loading / empty / error triad (mezo-iizd.1 final review, items 3 + 4) ─────
describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders a skeleton — never "0 aktív · 0 parkol" — while the list is unresolved', () => {
    server.use(http.get(`${API_BASE}/api/life-goals`, () => new Promise(() => {})))
    renderHub()
    expect(screen.queryByText(/0 aktív/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /életcél/ })).not.toBeInTheDocument()
  })

  /**
   * mezo-iizd.5 final review, finding 2: `useLifeGoalToday` resolves independently of the goal
   * list — the list can be ready while `/api/life-goals/today` is still loading or failing. Before
   * this fix the hero sentence read the unresolved `{goals:[]}` fallback as "zero of everything
   * this week" and printed a fabricated "0↗ · 0→ · 0↘" instead of the honest neutral sentence.
   */
  test('today counters stay honest — neutral sentence, not a fabricated 0↗·0→·0↘ — while /today is loading', () => {
    server.use(http.get(`${API_BASE}/api/life-goals/today`, () => new Promise(() => {})))
    renderHub()
    expect(screen.queryByText(/0↗ · 0→ · 0↘/)).not.toBeInTheDocument()
  })

  /**
   * A loading `/today` says LOADING — and only that. (The error case below must not borrow this
   * sentence: conflating a failure with a load is the house error rule's own prohibition.)
   */
  test('a still-loading /today says „töltődik", not a failure', async () => {
    server.use(http.get(`${API_BASE}/api/life-goals/today`, () => new Promise(() => {})))
    renderHub()
    await screen.findByText('Célok')
    expect(await screen.findByText(/A heti irány most töltődik/)).toBeInTheDocument()
    expect(screen.queryByText(/nem sikerült lekérni/)).not.toBeInTheDocument()
  })

  test('today counters stay honest when /today fails — its OWN sentence, never „töltődik"', async () => {
    server.use(http.get(`${API_BASE}/api/life-goals/today`, () => new HttpResponse(null, { status: 500 })))
    renderHub()
    await screen.findByText('Célok')
    expect(screen.queryByText(/0↗ · 0→ · 0↘/)).not.toBeInTheDocument()
    expect(await screen.findByText(/A heti irányt most nem sikerült lekérni/)).toBeInTheDocument()
    expect(screen.queryByText(/A heti irány most töltődik/)).not.toBeInTheDocument()
  })

  /**
   * mezo-iizd.4 final review, finding 4: a FAILED /api/goals read reduces to the same empty shape
   * as "no weight goal yet" — the error keeps its own quiet line, and no tile (not even the
   * „＋ Súlycél" door) is offered for a goal that may well exist.
   */
  test('an elhasalt /api/goals olvasás csendes sort kap — nem „nincs súlycél", nem csempe', async () => {
    server.use(http.get(`${API_BASE}/api/goals`, () => new HttpResponse(null, { status: 500 })))
    renderHub()
    expect(await screen.findByText('a súlycél most nem elérhető')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Súlycél' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Új súlycél' })).toBeNull()
    expect(screen.getByText('3 aktív · 1 parkol')).toBeInTheDocument()
  })

  test('üres cél-lista → szaggatott „＋ Súlycél" csempe az első helyen', async () => {
    server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
    renderHub()
    const door = await screen.findByRole('button', { name: 'Új súlycél' })
    expect(door).toHaveTextContent('＋ Súlycél')
    expect(door).toHaveTextContent('Tervezd meg a tempót')
    expect(document.querySelector('.mz-mosaic')!.firstElementChild).toBe(door)
    expect(screen.queryByText('a súlycél most nem elérhető')).toBeNull()
    expect(screen.getByText('3 aktív · 1 parkol')).toBeInTheDocument()
    fireEvent.click(door)
    expect(screen.getByText('WEIGHT WIZARD')).toBeInTheDocument()
  })

  test('töltő /api/goals → üres, szöveg nélküli váz-csempe az első helyen', async () => {
    server.use(http.get(`${API_BASE}/api/goals`, () => new Promise(() => {})))
    renderHub()
    await screen.findByText('Célok')
    const first = document.querySelector('.mz-mosaic')!.firstElementChild!
    expect(first).toHaveClass('enc-wgoal-skel')
    expect(first).toBeEmptyDOMElement()
    expect(screen.getByText('3 aktív · 1 parkol')).toBeInTheDocument()
    expect(screen.queryByText('a súlycél most nem elérhető')).toBeNull()
  })

  test('a failed list read renders a terminal error + retry, not the empty state', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/life-goals`, () => { calls += 1; return new HttpResponse(null, { status: 500 }) }))
    renderHub()
    expect(await screen.findByText('Nem sikerült betölteni a célokat.')).toBeInTheDocument()
    expect(screen.queryByText(/Még nincs aktív célod/)).not.toBeInTheDocument()
    const before = calls
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })
})

test('a lezárt cél a saját szekciójában jelenik meg, nem a mozaikban (mezo-iizd.4)', async () => {
  renderHub()
  await screen.findByText('Célok')
  expect(screen.getByText('Lezárt célok')).toBeInTheDocument()
  const doneRow = screen.getByRole('button', { name: /Félmaraton · kész/ })
  expect(doneRow).toBeInTheDocument()
  // the done mark is the 3D t-tick now, its meaning an accessible name instead of a `✓` glyph
  expect(within(doneRow).getByLabelText('kész')).toBeInTheDocument()
  expect(doneRow).not.toHaveTextContent('✓')
  // nem szivárog a mozaikba
  expect(screen.queryByRole('button', { name: 'Félmaraton' })).toBeNull()
})

test('a súlycél csempéje a Célok hubról nyílik (mezo-iizd.4)', async () => {
  renderHub()
  fireEvent.click(await screen.findByRole('button', { name: /Súlycél/ }))
  expect(screen.getByText('SULYCEL')).toBeInTheDocument()
})

test('a súlycél az ELSŐ csempe, a fejléc beleszámolja, a Súlycél sor nincs többé a Jelek alatt', async () => {
  renderHub()
  const tile = await screen.findByRole('button', { name: 'Súlycél' })
  expect(document.querySelector('.mz-mosaic')!.firstElementChild).toBe(tile)
  expect(tile).toHaveClass('enc-wgoal')
  expect(screen.getByText('4 aktív · 1 parkol')).toBeInTheDocument()
  expect(document.querySelectorAll('.enc-xrow')).toHaveLength(1)
  expect(screen.getByRole('img', { name: '3 életcél' })).toHaveTextContent('életcél')
  const wide = screen.getByRole('button', { name: 'Új cél' })
  expect(wide).toHaveClass('is-wide')
})
