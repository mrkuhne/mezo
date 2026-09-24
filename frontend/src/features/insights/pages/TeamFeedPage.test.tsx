import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { TeamFeedPage } from '@/features/insights/pages/TeamFeedPage'
import { MOCK_EDITIONS, MOCK_OVERVIEW } from '@/data/character/characterMock'
import { localDateString } from '@/shared/lib/dates'

const renderPage = () =>
  render(<MemoryRouter><TeamFeedPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('TeamFeedPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a fal a mock-seed rekordjait karakterposztként rendereli', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Üzenőfal' })).toBeInTheDocument()
    const strip = screen.getByRole('navigation', { name: 'A csapat' })
    expect(within(strip).getAllByRole('link')).toHaveLength(5) // a Szkeptikusnak nincs köre
    expect(document.querySelectorAll('article').length).toBeGreaterThan(2)
    expect(screen.getAllByText(/^(Falat|Szunya|Mocor|Derű|Mezo)$/).length).toBeGreaterThan(2)
    // naponta legfeljebb egy üveg-poszter
    for (const day of document.querySelectorAll('.tf-daysec'))
      expect(day.querySelectorAll('.tf-poster').length).toBeLessThanOrEqual(1)
    expect(document.querySelectorAll('.tf-post.glass')).toHaveLength(0) // a csendes poszt sosem üveg
  })

  // H5 (mezo-a9bo7.16): Derű kérése nem állítás — ott a „Miből látszik?” helyén a „Bejelentkezem”
  // CTA áll; Falat napi értékelése a Fuel-napra mutat, nem egy /mezo/ mélyoldalra.
  test('Miből látszik? minden állítás-poszton a meglévő mélyoldalra visz', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    const sources = screen.getAllByRole('link', { name: 'Miből látszik?' })
    const ctas = screen.getAllByRole('link', { name: 'Bejelentkezem' })
    expect(ctas.length).toBeGreaterThan(0)
    expect(sources).toHaveLength(document.querySelectorAll('article').length - ctas.length)
    for (const a of sources) expect(a.getAttribute('href')).toMatch(/^\/(mezo\/|fuel$)/)
    expect(sources.some(a => a.getAttribute('href') === '/fuel')).toBe(true)
    for (const a of ctas) expect(a.getAttribute('href')).toBe('/nap/checkin')
  })

  test('minden poszton ott az egységes hármas', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    for (const article of document.querySelectorAll('article')) {
      const scoped = within(article as HTMLElement)
      const decided = article.querySelector('.tf-after')
      const request = article.querySelector('.tf-cta') // H5: a kérés-poszton CTA áll a hármas helyén
      if (request) expect(scoped.queryByRole('button', { name: /Ez talál/ })).not.toBeInTheDocument()
      else if (!decided) expect(scoped.getByRole('button', { name: /Elmesélem|Beszéljük meg/ })).toBeInTheDocument()
    }
  })

  // csapatfal H2 (mezo-a9bo7.13): a kiadás napján a fal a kiadás válogatása.
  test('a kiadás napján a fal a kiadást mutatja: a rang 1 az üveg-poszter, a többi csendes panel', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    const { day, posts } = MOCK_EDITIONS[0]
    const section = screen.getByRole('region', { name: 'Ma' })
    expect(section.querySelector('.tf-poster')!.getAttribute('data-post-id')).toBe(`edition:${day}:1`)
    const ids = [...section.querySelectorAll('article')].map(a => a.getAttribute('data-post-id')!)
    expect(ids.filter(id => id.startsWith('edition:'))).toEqual(posts.map(p => `edition:${day}:${p.rank}`))
    // a rang 2–3 lapos panel marad (naponta egy üveg, restored bible §3.4)
    for (const p of posts.slice(1))
      expect(section.querySelector(`[data-post-id="edition:${day}:${p.rank}"]`)!.classList.contains('glass')).toBe(false)
  })

  test('a Rád vár sáv csak akkor látszik, ha valami tényleg rád vár', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    const waiting = document.querySelectorAll('[data-waiting]').length
    const strip = screen.queryByRole('button', { name: /várnak rád|vár rád/ })
    if (waiting > 0) expect(strip).toBeInTheDocument()
    else expect(strip).not.toBeInTheDocument()
  })
})

