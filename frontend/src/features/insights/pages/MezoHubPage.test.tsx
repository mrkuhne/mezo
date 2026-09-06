import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MezoHubPage } from '@/features/insights/pages/MezoHubPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { MOCK_OVERVIEW, MOCK_OVERVIEW_EMPTY } from '@/data/character/characterMock'
import type { CharacterOverviewResponse } from '@/data/character/characterApi'

const characterStore = vi.hoisted(() => ({
  overview: null as unknown as CharacterOverviewResponse | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterOverview: () => ({ overview: characterStore.overview, isLoading: false }),
  }
})

// Mezo hub — the /mezo index Mozaik face (mezo-d20.5.1), built against
// docs/design_2.0/prototypes/src/mezo-body.html's hub section: breathing orb hero
// (companion sentence + quiet status line), composer-shaped chat opener, the motor's
// single decision card in a gold ring (the SAME decide mutation PatternsPage uses),
// the 6-tile mosaic with live bottom lines, and the L0→L3 memory band.

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderHub = () =>
  render(
    <MemoryRouter initialEntries={['/mezo']}>
      <Routes>
        <Route path="/mezo" element={<MezoHubPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MezoHubPage (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    characterStore.overview = MOCK_OVERVIEW_EMPTY
  })
  afterEach(() => vi.unstubAllEnvs())

  // tile-header-layout: the hero is the breathing spot ALONE — no name, no companion
  // sentence, no status line; the composer opener sits directly under the icon.
  test('orb hero: the spot alone, no name / sentence / status line', () => {
    const { container } = renderHub()
    const hero = container.querySelector('.mzh-orbhero') as HTMLElement
    expect(hero.querySelector('svg')).toBeTruthy()
    expect(hero.textContent).toBe('')
    expect(screen.queryByText('Mezo')).not.toBeInTheDocument()
    expect(screen.queryByText(/Jó reggelt — Week 3, Day 4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/demo beszélgetés/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gemini · élő/)).not.toBeInTheDocument()
    // the composer is the hero's immediate sibling
    expect(hero.nextElementSibling).toHaveClass('mzh-chatopen')
  })

  test('the chat opener is composer-shaped and navigates to /mezo/chat', async () => {
    renderHub()
    const opener = screen.getByRole('button', { name: 'Beszélgetés a társsal' })
    expect(opener).toHaveTextContent('Mondj valamit…')
    await userEvent.click(opener)
    expect(screen.getByTestId('location')).toHaveTextContent('/mezo/chat')
  })

  test('the decision card carries the strongest decide-bucket question with human words only', () => {
    renderHub()
    expect(screen.getByText(/Döntésre vár · 2/)).toBeInTheDocument()
    // p2 has the strongest |r| — its live pair question leads; raw statistics never appear.
    expect(screen.getByText('Rosszabbul alszol, ha későn eszel?')).toBeInTheDocument()
    expect(screen.getByText('megbízható jel')).toBeInTheDocument()
    expect(screen.getByText(/Amit eddig látunk/)).toBeInTheDocument()
    expect(screen.queryByText(/r=/)).not.toBeInTheDocument()
    // single card: the weaker decide entry's title is NOT on the hub
    expect(screen.queryByText('Caffeine 14:00 utáni dózis → sleep onset +24 perc')).not.toBeInTheDocument()
  })

  test('deciding flips the card into the sage acknowledgement (same mutation as Minták)', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Megerősítem' }))
    expect(await screen.findByText('✓ Beépítettem a tudásba — mostantól számolok vele.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
    // the mock cache moved the pattern too — the Minták tile line reflects the new confirmed count
    await waitFor(() => expect(screen.getByText('2 él a tudásban · 1 döntés')).toBeInTheDocument())
  })

  test('the 6-tile mosaic carries live bottom lines from the pages’ own hooks', () => {
    renderHub()
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByText('1 él a tudásban · 2 döntés')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heti' })).toBeInTheDocument()
    expect(screen.getByText('78 pont · +4 ↗')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Memoár' })).toBeInTheDocument()
    expect(screen.getByText('Hét 20 · új fejezet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tudástár' })).toBeInTheDocument()
    expect(screen.getByText('15 tény · 10 a chatben')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Előrejelzések' })).toBeInTheDocument()
    expect(screen.getByText('2 aktív · 100% bevált')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kísérletek' })).toBeInTheDocument()
    expect(screen.getByText('1 aktív · 4/7 nap')).toBeInTheDocument()
  })

  test('tiles navigate to the full-page siblings (Heti crosses to /me/week)', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Minták' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/mezo/patterns')
  })

  test('Heti tile navigates to /me/week', async () => {
    renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Heti' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/me/week')
  })

  test('the Memória tile shows the real L0→L3 counts and opens /mezo/memoria', async () => {
    renderHub()
    const band = screen.getByRole('button', { name: 'Memória-rétegek' })
    expect(band).toHaveTextContent('47')
    expect(band).toHaveTextContent('nyers nap')
    expect(band).toHaveTextContent('38')
    expect(band).toHaveTextContent('napló')
    expect(band).toHaveTextContent('6')
    expect(band).toHaveTextContent('ítélet')
    expect(band).toHaveTextContent('15')
    expect(band).toHaveTextContent('tény')
    await userEvent.click(band)
    expect(screen.getByTestId('location')).toHaveTextContent('/mezo/memoria')
  })

  test('a Karakter csempe a Mezo hubon él és a dossziéra navigál (hub-tile-reorg)', async () => {
    renderHub()
    const karakter = screen.getByRole('button', { name: 'Karakter' })
    expect(karakter.classList.contains('mzh-t-karakter')).toBe(true)
    // tile-header-layout: normál, 2-per-sor cella — nincs többé teljes soros csempe
    expect(karakter.classList.contains('mz-tile-wide')).toBe(false)
    await userEvent.click(karakter)
    expect(screen.getByTestId('location')).toHaveTextContent('/me/karakter')
  })

  test('a Karakter csempe az élő átlag CORE érettséget mutatja (post-bootstrap)', () => {
    characterStore.overview = MOCK_OVERVIEW
    renderHub()
    // MOCK_OVERVIEW's 7 CORE dims: (58+71+45+66+39+74+33)/7 = 55.14 -> 55
    expect(screen.getByRole('button', { name: 'Karakter' })).toHaveTextContent('55% átlag érettség')
  })

  test('a Karakter csempe nem hord kitalált sort — kikapcsolt forrás (overview null)', () => {
    characterStore.overview = null
    renderHub()
    expect(screen.getByRole('button', { name: 'Karakter' }).querySelector('.mz-tile-line')).toBeNull()
  })

  test('a Karakter csempe nem hord sort érintetlen (pre-bootstrap) dossziénál — az isDossierEmpty predikátum', () => {
    renderHub() // beforeEach: MOCK_OVERVIEW_EMPTY
    expect(screen.getByRole('button', { name: 'Karakter' }).querySelector('.mz-tile-line')).toBeNull()
  })
})

