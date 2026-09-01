import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { candidateSeed } from '@/data/insights/knowledge'

const renderPage = () =>
  render(
    <MemoryRouter>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('KnowledgeListPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a hero a tényszámot és a ténylegesen promptba kerülő darabszámot mutatja', async () => {
    renderPage()
    // 15 seed, ebből 14 bekapcsolt → a top 10 megy a chatbe. Mozaik re-face (mezo-d20.5.5):
    // a fejléc a prototípus #page-tudas hero-ja lett — nagy szám + "tény rólad · N megy a chatbe".
    expect(screen.getByText('Tudástár')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('15'))
    expect(screen.getByText('tény rólad · 10 megy a chatbe')).toBeInTheDocument()
  })

  test('a tények kategória-mosott csempék clay ikon-koronggal (iterációk §1 tile pass)', () => {
    const { container } = renderPage()
    // edzés → korall wash; a csempén ikon-korong + kapcsoló
    const trainTile = screen.getByText('Volleyball: kedd + csütörtök + szombat').closest('.mz-facttile')
    expect(trainTile).not.toBeNull()
    expect(trainTile).toHaveClass('mz-w-coral')
    expect(trainTile!.querySelector('.mz-fic svg')).not.toBeNull()
    // étkezés → zsálya wash
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit').closest('.mz-facttile')).toHaveClass('mz-w-sage')
    // a nyitott szakaszok (top-10 + kimarad) mind csempeként állnak
    expect(container.querySelectorAll('.mz-facttile').length).toBe(14)
  })

  test('a kikapcsolt tény szaggatott, halkított csempére halkul', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    const offTile = screen.getByText('kifli.hu primary food source').closest('.mz-facttile')
    expect(offTile).toHaveClass('off')
  })

  test('a jóváhagyás-inbox kártya az arany-gyűrűs mz-candc arcot viseli', () => {
    renderPage()
    expect(screen.getByText(candidateSeed[0].text).closest('.mz-candc')).not.toBeNull()
  })

  test('a fejléc alatt egy sor-gomb visz a Tudásgráfra', () => {
    renderPage()
    const row = screen.getByRole('button', { name: 'Tudásgráf' })
    expect(row).toBeInTheDocument()
    expect(screen.getByText(/kapcsolatok és életesemények · élő mindmap/)).toBeInTheDocument()
  })

  test('a három prompt-státusz szakasz a helyes darabszámokkal jelenik meg', () => {
    renderPage()
    expect(screen.getByText(/Most ezeket kapja meg a társ · 10/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 4/)).toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
  })

  test('a kapcsoló átmozgatja a tényt a kikapcsolt szakaszba', async () => {
    renderPage()
    // az első switch a legerősebb aktív tényé (f2, ×23) — kikapcsolva 13 aktív marad, így a
    // top-10 továbbra is tele van, de a várakozók száma 4→3, a kikapcsoltaké 1→2 lesz
    await userEvent.click(screen.getAllByRole('switch')[0])
    expect(await screen.findByText(/Kikapcsolva · 2/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 3/)).toBeInTheDocument()
    expect(screen.getByText('tény rólad · 10 megy a chatbe')).toBeInTheDocument()
  })

  test('a keresés a látható szövegre szűr', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
    expect(screen.queryByText('Volleyball: kedd + csütörtök + szombat')).not.toBeInTheDocument()
  })

  test('a kategória-chip szűr, és a törlés visszaadja a teljes listát', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    expect(screen.queryByText('Caffeine cutoff: 14:00 hard limit')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('a találat nélküli keresés őszinte üres állapotot ad, "Szűrők törlése" gombbal', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'zzzz')
    expect(screen.getByText('Nincs találat a keresésre.')).toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: 'Szűrők törlése' })

    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    await userEvent.click(clearBtn)
    expect(screen.getByLabelText('Keresés a tények között')).toHaveValue('')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('a "Mind" chip csak a kategória-szűrőt törli, a keresőmezőt érintetlenül hagyja (mezo-9ryh review fix)', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    expect(screen.getByText('Nincs találat a keresésre.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(screen.getByLabelText('Keresés a tények között')).toHaveValue('caffeine')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('egy csak kikapcsolt tényre illeszkedő keresés kinyitja a "Kikapcsolva" szakaszt, nem mutat "Nincs találat"-ot (mezo-9ryh review fix)', async () => {
    renderPage()
    // f9 (kifli.hu…) az egyetlen kikapcsolt tény, és a "Kikapcsolva" szakasz alapból csukott.
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    expect(screen.queryByText('Nincs találat a keresésre.')).not.toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
    expect(screen.getByText('kifli.hu primary food source')).toBeInTheDocument()
  })

  test('az 1. szakasz darabszáma a szűrt listát mutatja, a globális fejléc a teljeset (mezo-9ryh review fix)', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText('tény rólad · 10 megy a chatbe')).toBeInTheDocument()
    expect(screen.getByText(/Most ezeket kapja meg a társ · 1$/)).toBeInTheDocument()
  })

  test('renders the pending candidates with the L2 actions', () => {
    renderPage()
    const heading = screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length}`)
    expect(heading).toBeInTheDocument()
    expect(screen.getByText(candidateSeed[0].text)).toBeInTheDocument()
    // az „Elfogad" gomb a jelöltek csoportjára van skálázva, mert az életesemény-jelöltek
    // csoportja is ad egy „Elfogad" gombot (W2.3, mezo-b3pp.8) — a globális lekérdezés
    // hamisan bukna emiatt.
    expect(within(heading.parentElement as HTMLElement).getAllByRole('button', { name: 'Elfogad' })).toHaveLength(
      candidateSeed.length,
    )
  })

  test('accepting a candidate promotes it into the fact list', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Elfogad' })[0])
    // az elfogadás minden számlálót léptet: a hero nagy száma 15 → 16
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('16'))
    expect(screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length - 1}`)).toBeInTheDocument()
  })

  test('refining reveals the inline input and promotes the corrected wording', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Pontosít' })[0])
    const input = screen.getByLabelText('Pontosított tény')
    await userEvent.clear(input)
    await userEvent.type(input, 'Pontosított tudás')
    await userEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(await screen.findByText('Pontosított tudás')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('16'))
  })

  test('rejecting a candidate removes it without promoting', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Elvet' })[0])
    expect(await screen.findByText(`Jóváhagyásra vár · ${candidateSeed.length - 1}`)).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('15'))
  })

  it('kirajzolja az életesemény-jelöltek csoportot és a döntés gombjait', async () => {
    renderPage()
    expect(await screen.findByText(/Életesemény-jelöltek/)).toBeInTheDocument()
    expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
    const accept = screen.getAllByRole('button', { name: 'Elfogad' })
    expect(accept.length).toBeGreaterThan(0)
  })

  it('a szezon-jelölteket külön csoportban, saját (nem életesemény) provenienciával jeleníti meg (W5.3, mezo-b3pp.20)', async () => {
    renderPage()
    // Ha a kártya visszaesne az egyetlen hard-coded életesemény-szövegre, ez a csoport és ez a
    // mondat is eltűnne — a teszt pontosan azt bukja meg, amit ez a slice orvosolt.
    expect(await screen.findByText(/Szezon-jelöltek/)).toBeInTheDocument()
    expect(screen.getByText('Nyári alapozás')).toBeInTheDocument()
    expect(screen.getByText(
      'Ezt a negyedév és az előző negyedév összefoglalóiból olvastam ki — csak akkor kerül a gráfba, ha elfogadod.',
    )).toBeInTheDocument()

    // Az életesemény-kártya a SAJÁT (más) provenienciáját tartja meg — a két copy nem eshet
    // egybe, különben egy szezon fölött életesemény-szöveg állna.
    expect(screen.getByText(
      'Ezt a napod szövegeiből szűrtem ki — csak akkor kerül a gráfba, ha elfogadod.',
    )).toBeInTheDocument()
  })

  it('elvetés után eltűnik a jelölt a listáról', async () => {
    renderPage()
    const card = (await screen.findByText('Új munkahely első hete')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Elvet' }))
    await waitFor(() =>
      expect(screen.queryByText('Új munkahely első hete')).not.toBeInTheDocument())
  })

  it('egy élt nem javasló SEASON elfogadása a rövid megerősítést adja, saját csoportjában', async () => {
    renderPage()
    const card = (await screen.findByText('Nyári alapozás')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Elfogad' }))

    const confirmed = (await screen.findByText('Nyári alapozás')).closest('.card') as HTMLElement
    expect(within(confirmed).getByText('Bekerült a gráfba')).toBeInTheDocument()
    // proposedEdgeCount === 0 → nincs „· N kapcsolattal" toldalék
    expect(within(confirmed).queryByText(/kapcsolattal/)).not.toBeInTheDocument()
    // a SEASON csoport fejléce vált, az életesemény-csoporté érintetlen marad
    expect(screen.getByText('Szezonok')).toBeInTheDocument()
    expect(screen.getByText(/Életesemény-jelöltek · 1/)).toBeInTheDocument()
  })

  it('az utolsó elfogadás után a fejléc „Életesemények", nem „…jelöltek · 0"', async () => {
    renderPage()
    const card = (await screen.findByText('Új munkahely első hete')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Elfogad' }))

    expect(await screen.findByText(/Bekerült a gráfba/)).toBeInTheDocument()
    expect(screen.getByText('Életesemények')).toBeInTheDocument()
    expect(screen.queryByText(/Életesemény-jelöltek/)).not.toBeInTheDocument()
  })

  it('elfogadás után megerősítő kártya marad a helyén, linkkel a Tudásgráfra', async () => {
    renderPage()
    const card = (await screen.findByText('Új munkahely első hete')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Elfogad' }))

    expect(await screen.findByText(/Bekerült a gráfba/)).toBeInTheDocument()
    // a cím továbbra is olvasható, hogy tudd, MI került be
    expect(screen.getByText('Új munkahely első hete')).toBeInTheDocument()
    // a döntés gombjai eltűntek — a kártya már nem jelölt
    expect(within(screen.getByText(/Bekerült a gráfba/).closest('.card') as HTMLElement)
      .queryByRole('button', { name: 'Elfogad' })).not.toBeInTheDocument()
    const acceptedCard = screen.getByText(/Bekerült a gráfba/).closest('.card') as HTMLElement
    const link = within(acceptedCard).getByRole('link', { name: /Tudásgráf/ })
    expect(link).toHaveAttribute('href', '/me/knowledge')
  })
})

describe('KnowledgeListPage (V3.3 evidence link, real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a pattern-sourced fact renders the promoting pattern chip', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([
          {
            id: 'pf1',
            factText: 'Stressz rontja az alvást',
            category: 'health',
            source: 'pattern',
            reinforcementCount: 2,
            includeInPrompt: true,
            lastReinforcedAt: null,
            createdAt: '2026-07-04T02:40:00Z',
            patternTitle: 'Stressz-szint ↔ aznapi alvásminőség',
          },
        ]),
      ),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()

    expect(await screen.findByText('Stressz rontja az alvást')).toBeInTheDocument()
    expect(screen.getByText(/A minta: „Stressz-szint ↔ aznapi alvásminőség"/)).toBeInTheDocument()
  })
})

