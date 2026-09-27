import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { QueryWrapper } from '@/test/queryWrapper'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { people as personSeed } from '@/data/me/people'
import type { PersonResponse } from '@/data/me/peopleApi'
import type { PersonEntry } from '@/data/types'
import { byNameHu } from '@/features/insights/logic/hubSearch'
import { EMPTY, FOOT, PERSON_PAGE_LINK, TOAST, lead, personHead } from '@/features/insights/logic/hubCopy'
import { onToast } from '@/shared/lib/toastBus'

/** The mock seed as the wire would carry it — so the real-mode run sees the same people. */
const toWire = (p: PersonEntry) => ({
  id: p.id, name: p.name, initial: p.initial, relationship: p.relationship, relationshipHu: p.relationshipHu,
  aliases: p.aliases, status: p.status, sourceKind: p.sourceKind, affectBaseline: p.affect_baseline,
  contactCadenceLabel: p.contactCadenceLabel, notes: p.notes, knownFacts: p.knownFacts, ties: p.ties,
  affectTrend: p.affectTrend, affectTrendStart: p.affectTrendStart, direction: p.direction,
  directionReason: p.directionReason, mentionCount: p.mentionCount, mentionsThisWeek: p.mentionsThisWeek,
  lastMentionedAt: p.last_mentioned_at || null, graphEdges: p.graphEdges,
  facts: p.facts.map((f) => ({
    id: f.id, personId: f.personId, kind: f.kind, factText: f.text, confidence: f.confidence,
    sourceRefKind: f.sourceKind, sourceRefId: f.sourceRefId, includeInPrompt: f.includeInPrompt, seen: f.seen,
    createdAt: f.createdAt,
  })),
}) as unknown as PersonResponse

const serveSeed = (persons: PersonEntry[] = personSeed) =>
  server.use(http.get(`${API_BASE}/api/people`, () =>
    HttpResponse.json({ persons: persons.map(toWire), mentions: [], mezoNote: '' })))

function LocationProbe() {
  return <div data-testid="loc-probe">{useLocation().search}</div>
}

const renderPage = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <KnowledgeListPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

const withFacts = personSeed.filter((p) => p.facts.length > 0)
const petra = personSeed.find((p) => p.id === 'pp-petra')!
const rowNames = () => Array.from(document.querySelectorAll('.th-prow .t b')).map((b) => b.textContent)
const findRow = (factId: string) => waitFor(() => {
  const el = document.querySelector<HTMLElement>(`[data-row="p:${factId}"]`)
  if (!el) throw new Error('row not yet rendered')
  return el
})
const openStrip = async (user: ReturnType<typeof userEvent.setup>, factId: string) => {
  const row = await findRow(factId)
  await user.click(within(row).getByRole('button', { name: 'További műveletek' }))
  return row
}

