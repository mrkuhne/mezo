import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { GRAPH_KIND_GROUPS, lifeEventCandidateSeed } from '@/data/insights/graph'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { KnowledgeNodePage } from '@/features/insights/pages/KnowledgeNodePage'
import { candidateSeed, facts as factSeed } from '@/data/insights/knowledge'
import { people as personSeed } from '@/data/me/people'
import { MOCK_EFFECT_SUBJECTS } from '@/data/insights/knowledgeHub'
import { TILE_STATE, heroNote } from '@/features/insights/logic/hubCopy'

const MOCK_PENDING_COUNT = candidateSeed.length + lifeEventCandidateSeed.length

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
  return <><div data-testid="loc-probe">{location.search}</div><div data-testid="path-probe">{location.pathname}</div></>
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

  // ---- S6 (mezo-d6ivw.6): the base view is the hub --------------------------------------------

  test('the base view is the hub: four section tiles, secondary links, no search', () => {
    renderPage()
    for (const name of ['Rólad', 'Emberek', 'Észrevételek', 'Hatások']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
    }
    expect(screen.getByText('Kategóriák')).toBeInTheDocument()
    expect(screen.getByText('Hogyan tanul?')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('dolgot tud rólad Mezo')).toBeInTheDocument()
  })

  test('the hero counts facts + person facts + effect subjects once each (an observation rides on its fact)', async () => {
    renderPage()
    const total = factSeed.length + personSeed.flatMap((p) => p.facts).length + MOCK_EFFECT_SUBJECTS.length
    await waitFor(() => expect(document.querySelector('.th-hero .big')?.textContent).toBe(String(total)))
    expect(screen.getByText(heroNote('ok'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rólad/ })).toHaveTextContent(String(factSeed.length))
  })

  test.each([['tenyek', 'Tények rólad'], ['emberek', 'Emberek az életedben'], ['eszrevetelek', 'Észrevételek'], ['hatasok', 'Hatások']])(
    '?view=%s opens its section', (view, title) => {
      renderPage(`/?view=${view}`)
      expect(screen.getByText(title, { selector: 'strong' })).toBeInTheDocument()
    })

  test('a section tile opens its view, and its back control returns to the hub', async () => {
    renderPageWithProbe('/')
    await userEvent.click(screen.getByRole('button', { name: /Hatások/ }))
    expect(screen.getByTestId('loc-probe').textContent).toBe('?view=hatasok')
    await userEvent.click(screen.getByRole('button', { name: 'Vissza: Tudástár' }))
    expect(screen.getByTestId('loc-probe').textContent).toBe('')
  })

  test('?view=emberek&person=<id> opens the person sub-view; back returns to Emberek', async () => {
    const person = personSeed.find((p) => p.facts.length > 0)!
    renderPageWithProbe(`/?view=emberek&person=${person.id}`)
    expect(screen.getByText(person.name, { selector: 'strong' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Vissza: Emberek' }))
    expect(screen.getByTestId('loc-probe').textContent).toBe('?view=emberek')
    expect(screen.getByText('Emberek az életedben', { selector: 'strong' })).toBeInTheDocument()
  })

  test('an unknown ?person= id reads as the plain Emberek list', () => {
    renderPage('/?view=emberek&person=nope')
    expect(screen.getByText('Emberek az életedben', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza: Tudástár' })).toBeInTheDocument()
  })

  test('(b) ?view=tenyek a keresőt és a vödröket mutatja, a csempék eltűnnek', () => {
    renderPage('/?view=tenyek')
    expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
    expect(screen.getByText(/Ezeket tudja rólad/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rólad/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kategóriák/ })).not.toBeInTheDocument()
  })

  test('(c) érvénytelen ?view= az alapnézetre esik vissza', () => {
    renderPage('/?view=rossz')
    expect(screen.getByRole('button', { name: /Rólad/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Keresés a tények között')).not.toBeInTheDocument()
  })

  test('(d) a „Hogyan tanul?" link ?view=hogyan-ra visz, a „‹ Tudástár" back-chip jelenik meg', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Hogyan tanul\?/ }))
    expect(screen.getByText('Hogyan működik?', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza: Tudástár' })).toBeInTheDocument()
  })

  test('(f) a Tudásgráf sor-gomb nincs többé', () => {
    renderPage()
    expect(screen.queryByLabelText('Tudásgráf')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tudásgráf' })).not.toBeInTheDocument()
  })

  // ---- Task 11 (mezo-zpxv7): the inbox moved to Rólad — the Tudástár shows only the pointer ---

  test('(g) az alapnézet a Rólad-pointert mutatja (csendes link), nem az inbox-kártyákat', () => {
    renderPage()
    expect(screen.queryByText(candidateSeed[0].text)).not.toBeInTheDocument()
    expect(document.querySelector('[data-fact-candidate]')).toBeNull()
    const pointer = screen.getByText(`${MOCK_PENDING_COUNT} javaslat vár rád a Rólad oldalon`)
    expect(pointer.closest('a')).toHaveAttribute('href', '/mezo/rolad')
    expect(pointer.closest('a')).toHaveClass('th-lk')
    expect(pointer.closest('a')).not.toHaveClass('glass')
    expect(screen.getByText('ott döntesz róluk')).toBeInTheDocument()
  })

  test('a pointer száma a tény- és az életesemény/szezon-jelölteket együtt számolja', () => {
    renderPage()
    expect(screen.getByText(`${candidateSeed.length + lifeEventCandidateSeed.length} javaslat vár rád a Rólad oldalon`)).toBeInTheDocument()
  })

  test('nincs data-week-banner az alapnézeten (a heti postaláda a Rólad oldalra került)', () => {
    renderPage('/?start=2026-09-14')
    expect(document.querySelector('[data-week-banner]')).toBeNull()
  })

  // ---- Task 10: `?fact=` deep link + kiemelés (mezo-ms9a) --------------------------------

  describe('(T10) ?fact= deep link + kiemelés', () => {
    // f1 = top-N (in-prompt) seed fact; f9 = the sole `active:false` seed fact, so it lands in
    // the "Kikapcsolva" bucket — the one LifecycleSection that starts COLLAPSED.
    test('(a) ?fact=<seed-id> a Tények nézetre kényszerít, a sor kiemelés-osztályt visel', () => {
      renderPage('/?fact=f1')
      expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
      const row = screen.getByText('Pull Day-en a Chest Supported Row a key compound').closest('[data-fact-row]')
      expect(row).toHaveClass('tud9-hl')
    })

    test('(b) a fact param az első render után eltűnik az URL-ből (view=tenyek marad helyette), a kiemelés megmarad', async () => {
      const { getByTestId } = renderPageWithProbe('/?fact=f1')
      await waitFor(() => expect(getByTestId('loc-probe').textContent).toBe('?view=tenyek'))
      // a kiemelés a param eltűnése UTÁN is él (local state, nem a param hordozza)
      const row = screen.getByText('Pull Day-en a Chest Supported Row a key compound').closest('[data-fact-row]')
      expect(row).toHaveClass('tud9-hl')
    })

    test('a fact-törlés a `view`-t is `tenyek`-re írja át, hogy a „‹ Tudástár" chip ne ragadjon be (review fix, mezo-ms9a)', async () => {
      const { getByTestId } = renderPageWithProbe('/?view=kategoriak&fact=f1')
      // a one-shot effekt a `fact` törlésével EGYÜTT `view=tenyek`-re írja az URL-t — nem hagyja
      // a korábbi `view=kategoriak`-ot érintetlenül, mert a kényszerített Tények-nézet különben csak
      // a `highlightFactId` state-en élne tovább, az URL-lel divergálva (a back-chip innen nem tudna
      // kilépni: az `onBack` a `view`-t törli, nem a highlightot).
      await waitFor(() => expect(getByTestId('loc-probe').textContent).not.toContain('fact'))
      expect(getByTestId('loc-probe').textContent).toContain('view=tenyek')

      // a back-chip innentől a normál Tények-nézet chipje — kattintásra visszavisz az alapnézetre.
      await userEvent.click(screen.getByRole('button', { name: 'Vissza: Tudástár' }))
      expect(screen.getByRole('button', { name: /Rólad/ })).toBeInTheDocument()
      expect(getByTestId('loc-probe').textContent).toBe('')
    })

    test('(c) ismeretlen fact id → Tények nézet, nincs kiemelés, nincs hiba', () => {
      renderPage('/?fact=nope-does-not-exist')
      expect(screen.getByLabelText('Keresés a tények között')).toBeInTheDocument()
      expect(document.querySelector('.tud9-hl')).toBeNull()
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
      expect(row.closest('[data-fact-row]')).toHaveClass('tud9-hl')
      // a szekció ténylegesen nyitva van — a sor nem csak a DOM-ban van jelen, hanem látszik is
      expect(screen.getByText(/Kikapcsolva · 2/)).toBeInTheDocument()
    })
  })

  // ---- Task 7: Kategóriák nézet + kind-lánc + Profil + Hogyan nézetek (mezo-ms9a) --------------

  // A kind-lista NEM fix hosszú: a `mezo-06o0.4` gráf-tükör felvette a PERSON ('Emberek')
  // kind-et, miközben ez a teszt 6 csempét/2 üreset pinnelt — külön-külön mindkét ág zöld volt,
  // mergelve piros. A számok ezért a GRAPH_KIND_GROUPS-ból derivált értékek, nem konstansok.
  test('(T7-a) ?view=kategoriak → minden kind-csempe, üres kind halványan, nem kattintható', () => {
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
    // ...and Emberek, since the seed carries no PERSON graph node either.
    expect(screen.getByText('Emberek')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Emberek' })).not.toBeInTheDocument()

    // Every kind gets a tile: the ones with nodes are clickable, the rest dimmed and inert.
    // Derived from GRAPH_KIND_GROUPS so adding a kind cannot silently drop a tile again.
    const empty = container.querySelectorAll('.tud9-kind-empty')
    const clickable = GRAPH_KIND_GROUPS
      .filter(([, label]) => screen.queryByRole('button', { name: label }) !== null).length
    expect(empty.length + clickable).toBe(GRAPH_KIND_GROUPS.length)
    expect(empty).toHaveLength(3)
  })

  test('(T7-b) &kind=PATTERN → kompakt sorok, PageHead ‹ Kategóriák', () => {
    renderPage('/?view=kategoriak&kind=PATTERN')
    expect(screen.getByRole('button', { name: 'Vissza: Kategóriák' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vissza: Tudástár' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ })).toBeInTheDocument()
    expect(screen.getByText('2 kapcsolat')).toBeInTheDocument()
    // grid tiles are gone in this drill
    expect(screen.queryByRole('button', { name: 'Célok' })).not.toBeInTheDocument()
  })

  test('(T7-c) érvénytelen kind → rács', () => {
    renderPage('/?view=kategoriak&kind=NOPE')
    expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza: Tudástár' })).toBeInTheDocument()
  })

  test('(T7-d) category row opens a full page with return context; archive removes the node', async () => {
    render(<MemoryRouter initialEntries={['/mezo/knowledge?view=kategoriak&kind=PATTERN&start=2026-09-14']}>
      <LocationProbe />
      <Routes>
        <Route path="/mezo/knowledge" element={<KnowledgeListPage />} />
        <Route path="/mezo/knowledge/node/:id" element={<KnowledgeNodePage />} />
      </Routes>
    </MemoryRouter>, { wrapper: QueryWrapper })
    await userEvent.click(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ }))
    expect(screen.getByTestId('path-probe')).toHaveTextContent('/mezo/knowledge/node/gn-1')
    expect(screen.getByTestId('loc-probe')).toHaveTextContent('view=kategoriak&kind=PATTERN&start=2026-09-14')
    // the edge row draws the relation and its strength apart (prototype evrow), the line stays whole
    const edge = await screen.findByText('Késői evés → kiváltja → Rossz alvás')
    expect(edge.closest('li')).toHaveAttribute('data-edge', 'Késői evés → kiváltja → Rossz alvás · erős')
    expect(edge.closest('li')).toHaveTextContent('erős')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Archivál' }))
    expect(await screen.findByText('Ez a kapcsolat már nem szerepel az aktív tudástárban.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Tudástár · vissza/ }))
    expect(screen.queryByRole('button', { name: /^Késői evés rontja az alvást/ })).not.toBeInTheDocument()
  })

  test('week context survives entry into facts and back (start= sticks, no banner on the Tudástár)', async () => {
    renderPageWithProbe('/?start=2026-09-14')
    await userEvent.click(screen.getByRole('button', { name: /Rólad/ }))
    expect(screen.getByTestId('loc-probe')).toHaveTextContent('start=2026-09-14')
    await userEvent.click(screen.getByRole('button', { name: 'Vissza: Tudástár' }))
    expect(screen.getByTestId('loc-probe')).toHaveTextContent('start=2026-09-14')
    expect(document.querySelector('[data-week-banner]')).toBeNull()
  })

  test('legacy communication profile redirects to central settings', async () => {
    renderPageWithProbe('/?view=profil')
    await waitFor(() => expect(screen.getByTestId('path-probe')).toHaveTextContent('/settings/mezo/communication'))
  })

  test('(T7-f) ?view=hogyan → mind a 6 kérdés-cím látszik', () => {
    renderPage('/?view=hogyan')
    expect(screen.getByText('Mi az a tény?')).toBeInTheDocument()
    expect(screen.getByText('Mit csinál a kapcsoló?')).toBeInTheDocument()
    expect(screen.getByText('Mit jelent a visszaigazolás?')).toBeInTheDocument()
    expect(screen.getByText('Mindet tudja egyszerre?')).toBeInTheDocument()
    expect(screen.getByText('Hol döntök a javaslatokról?')).toBeInTheDocument()
    expect(screen.getByText('Mik a kategóriák?')).toBeInTheDocument()
    expect(screen.getByText(/Ugyanennek a tudásnak a térképe/)).toBeInTheDocument()
  })

  test('a tények kategória-szerinti 3D ikonnal álló sorok egy lapos listában (üveg U9)', () => {
    // A FactsView-tartalom a T5 óta a ?view=tenyek nézet része, nem az alapnézeté.
    const { container } = renderPage('/?view=tenyek')
    // edzés → a sor az edzés-kategóriát viseli, 3D ikonnal + kapcsolóval
    const trainRow = screen.getByText('Volleyball: kedd + csütörtök + szombat').closest('[data-fact-row]')
    expect(trainRow).not.toBeNull()
    expect(trainRow).toHaveAttribute('data-cat', 'train')
    expect(trainRow!.querySelector('.t-ico')).not.toBeNull()
    expect(trainRow!.closest('.tf-tlist')).not.toBeNull()
    // étkezés → étkezés-kategória
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit').closest('[data-fact-row]')).toHaveAttribute('data-cat', 'fuel')
    // az „Ezeket tudja rólad" szakasz alapból nyitva áll, a „Kikapcsolva" nem
    expect(container.querySelectorAll('[data-fact-row]').length).toBe(14)
  })

  test('a kikapcsolt tény halkított sorra halkul', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    const offTile = screen.getByText('kifli.hu primary food source').closest('[data-fact-row]')
    expect(offTile).toHaveClass('off')
  })

  test('the section tiles are the hub\'s glass (one accent each); links and fact rows never are', () => {
    renderPage()
    const tiles = [...document.querySelectorAll<HTMLElement>('.th-tile')]
    expect(tiles).toHaveLength(4)
    expect(tiles.every((t) => t.classList.contains('glass'))).toBe(true)
    expect(new Set(tiles.map((t) => t.style.getPropertyValue('--c'))).size).toBe(4)
    expect(document.querySelector('.th-lk.glass')).toBeNull()
    expect(document.querySelector('[data-fact-row].glass')).toBeNull()
  })

  test('a két prompt-státusz szakasz a helyes darabszámokkal jelenik meg', () => {
    renderPage('/?view=tenyek')
    expect(screen.getByText(/Ezeket tudja rólad · 14/)).toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 2/)).toBeInTheDocument()
  })

  test('a kapcsoló átmozgatja a tényt a kikapcsolt szakaszba', async () => {
    renderPage('/?view=tenyek')
    // az első switch a legerősebb aktív tényé (f2, ×23) — kikapcsolva a bekapcsoltak száma
    // 14→13, a kikapcsoltaké 2→3 lesz (facts-always: nincs várakozó vödör)
    await userEvent.click(screen.getAllByRole('switch')[0])
    expect(await screen.findByText(/Kikapcsolva · 3/)).toBeInTheDocument()
    expect(screen.getByText(/Ezeket tudja rólad · 13/)).toBeInTheDocument()
    expect(screen.getByText(/tény rólad · 13 megy a chatbe/)).toBeInTheDocument()
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
    // f9 (kifli.hu…) az egyetlen "kifli"-re illeszkedő kikapcsolt tény, és a "Kikapcsolva"
    // szakasz alapból csukott — a szűrt lista számít, nem az összes kikapcsolt tény.
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'kifli')
    expect(screen.queryByText('Nincs találat a keresésre.')).not.toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
    expect(screen.getByText('kifli.hu primary food source')).toBeInTheDocument()
  })

  test('az 1. szakasz darabszáma a szűrt listát mutatja, a globális fejléc a teljeset (mezo-9ryh review fix)', async () => {
    renderPage('/?view=tenyek')
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText(/tény rólad · 14 megy a chatbe/)).toBeInTheDocument()
    expect(screen.getByText(/Ezeket tudja rólad · 1$/)).toBeInTheDocument()
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

  test('renders the fetched counts on the hub + the Rólad pointer, not the candidate cards', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /Rólad/ })).toHaveTextContent(String(factSeed.length)))
    expect(await screen.findByText(/\d+ javaslat vár rád a Rólad oldalon/)).toBeInTheDocument()
    expect(screen.queryByText(candidateSeed[1].text)).not.toBeInTheDocument()
    expect(document.querySelector('[data-fact-candidate]')).toBeNull()
  })

  test('(e) real-mode edgeCount 404 → nincs „kapcsolat" szöveg a Tények fejlécében', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/edge/count`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    const { container } = renderPage('/?view=tenyek')
    expect(await screen.findByText(/tény rólad · 14 megy a chatbe/)).toBeInTheDocument()
    expect(container.querySelector('.tud9-sub')?.textContent).not.toMatch(/kapcsolat/)
  })

  test('with no pending candidates there is no Rólad pointer at all', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () => HttpResponse.json([])),
    )
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /Rólad/ })).toBeInTheDocument())
    expect(screen.queryByText(/javaslat vár rád/)).not.toBeInTheDocument()
  })

  test('companion switch off: the Rólad tile is dashed with its own reason, Emberek still counts, the note says why', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText(TILE_STATE.offFacts)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rólad/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Emberek/ })).toBeInTheDocument()
    expect(screen.getByText(heroNote('off'))).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  test('(h) degraded a base nézeten: szaggatott Rólad csempe + Kategóriák link + a pointer csak a gráf-jelöltet számolja, Tények csempe nélkül', async () => {
    // A társ-kapcsoló 404-je (fact + fact/candidate) NEM a gráf-hookok 404-je (graph/node,
    // graph/node/candidate, graph/edge/count függetlenek) — ezért ezeket seed-szerű adattal
    // mockoljuk, hogy a teszt ténylegesen bizonyítsa: a gráf-eredetű jelölt degraded alatt is
    // beleszámít a pointer darabszámába (a fact-candidate fele viszont nem), nem csak azért
    // „megy át", mert az unhandled-request realEmpty ([]/null) történetesen ugyanazt a UI-t adná
    // vissza.
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
    expect(await screen.findByText(TILE_STATE.offFacts)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kategóriák/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rólad/ })).not.toBeInTheDocument()
    // degraded → csak a gráf-jelölt (1) számít, a fact-candidate fele nem — de a kártya maga a
    // Rólad-pointer, nem a jelölt-kártya (az most csak ott jelenik meg).
    expect(await screen.findByText('1 javaslat vár rád a Rólad oldalon')).toBeInTheDocument()
    expect(screen.queryByText('Új munkahely első hete')).not.toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: /Kategóriák/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Így beszélj velem' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza: Mezo' })).toBeInTheDocument()
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

  test('unresolved facts: the Rólad tile says it is loading, never a number; the other tiles are unaffected', async () => {
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
    expect(await screen.findByText(TILE_STATE.loading)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rólad/ })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: /Hatások/ })).toBeInTheDocument())
    expect(screen.getByText(heroNote('partial'))).toBeInTheDocument()
    expect(screen.queryByText(/megy a chatbe/)).not.toBeInTheDocument()
  })

  test('before anything resolves the hero shows no number at all', async () => {
    const hang = async () => { await delay('infinite'); return HttpResponse.json([]) }
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, hang),
      http.get(`${API_BASE}/api/companion/fact/candidate`, hang),
      http.get(`${API_BASE}/api/people`, hang),
      http.get(`${API_BASE}/api/companion/observation/knowledge`, hang),
      http.get(`${API_BASE}/api/companion/effects`, hang),
    )
    renderPage()
    await waitFor(() => expect(document.querySelector('.th-hero .big')).toHaveTextContent(TILE_STATE.loading))
    expect(document.querySelector('.th-split')).toBeNull()
    expect(document.querySelectorAll('.th-tile.is-dash')).toHaveLength(4)
  })

  test('a failed facts fetch (500) puts a retry on the Rólad tile only; the retry refetches', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () => {
        calls++
        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([])
      }),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () => HttpResponse.json([])),
    )
    renderPage()
    expect(await screen.findByText(TILE_STATE.error)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rólad/ })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: /Hatások/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Emberek/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: TILE_STATE.retry }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Rólad/ })).toHaveTextContent('0'))
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