describe('KnowledgeListPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the fetched facts + pending candidates from the API', async () => {
    renderPage()
    expect(await screen.findByText('tény rólad · 10 megy a chatbe')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('15'))
    expect(screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length}`)).toBeInTheDocument()
    expect(screen.getByText(candidateSeed[1].text)).toBeInTheDocument()
  })

  test('accepting a candidate POSTs the decision and refetches without it', async () => {
    // stateful override: the pending list empties once the decision lands
    let posted = 0
    let pending = candidateSeed.map((c, i) => ({
      id: c.id, candidateText: c.text, category: c.category,
      userDecision: null, refinedText: null, promotedFactId: null,
      createdAt: `2026-07-03T06:0${i}:00Z`,
    }))
    server.use(
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json(pending)),
      http.post(`${API_BASE}/api/companion/fact/candidate/c1/decision`, () => {
        posted++
        pending = []
        return HttpResponse.json({
          id: 'c1', candidateText: candidateSeed[0].text, category: 'fuel',
          userDecision: 'accept', refinedText: null, promotedFactId: 'kf-c1',
          createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Elfogad' }))[0])
    await waitFor(() => expect(posted).toBe(1))
    await waitFor(() => expect(screen.queryByText(/Jóváhagyásra vár/)).not.toBeInTheDocument())
  })

  test('renders the honest degraded state when the companion switch is off', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  test('renders the honest loading state while the fetch is unresolved, never a fabricated "0 tény / 0 megy a chatbe" header (mezo-9ryh review fix)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
      http.get(`${API_BASE}/api/companion/fact/candidate`, async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )
    renderPage()

    expect(await screen.findByText('A tudástár betöltése…')).toBeInTheDocument()
    expect(screen.queryByText(/tény$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/megy a chatbe/)).not.toBeInTheDocument()
  })

  test('a genuinely failed fetch (500) renders a retry state, not the "0 megy a chatbe" realEmpty read (mezo-9ryh review fix)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()

    expect(await screen.findByText('Nem sikerült betölteni a tudástárat.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    expect(screen.queryByText(/megy a chatbe/)).not.toBeInTheDocument()
  })

  test('a genuinely empty knowledge base renders an honest empty line, no search/filter chrome over nothing (mezo-9ryh review fix)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()

    expect(
      await screen.findByText('Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mind' })).not.toBeInTheDocument()
  })
})