describe('MezoHubPage (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // useCharacterOverview stays mocked (module-level vi.mock above) in real mode too —
    // real-mode Karakter tile coverage rests on the hook's own tests, not this suite.
    characterStore.overview = MOCK_OVERVIEW_EMPTY
  })
  afterEach(() => vi.unstubAllEnvs())

  test('renders the hub from MSW fixtures — live status line, tiles, no fabricated zeros while loading', async () => {
    renderHub()
    // the shell is honest immediately: chat opener + the tiles
    expect(screen.getByRole('button', { name: 'Beszélgetés a társsal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Karakter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Memória-rétegek' })).toBeInTheDocument()
    // live fixtures resolve → the Memória tile's real counts (the hero carries no status line)
    expect(await screen.findByText('nyers nap')).toBeInTheDocument()
  })
})

// mezo-hq44: az emoji→ikon egységesítés folytatása (mezo-z4h4 nyelvén) — a hubon a
// 🔔 / 📈 / ➤ / ✦ glifák helyén az Icon rajzolt stroke-ikonjai állnak, a látható
// szöveg és a gombok akadálymentes nevei változatlanok.
describe('MezoHubPage — emoji→ikon (mezo-hq44)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    characterStore.overview = MOCK_OVERVIEW_EMPTY
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    characterStore.overview = MOCK_OVERVIEW_EMPTY
  })

  test('a döntés-kártya szemöldöke harang-ikont kap, a megfigyelés-sor trend-ikont', () => {
    const { container } = renderHub()
    const eyebrow = screen.getByText(/Döntésre vár · 2/)
    expect(eyebrow.querySelector('svg')).toBeTruthy()
    expect(eyebrow.textContent).not.toMatch(/🔔/)
    const obs = container.querySelector('.mzh-decobs') as HTMLElement
    expect(obs.querySelector('svg')).toBeTruthy()
    expect(obs.textContent).toMatch(/Amit eddig látunk:/)
    expect(obs.textContent).not.toMatch(/📈/)
  })

  test('a composer küldés-buborékja és a Diagnózis csempe ikonos', () => {
    const { container } = renderHub()
    const send = container.querySelector('.mzh-snd') as HTMLElement
    expect(send.querySelector('svg')).toBeTruthy()
    expect(send.textContent).not.toMatch(/➤/)
    const diag = container.querySelector('.mzh-t-diag') as HTMLElement
    expect(diag.textContent).not.toMatch(/✦/)
    expect(diag.textContent).toMatch(/Miért vagyok fáradt\?/)
  })

  test('a „Figyeljük" nyugtázása szem-ikont kap, az „Elvetem" x-ikont — a mondat marad', async () => {
    const { container } = renderHub()
    await userEvent.click(screen.getByRole('button', { name: 'Figyeljük' }))
    const done = await waitFor(() => {
      const el = container.querySelector('.mzh-decdone') as HTMLElement
      expect(el).not.toBeNull()
      return el
    })
    expect(done.querySelector('svg')).toBeTruthy()
    expect(done.textContent).not.toMatch(/👁/)
    expect(done.textContent).toMatch(/Rendben, figyeljük tovább — szólok, ha erősödik\./)
  })
})

describe('MezoHubPage — the Proaktív coaching tile (mezo-6269.3)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('carries the day’s flagged count, the winner and the split arc', async () => {
    renderHub()
    const tile = await screen.findByRole('button', { name: 'Proaktív coaching' })
    expect(tile).toHaveTextContent('Terhelés–táplálás')
    expect(tile.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })
})

describe('MezoHubPage — the coaching tile is honest while unresolved', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('no arc and no winner line before the day resolves', () => {
    renderHub()
    const tile = screen.getByRole('button', { name: 'Proaktív coaching' })
    expect(tile.querySelectorAll('.mzo-arcseg')).toHaveLength(0)
    expect(tile).not.toHaveTextContent('Terhelés–táplálás')
  })
})
