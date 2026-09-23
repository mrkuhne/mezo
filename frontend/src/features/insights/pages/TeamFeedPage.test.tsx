import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { TeamFeedPage } from '@/features/insights/pages/TeamFeedPage'

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

  test('Miből látszik? minden poszton a meglévő mélyoldalra visz', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    const sources = screen.getAllByRole('link', { name: 'Miből látszik?' })
    expect(sources).toHaveLength(document.querySelectorAll('article').length)
    for (const a of sources) expect(a.getAttribute('href')).toMatch(/^\/mezo\//)
  })

  test('minden poszton ott az egységes hármas', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Üzenőfal' })
    for (const article of document.querySelectorAll('article')) {
      const scoped = within(article as HTMLElement)
      const decided = article.querySelector('.tf-after')
      if (!decided) expect(scoped.getByRole('button', { name: /Elmesélem|Beszéljük meg/ })).toBeInTheDocument()
    }
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

  test('üres rekordkészlet → őszinte üres fal, kitalált poszt nélkül', async () => {
    for (const path of ['/api/companion/pattern', '/api/companion/observation', '/api/proactive/prediction', '/api/proactive/experiment', '/api/character/feed'])
      server.use(http.get(`${API_BASE}${path}`, () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByText(/csend van a falon/i)).toBeInTheDocument()
    expect(document.querySelectorAll('article')).toHaveLength(0)
  })

  test('kikapcsolt társ (404) → őszinte „nem elérhető” jelzés, nem hiba', async () => {
    server.use(http.get(`${API_BASE}/api/companion/pattern`, () => new HttpResponse(null, { status: 404 })))
    renderPage()
    await waitFor(() => expect(screen.getByText(/most nem elérhető/i)).toBeInTheDocument())
  })
})