// S6 (mezo-d6ivw.6) B10: the Emberek section runs in the mode the suite was started with — the
// final gate runs it twice (VITE_USE_MOCK unset AND =false), so both paths are covered.
describe(`EmberekSection (${isMockMode() ? 'mock' : 'real'} mode)`, () => {
  beforeEach(() => serveSeed())

  test('lists everyone with a fact alphabetically, with the lead and the foot', async () => {
    renderPage('/?view=emberek')
    await waitFor(() => expect(rowNames()).toEqual(withFacts.map((p) => p.name).sort(byNameHu)))
    const facts = withFacts.flatMap((p) => p.facts).length
    expect(screen.getByText(lead.people(withFacts.length, facts))).toBeInTheDocument()
    expect(screen.getByText(FOOT.people[0])).toBeInTheDocument()
    const row = screen.getByRole('button', { name: /Petra/ })
    expect(row).toHaveTextContent(`${petra.facts.length} tény`)
    expect(row.querySelector('.th-mono')).toHaveTextContent('P')
  })

  test('searching a fact text shows "N találat" on the person it belongs to', async () => {
    renderPage('/?view=emberek')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés név vagy tény szerint…' }), 'szuletesnap')
    expect(rowNames()).toEqual(['Petra'])
    expect(screen.getByRole('button', { name: /Petra/ })).toHaveTextContent('1 találat')
  })

  test('searching a name highlights it; no hits says so', async () => {
    renderPage('/?view=emberek')
    const box = await screen.findByRole('textbox', { name: 'Keresés név vagy tény szerint…' })
    await userEvent.type(box, 'benc')
    expect(screen.getByText('Benc', { selector: 'mark' })).toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'zzzz')
    expect(screen.getByText('Nincs találat erre: „zzzz”.')).toBeInTheDocument()
  })

  test('a person row opens ?person=<id>, with the fact search carried along', async () => {
    renderPage('/?view=emberek')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Keresés név vagy tény szerint…' }), 'szuletesnap')
    await userEvent.click(screen.getByRole('button', { name: /Petra/ }))
    expect(screen.getByTestId('loc-probe').textContent).toBe('?view=emberek&person=pp-petra')
    expect(screen.getByRole('textbox', { name: 'Keresés Petra tényei között…' })).toHaveValue('szuletesnap')
    expect(screen.getByText('Születésnap', { selector: 'mark' })).toBeInTheDocument()
  })

  test('the person view shows the head, the facts with their kind, and the way to the person page', async () => {
    renderPage('/?view=emberek&person=pp-petra')
    expect(await screen.findByText(personHead(petra.facts.length, 0))).toBeInTheDocument()
    expect(screen.getByText(petra.relationshipHu)).toBeInTheDocument()
    for (const f of petra.facts) expect(document.querySelector(`[data-row="p:${f.id}"]`)).toHaveTextContent(f.text)
    expect(document.querySelector('[data-row="p:pf-petra-2"]')).toHaveTextContent(/fontos dátum · éjszakai jegyzetből/)
    expect(screen.getByRole('link', { name: PERSON_PAGE_LINK })).toHaveAttribute('href', '/me/people/pp-petra')
  })

  test('Honnan tudom? tells where the person fact came from', async () => {
    renderPage('/?view=emberek&person=pp-petra')
    const row = await findRow('pf-petra-2')
    await userEvent.click(within(row).getByRole('button', { name: /Honnan tudom\?/ }))
    expect(within(row).getByText('Egy éjszakai jegyzetből szűrtem ki.')).toBeInTheDocument()
  })

  test('Javítom sends the new text as factText', async () => {
    let body: unknown = null
    server.use(http.patch(`${API_BASE}/api/people/:pid/facts/:fid`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({})
    }))
    const user = userEvent.setup()
    renderPage('/?view=emberek&person=pp-petra')
    const row = await openStrip(user, 'pf-petra-2')
    await user.click(within(row).getByRole('button', { name: /Javítom/ }))
    const box = within(row).getByRole('textbox', { name: 'A tény szövege' })
    await user.clear(box)
    await user.type(box, 'Születésnap: október 13.')
    await user.click(within(row).getByRole('button', { name: /Mentés/ }))
    if (isMockMode()) {
      await waitFor(() => expect(document.querySelector('[data-row="p:pf-petra-2"]')).toHaveTextContent('október 13.'))
    } else {
      await waitFor(() => expect(body).toEqual({ factText: 'Születésnap: október 13.' }))
    }
  })

  test('Elhallgattatom turns the fact off, toasts, and it moves under Elhallgattatott', async () => {
    let body: unknown = null
    server.use(http.patch(`${API_BASE}/api/people/:pid/facts/:fid`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({})
    }))
    const toasts: string[] = []
    const off = onToast((t) => { if ('text' in t) toasts.push(t.text) })
    const user = userEvent.setup()
    renderPage('/?view=emberek&person=pp-petra')
    const row = await openStrip(user, 'pf-petra-1')
    await user.click(within(row).getByRole('button', { name: /Elhallgattatom/ }))
    off()
    expect(toasts).toEqual([TOAST.muted])
    if (isMockMode()) {
      const fold = screen.getByRole('button', { name: /Elhallgattatott ·/ })
      expect(fold).toHaveAttribute('aria-expanded', 'true')
      expect(document.querySelector('[data-row="p:pf-petra-1"]')).toHaveClass('is-muted')
      expect(document.querySelector('[data-row="p:pf-petra-1"]')).toHaveTextContent('te hallgattattad el')
    } else {
      await waitFor(() => expect(body).toEqual({ includeInPrompt: false }))
    }
  })

  describe('Elfelejtem', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => { vi.useRealTimers() })

    test('hides the row at once and sends exactly one DELETE (the veto), only after 5 s', async () => {
      const deletes: string[] = []
      server.use(http.delete(`${API_BASE}/api/people/:pid/facts/:fid`, ({ params }) => {
        deletes.push(`${params.pid}/${params.fid}`)
        return new HttpResponse(null, { status: 204 })
      }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPage('/?view=emberek&person=pp-petra')
      const row = await openStrip(user, 'pf-petra-2')
      await user.click(within(row).getByRole('button', { name: /Elfelejtem/ }))
      expect(document.querySelector('[data-row="p:pf-petra-2"]')).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('Elfelejtettem: „Születésnap: október 12.”')
      await act(() => vi.advanceTimersByTimeAsync(4900))
      expect(deletes).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(200))
      if (!isMockMode()) await waitFor(() => expect(deletes).toEqual(['pp-petra/pf-petra-2']))
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      if (!isMockMode()) expect(deletes).toHaveLength(1)
      expect(screen.queryByRole('status')).toBeNull()
    })
  })

  test.skipIf(isMockMode())('nobody with a fact yet reads as the honest empty state', async () => {
    serveSeed(personSeed.map((p) => ({ ...p, facts: [] })))
    renderPage('/?view=emberek')
    expect(await screen.findByText(EMPTY.people)).toBeInTheDocument()
  })

  test.skipIf(isMockMode())('a failed load offers a retry, never an invented list', async () => {
    server.use(http.get(`${API_BASE}/api/people`, () => new HttpResponse(null, { status: 500 })))
    renderPage('/?view=emberek')
    expect(await screen.findByText('Most nem sikerült betölteni ezt a szakaszt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
  })
})
