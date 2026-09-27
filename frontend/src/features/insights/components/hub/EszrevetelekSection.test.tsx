import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { MOCK_OBSERVATIONS } from '@/data/insights/knowledgeHub'
import { OBS_TOPICS, groupBy, topicOf } from '@/features/insights/logic/hubTopics'
import { obsState } from '@/features/insights/logic/hubCounts'
import { DEGRADED, EMPTY, FOOT, TOAST, lead, tileSub } from '@/features/insights/logic/hubCopy'
import { onToast } from '@/shared/lib/toastBus'

const renderPage = (path = '/?view=eszrevetelek') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const byId = (id: string) => MOCK_OBSERVATIONS.find((o) => o.patternId === id)!
const foldOf = (id: string) => screen.getByRole('button', { name: new RegExp(`^${topicOf(byId(id))} ·`) })
const rowOf = (id: string) => document.querySelector(`.th-row[data-row="o:${id}"]`) as HTMLElement | null
const openFold = async (id: string) => {
  await screen.findByRole('button', { name: /^Mind/ })
  const fold = foldOf(id)
  if (fold.getAttribute('aria-expanded') !== 'true') await userEvent.click(fold)
}

// S6 (mezo-d6ivw.6) B11: the Észrevételek section runs in the mode the suite was started with —
// the final gate runs it twice (VITE_USE_MOCK unset AND =false), so both paths are covered.
describe(`EszrevetelekSection (${isMockMode() ? 'mock' : 'real'} mode)`, () => {
  test('lead, a collapsed fold per seeded topic, and the footer', async () => {
    renderPage()
    expect(await screen.findByText(lead.observations)).toBeInTheDocument()
    const topics = groupBy(MOCK_OBSERVATIONS, topicOf, OBS_TOPICS).map((g) => g.key)
    expect(topics.length).toBeGreaterThan(1)
    for (const t of topics) {
      expect(screen.getByRole('button', { name: new RegExp(`^${t} ·`) })).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.getByText(FOOT.observations[0])).toBeInTheDocument()
  })

  test('the state chips count like the hub tile (obsState) — Mind is every live observation', async () => {
    renderPage()
    const n = (s: string) => MOCK_OBSERVATIONS.filter((o) => obsState(o) === s).length
    expect(await screen.findByRole('button', { name: `Mind ${MOCK_OBSERVATIONS.length}` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: `Még igaz ${n('igaz')}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Felülírva 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Elhallgattatva ${n('elh')}` })).toBeInTheDocument()
    // the same numbers the hub tile shows
    expect(tileSub.observations(n('igaz'), 1, n('elh'))).toBe('3 még igaz · 1 felülírva · 1 elhallgattatva')
  })

  test('Felülírva lists the older half flat with the superseded status line', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Felülírva 1' }))
    expect(screen.getByRole('button', { name: 'Felülírva 1' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(foldOf('o3old'))
    const row = rowOf('o3old')!
    expect(row).not.toBeNull()
    expect(within(row).getByText(/felülírta egy újabb észrevétel/)).toBeInTheDocument()
    expect(rowOf('o1')).toBeNull()
  })

  test('in Mind the drift pair is ONE row: the older half sits inside the newer one', async () => {
    renderPage()
    await openFold('o3')
    const row = rowOf('o3')!
    expect(within(row).getByText(/ez váltotta a régit/)).toBeInTheDocument()
    const drift = row.querySelector('.th-drift[data-row="o:o3old"]') as HTMLElement
    expect(drift).not.toBeNull()
    expect(within(drift).getByText(/^KORÁBBAN · MEGERŐSÍTVE /)).toBeInTheDocument()
    expect(within(drift).getByText(byId('o3old').title)).toBeInTheDocument()
    expect(within(drift).getByText(/felülírta egy újabb észrevétel/)).toBeInTheDocument()
    expect(rowOf('o3old')).toBeNull()
  })

  test('a row never rechecked says so; a rechecked one says when', async () => {
    renderPage()
    await openFold('o2')
    expect(within(rowOf('o2')!).getByText(/még nem ellenőriztem újra/)).toBeInTheDocument()
    await openFold('o1')
    expect(within(rowOf('o1')!).getByText(/legutóbb ellenőrizve .* · még igaz/)).toBeInTheDocument()
  })

  test('Honnan tudom? shows the observation origin and its evidence; Javítom never appears', async () => {
    renderPage()
    await openFold('o1')
    const row = rowOf('o1')!
    await userEvent.click(within(row).getByRole('button', { name: /Honnan tudom\?/ }))
    expect(within(row).getByText('HONNAN TUDOM')).toBeInTheDocument()
    expect(within(row).getByText(/A napjaidból számoltam ki/)).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'További műveletek' }))
    expect(within(row).getByRole('button', { name: /Elhallgattatom/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Javítom/ })).toBeNull()
  })

  test('Elhallgattatom mutes the observation\'s FACT', async () => {
    let url = ''
    let body: unknown = null
    server.use(http.patch(`${API_BASE}/api/companion/fact/:id`, async ({ request }) => {
      url = new URL(request.url).pathname
      body = await request.json()
      return HttpResponse.json({})
    }))
    const toasts: string[] = []
    const off = onToast((t) => { if ('text' in t) toasts.push(t.text) })
    renderPage()
    await openFold('o1')
    const row = rowOf('o1')!
    await userEvent.click(within(row).getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(within(row).getByRole('button', { name: /Elhallgattatom/ }))
    off()
    expect(toasts).toEqual([TOAST.muted])
    if (isMockMode()) {
      expect(rowOf('o1')).toHaveClass('is-muted')
      expect(within(rowOf('o1')!).getByText(/elhallgattatva · te hallgattattad el/)).toBeInTheDocument()
    } else {
      await waitFor(() => expect(body).toMatchObject({ includeInPrompt: false }))
      expect(url).toBe(`/api/companion/fact/${byId('o1').factId}`)
    }
  })

  test('an observation with no fact offers no Elhallgattatom', async () => {
    renderPage()
    await openFold('o2')
    const row = rowOf('o2')!
    await userEvent.click(within(row).getByRole('button', { name: 'További műveletek' }))
    expect(within(row).queryByRole('button', { name: /Elhallgattatom/ })).toBeNull()
    expect(within(row).getByRole('button', { name: /Elfelejtem/ })).toBeInTheDocument()
  })

  describe('Elfelejtem', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => { vi.useRealTimers() })

    test('hides the row at once, says it is never shown again, and DELETEs only after 5 s', async () => {
      const deletes: string[] = []
      server.use(http.delete(`${API_BASE}/api/companion/observation/:id`, ({ params }) => {
        deletes.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()
      await screen.findByRole('button', { name: /^Mind/ })
      await user.click(foldOf('o1'))
      const row = rowOf('o1')!
      await user.click(within(row).getByRole('button', { name: 'További műveletek' }))
      await user.click(within(row).getByRole('button', { name: /Elfelejtem/ }))
      expect(rowOf('o1')).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent(`Elfelejtettem: „${byId('o1').title}”`)
      expect(screen.getByRole('status')).toHaveTextContent('többé nem mutatom és nem használom')
      await act(() => vi.advanceTimersByTimeAsync(4900))
      expect(deletes).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(200))
      if (!isMockMode()) await waitFor(() => expect(deletes).toEqual(['o1']))
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      if (!isMockMode()) expect(deletes).toEqual(['o1'])
    })

    test('forgetting the older half from inside the drift block leaves the newer row alone', async () => {
      const deletes: string[] = []
      server.use(http.delete(`${API_BASE}/api/companion/observation/:id`, ({ params }) => {
        deletes.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage()
      await screen.findByRole('button', { name: /^Mind/ })
      await user.click(foldOf('o3'))
      const drift = rowOf('o3')!.querySelector('.th-drift') as HTMLElement
      await user.click(within(drift).getByRole('button', { name: 'További műveletek' }))
      await user.click(within(drift).getByRole('button', { name: /Elfelejtem/ }))
      expect(rowOf('o3')).not.toBeNull()
      expect(rowOf('o3')!.querySelector('.th-drift')).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(5100))
      if (!isMockMode()) await waitFor(() => expect(deletes).toEqual(['o3old']))
    })
  })

  test('the &obs= deep link opens its topic and highlights the observation', async () => {
    renderPage('/?view=eszrevetelek&obs=o1')
    await screen.findByRole('button', { name: /^Mind/ })
    expect(foldOf('o1')).toHaveAttribute('aria-expanded', 'true')
    expect(rowOf('o1')).toHaveClass('tud9-hl')
    expect(screen.getByRole('button', { name: /^Mind/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the "észrevételből" tag on a Rólad fact lands on its observation', async () => {
    renderPage('/?view=tenyek')
    await userEvent.click(await screen.findByRole('button', { name: /Étkezés ·/ }))
    await userEvent.click(screen.getByRole('button', { name: /észrevételből/ }))
    await screen.findByRole('button', { name: /^Mind/ })
    expect(rowOf('o1')).toHaveClass('tud9-hl')
  })

  test('a search opens the folds with hits, and matches the older half of a pair too', async () => {
    renderPage()
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés az észrevételek között…' }), 'lemerülsz')
    expect(foldOf('o3')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('lemerülsz', { selector: 'mark' })).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Keresés az észrevételek között…' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Keresés az észrevételek között…' }), 'zzzz')
    expect(screen.getByText('Nincs találat erre: „zzzz”.')).toBeInTheDocument()
  })

  if (!isMockMode()) {
    test('real mode: the switch off → the section says it is not available', async () => {
      server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => new HttpResponse(null, { status: 404 })))
      renderPage()
      expect(await screen.findByText(DEGRADED.section)).toBeInTheDocument()
    })

    test('real mode: nothing confirmed yet → the empty line', async () => {
      server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => HttpResponse.json([])))
      renderPage()
      expect(await screen.findByText(EMPTY.observations)).toBeInTheDocument()
    })

    test('real mode: a state with nothing in it says so', async () => {
      server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => HttpResponse.json([
        { patternId: 'x1', title: 'Egyetlen észrevétel.', confirmedAt: '2026-09-01T08:00:00Z', status: 'confirmed', evidence: [] },
      ])))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Felülírva 0' }))
      expect(screen.getByText(EMPTY.obsState)).toBeInTheDocument()
    })

    test('real mode: a failed load offers a retry', async () => {
      server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => new HttpResponse(null, { status: 500 })))
      renderPage()
      expect(await screen.findByText(DEGRADED.error)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    })
  }
})
