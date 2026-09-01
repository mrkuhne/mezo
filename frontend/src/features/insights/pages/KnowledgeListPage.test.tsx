import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { candidateSeed } from '@/data/insights/knowledge'

const renderPage = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

// T10 (mezo-ms9a): a `fact` param eltűnését az URL-ből egy hely-próbával figyeljük — a
// PeoplePage.test.tsx `LocationProbe` idiómája, csak `useSearchParams` helyett `useLocation`,
// mert itt kifejezetten a query-string alakja a kérdés (marad-e rajta más param).
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="loc-probe">{location.search}</div>
}

const renderPageWithProbe = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
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
    // mock módban az edgeCount sosem null → a „kapcsolat" szegmens is látszik (e teszt)
    expect(screen.getByText(/tény rólad · 10 megy a chatbe · \d+ kapcsolat/)).toBeInTheDocument()
  })

  // ---- (a)/(b)/(c)/(d)/(f) — mezo-ms9a shell: ?view= nézetváltás ----------------------------

  test('(a) alapnézeten a 3 szekció-csempe látszik, a kereső nem', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Tények' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kategóriák' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Így beszélj velem' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
  })

  test('(b) ?view=tenyek a keresőt és a vödröket mutatja, a csempék eltűnnek', () => {
    renderPage('/?view=tenyek')
    expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
    expect(screen.getByText(/Most ezeket kapja meg a társ/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tények' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kategóriák' })).not.toBeInTheDocument()
  })

  test('(c) érvénytelen ?view= az alapnézetre esik vissza', () => {
    renderPage('/?view=rossz')
    expect(screen.getByRole('button', { name: 'Tények' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
  })

  test('(d) a help-chip ?view=hogyan-ra visz, a „‹ Tudástár" back-chip jelenik meg', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Hogyan működik?' }))
    expect(screen.getByText('‹ Tudástár')).toBeInTheDocument()
  })

  test('(f) a Tudásgráf sor-gomb nincs többé', () => {
    renderPage()
    expect(screen.queryByLabelText('Tudásgráf')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tudásgráf' })).not.toBeInTheDocument()
  })

  test('(g) az inbox (jóváhagyás-jelöltek) az alapnézeten renderel', () => {
    renderPage()
    expect(screen.getByText(candidateSeed[0].text).closest('.mz-candc')).not.toBeNull()
  })

  // ---- Task 10: `?fact=` deep link + kiemelés (mezo-ms9a) --------------------------------

  describe('(T10) ?fact= deep link + kiemelés', () => {
    // f1 = top-N (in-prompt) seed fact; f9 = the sole `active:false` seed fact, so it lands in
    // the "Kikapcsolva" bucket — the one LifecycleSection that starts COLLAPSED.
    test('(a) ?fact=<seed-id> a Tények nézetre kényszerít, a sor kiemelés-osztályt visel', () => {
      renderPage('/?fact=f1')
      expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
      const row = screen.getByText('Pull Day-en a Chest Supported Row a key compound').closest('.mz-facttile')
      expect(row).toHaveClass('mz-fact-hl')
    })

    test('(b) a fact param az első render után eltűnik az URL-ből, a kiemelés megmarad', async () => {
      const { getByTestId } = renderPageWithProbe('/?fact=f1')
      await waitFor(() => expect(getByTestId('loc-probe').textContent).toBe(''))
      // a kiemelés a param eltűnése UTÁN is él (local state, nem a param hordozza)
      const row = screen.getByText('Pull Day-en a Chest Supported Row a key compound').closest('.mz-facttile')
      expect(row).toHaveClass('mz-fact-hl')
    })

    test('a fact-törlés csak a `fact` paramot dobja el, a `view`-t nem', async () => {
      const { getByTestId } = renderPageWithProbe('/?view=kategoriak&fact=f1')
      // a highlight a view-t Tényekre kényszeríti — de az URL-ben megmaradt `view` param nem
      // a `fact` mellékterméke, hanem a highlight-kényszer maga; csak a `fact` tűnik el a query-ből
      await waitFor(() => expect(getByTestId('loc-probe').textContent).not.toContain('fact'))
      expect(getByTestId('loc-probe').textContent).toContain('view=kategoriak')
    })

    test('(c) ismeretlen fact id → Tények nézet, nincs kiemelés, nincs hiba', () => {
      renderPage('/?fact=nope-does-not-exist')
      expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
      expect(document.querySelector('.mz-fact-hl')).toBeNull()
    })

    test('a kiemelt sor mountkor középre görgeti magát', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      renderPage('/?fact=f1')
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
      expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'center' })
    })

    test('a "Kikapcsolva" (alapból csukott) vödör nyitva renderel, ha a kiemelt tény oda esik', async () => {
      renderPage('/?fact=f9')
      const row = await screen.findByText('kifli.hu primary food source')
      expect(row.closest('.mz-facttile')).toHaveClass('mz-fact-hl')
      // a szekció ténylegesen nyitva van — a sor nem csak a DOM-ban van jelen, hanem látszik is
      expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
    })
  })

  // ---- Task 7: Kategóriák nézet + kind-lánc + Profil + Hogyan nézetek (mezo-ms9a) --------------

  test('(T7-a) ?view=kategoriak → 6 kind-csempe, üres kind halványan, nem kattintható', () => {
    const { container } = renderPage('/?view=kategoriak')
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preferenciák' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Célok' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Életesemények' })).toBeInTheDocument()
    // empty kinds (seed has no SEASON node, and the profile node's INSIGHT kind is excluded) —
    // present but dimmed/inert, not a clickable button
    expect(screen.getByText('Szezonok')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Szezonok' })).not.toBeInTheDocument()
    expect(screen.getByText('Belátások')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Belátások' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.tud-kind-empty')).toHaveLength(2)
  })

  test('(T7-b) &kind=PATTERN → kompakt sorok, PageHead ‹ Kategóriák', () => {
    renderPage('/?view=kategoriak&kind=PATTERN')
    expect(screen.getByText('‹ Kategóriák')).toBeInTheDocument()
    expect(screen.queryByText('‹ Tudástár')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ })).toBeInTheDocument()
    expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
    // grid tiles are gone in this drill
    expect(screen.queryByRole('button', { name: 'Célok' })).not.toBeInTheDocument()
  })

  test('(T7-c) érvénytelen kind → rács', () => {
    renderPage('/?view=kategoriak&kind=NOPE')
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByText('‹ Tudástár')).toBeInTheDocument()
  })

  test('(T7-d) sor-klikk → sheet nyílik, Archivál → node eltűnik + sheet záródik', async () => {
    renderPage('/?view=kategoriak&kind=PATTERN')
    await userEvent.click(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ }))
    expect(await screen.findByText('Késői evés → kiváltja → Rossz alvás · erős')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Archivál' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Késői evés rontja az alvást/ })).not.toBeInTheDocument())
    expect(screen.queryByText('Késői evés → kiváltja → Rossz alvás · erős')).not.toBeInTheDocument()
  })

  test('(T7-e) ?view=profil → „Így beszélj velem" cím + „Rólad tanultam" kártya + Archivál', () => {
    renderPage('/?view=profil')
    expect(screen.getByText('Így beszélj velem')).toBeInTheDocument()
    expect(screen.getByText('Rólad tanultam')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archivál' })).toBeInTheDocument()
    // the retired word never appears user-visible
    expect(screen.queryByText('Profil')).not.toBeInTheDocument()
  })

  test('(T7-f) ?view=hogyan → mind a 6 kérdés-cím látszik', () => {
    renderPage('/?view=hogyan')
    expect(screen.getByText('Mi az a tény?')).toBeInTheDocument()
    expect(screen.getByText('Mit csinál a kapcsoló?')).toBeInTheDocument()
    expect(screen.getByText('Mit jelent a visszaigazolás?')).toBeInTheDocument()
    expect(screen.getByText('Miért marad ki néhány?')).toBeInTheDocument()
    expect(screen.getByText('Mi vár jóváhagyásra?')).toBeInTheDocument()
    expect(screen.getByText('Mik a kategóriák?')).toBeInTheDocument()
    expect(screen.getByText(/Ugyanennek a tudásnak a térképe/)).toBeInTheDocument()
  })

  test('a tények kategória-mosott csempék clay ikon-koronggal (iterációk §1 tile pass)', () => {
    // A FactsView-tartalom a T5 óta a ?view=tenyek nézet része, nem az alapnézeté.
    const { container } = renderPage('/?view=tenyek')
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
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    const offTile = screen.getByText('kifli.hu primary food source').closest('.mz-facttile')
    expect(offTile).toHaveClass('off')
  })

  test('a jóváhagyás-inbox kártya az arany-gyűrűs mz-candc arcot viseli', () => {
    renderPage()
    expect(screen.getByText(candidateSeed[0].text).closest('.mz-candc')).not.toBeNull()
  })

  test('a három prompt-státusz szakasz a helyes darabszámokkal jelenik meg', () => {
    renderPage('/?view=tenyek')
    expect(screen.getByText(/Most ezeket kapja meg a társ · 10/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 4/)).toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
  })

  test('a kapcsoló átmozgatja a tényt a kikapcsolt szakaszba', async () => {
    renderPage('/?view=tenyek')
    // az első switch a legerősebb aktív tényé (f2, ×23) — kikapcsolva 13 aktív marad, így a
    // top-10 továbbra is tele van, de a várakozók száma 4→3, a kikapcsoltaké 1→2 lesz
    await userEvent.click(screen.getAllByRole('switch')[0])
    expect(await screen.findByText(/Kikapcsolva · 2/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 3/)).toBeInTheDocument()
    expect(screen.getByText(/tény rólad · 10 megy a chatbe/)).toBeInTheDocument()
  })

  test('a keresés a látható szövegre szűr', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
    expect(screen.queryByText('Volleyball: kedd + csütörtök + szombat')).not.toBeInTheDocument()
  })

  test('a kategória-chip szűr, és a törlés visszaadja a teljes listát', async () => {
    renderPage('/?view=tenyek')
    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    expect(screen.queryByText('Caffeine cutoff: 14:00 hard limit')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('a találat nélküli keresés őszinte üres állapotot ad, "Szűrők törlése" gombbal', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'zzzz')
    expect(screen.getByText('Nincs találat a keresésre.')).toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: 'Szűrők törlése' })

    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    await userEvent.click(clearBtn)
    expect(screen.getByLabelText('Keresés a tények között')).toHaveValue('')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('a "Mind" chip csak a kategória-szűrőt törli, a keresőmezőt érintetlenül hagyja (mezo-9ryh review fix)', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    expect(screen.getByText('Nincs találat a keresésre.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(screen.getByLabelText('Keresés a tények között')).toHaveValue('caffeine')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('egy csak kikapcsolt tényre illeszkedő keresés kinyitja a "Kikapcsolva" szakaszt, nem mutat "Nincs találat"-ot (mezo-9ryh review fix)', async () => {
    // f9 (kifli.hu…) az egyetlen kikapcsolt tény, és a "Kikapcsolva" szakasz alapból csukott.
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    expect(screen.queryByText('Nincs találat a keresésre.')).not.toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
    expect(screen.getByText('kifli.hu primary food source')).toBeInTheDocument()
  })

  test('az 1. szakasz darabszáma a szűrt listát mutatja, a globális fejléc a teljeset (mezo-9ryh review fix)', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText(/tény rólad · 10 megy a chatbe/)).toBeInTheDocument()
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
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('16'))
    // a promotált tény maga a ?view=tenyek nézet listájában olvasható, nem az alapnézeten
    await userEvent.click(screen.getByRole('button', { name: 'Tények' }))
    expect(await screen.findByText('Pontosított tudás')).not.toBeNull()
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

  it('elfogadás után megerősítő kártya marad a helyén, link nélkül (a gráf innen már nem külön oldal)', async () => {
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
    expect(within(acceptedCard).queryByRole('link')).not.toBeInTheDocument()
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
    renderPage('/?view=tenyek')

    expect(await screen.findByText('Stressz rontja az alvást')).toBeInTheDocument()
    expect(screen.getByText(/A minta: „Stressz-szint ↔ aznapi alvásminőség"/)).toBeInTheDocument()
  })
})

describe('KnowledgeListPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the fetched facts + pending candidates from the API', async () => {
    renderPage()
    expect(await screen.findByText(/tény rólad · 10 megy a chatbe/)).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.mz-bignum')?.textContent).toBe('15'))
    expect(screen.getByText(`Jóváhagyásra vár · ${candidateSeed.length}`)).toBeInTheDocument()
    expect(screen.getByText(candidateSeed[1].text)).toBeInTheDocument()
  })

  test('(e) real-mode edgeCount 404 → nincs „kapcsolat" szöveg a hero-ban', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/edge/count`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    const { container } = renderPage()
    expect(await screen.findByText(/tény rólad · 10 megy a chatbe/)).toBeInTheDocument()
    expect(container.querySelector('.mz-hero-sb')?.textContent).not.toMatch(/kapcsolat/)
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

  test('(h) degraded a base nézeten: degraded kártya + Kategóriák csempe + életesemény-jelölt, Tények csempe nélkül', async () => {
    // A társ-kapcsoló 404-je (fact + fact/candidate) NEM a gráf-hookok 404-je (graph/node,
    // graph/node/candidate, graph/edge/count függetlenek) — ezért ezeket seed-szerű adattal
    // mockoljuk, hogy a teszt ténylegesen bizonyítsa: a gráf-eredetű tartalom degraded alatt is
    // renderel, nem csak azért „megy át", mert az unhandled-request realEmpty ([]/null) történetesen
    // ugyanazt a UI-t adná vissza.
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely első hete', summary: 'Első hét.',
            status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 1,
            createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
          },
        ])),
      http.get(`${API_BASE}/api/companion/graph/node`, () =>
        HttpResponse.json([
          {
            id: 'n2', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
            status: 'active', createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
            proposedEdgeCount: 0, topEdges: [],
          },
        ])),
      http.get(`${API_BASE}/api/companion/graph/edge/count`, () => HttpResponse.json({ count: 3 })),
    )
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kategóriák' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tények' })).not.toBeInTheDocument()
    expect(await screen.findByText('Új munkahely első hete')).toBeInTheDocument()
  })

  test('(T7-g) profil-node nélkül ?view=profil → alapnézet', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node`, () =>
        HttpResponse.json([
          {
            id: 'n2', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
            status: 'active', createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
            proposedEdgeCount: 0, topEdges: [], sourceKind: null,
          },
        ])),
    )
    renderPage('/?view=profil')
    expect(await screen.findByRole('button', { name: 'Kategóriák' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Így beszélj velem' })).not.toBeInTheDocument()
    expect(screen.getByText('‹ Mezo')).toBeInTheDocument()
    expect(screen.queryByText('Rólad tanultam')).not.toBeInTheDocument()
  })

  test('(i) degraded + ?view=tenyek: csak a degraded kártya, kereső nincs', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    renderPage('/?view=tenyek')
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
    expect(screen.queryByText(/Még egy tényt sem tanultam rólad/)).not.toBeInTheDocument()
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
    // A T5 óta a tény-lista (és így az őszinte üres állapot is) a ?view=tenyek nézeté.
    renderPage('/?view=tenyek')

    expect(
      await screen.findByText('Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mind' })).not.toBeInTheDocument()
  })
})