describe('TeamFeedPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('betöltés alatt nincs üres-állapot felvillanás', () => {
    renderPage()
    expect(screen.queryByText(/csend van a falon/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Üzenőfal' })).not.toBeInTheDocument()
  })

  const emptyRecords = () => {
    for (const path of ['/api/companion/pattern', '/api/companion/observation', '/api/proactive/prediction', '/api/proactive/experiment', '/api/character/feed'])
      server.use(http.get(`${API_BASE}${path}`, () => HttpResponse.json([])))
  }

  test('hidegindítás: üres fal + érintetlen dosszié → az öt bemutatkozó poszt, rekord-poszt nélkül', async () => {
    emptyRecords() // az alap MSW-dosszié üres (MOCK_OVERVIEW_EMPTY)
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Szia! Mi leszünk a te kis csapatod.' })).toBeInTheDocument()
    const intros = document.querySelectorAll('article[data-intro]')
    expect([...intros].map(a => a.getAttribute('data-intro'))).toEqual(['mezo', 'szunya', 'falat', 'mocor', 'deru'])
    expect(document.querySelectorAll('article:not([data-intro])')).toHaveLength(0)
    expect(document.querySelectorAll('.tf-poster')).toHaveLength(1) // csak Mezo üveg
    // statikus bemutatkozás, nem állítás: se „Miből látszik?”, se hármas
    expect(screen.queryByRole('link', { name: 'Miből látszik?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ez talál/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kezdjük el a dossziét' })).toBeInTheDocument()
    expect(screen.queryByText(/csend van a falon/i)).not.toBeInTheDocument()
  })

  test('a „Kezdjük el a dossziét” a dosszié-indító mutációt hívja', async () => {
    emptyRecords()
    let started = 0
    server.use(http.post(`${API_BASE}/api/character/bootstrap`, () => { started++; return new HttpResponse(null, { status: 204 }) }))
    renderPage()
    ;(await screen.findByRole('button', { name: 'Kezdjük el a dossziét' })).click()
    expect(await screen.findByText(/Még nincs elég történet/)).toBeInTheDocument()
    expect(started).toBe(1)
  })

  test('üres rekordkészlet, de már elindult dosszié → őszinte üres fal, bemutatkozás nélkül', async () => {
    emptyRecords()
    server.use(http.get(`${API_BASE}/api/character`, () => HttpResponse.json(MOCK_OVERVIEW)))
    renderPage()
    expect(await screen.findByText(/csend van a falon/i)).toBeInTheDocument()
    expect(document.querySelectorAll('article')).toHaveLength(0)
  })

  // csapatfal H2 (mezo-a9bo7.13): a csendes nap kimondva, kitalált töltelék nélkül (ADR 0049).
  test('csendes nap: a kiadás megszületett, de nem volt mit kitenni', async () => {
    emptyRecords()
    server.use(http.get(`${API_BASE}/api/character/edition`, () =>
      HttpResponse.json([{ day: localDateString(), status: 'QUIET', posts: [] }])))
    renderPage()
    expect(await screen.findByText('Ma csendes nap volt — holnap folytatjuk.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ma' }).querySelectorAll('article')).toHaveLength(0)
    expect(screen.queryByText(/csend van a falon/i)).not.toBeInTheDocument()
  })

  test('kikapcsolt társ (404) → őszinte „nem elérhető” jelzés, nem hiba', async () => {
    server.use(http.get(`${API_BASE}/api/companion/pattern`, () => new HttpResponse(null, { status: 404 })))
    renderPage()
    await waitFor(() => expect(screen.getByText(/most nem elérhető/i)).toBeInTheDocument())
  })
})
