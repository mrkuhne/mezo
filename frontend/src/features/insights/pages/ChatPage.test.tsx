import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { ChatMessage } from '@/features/insights/components/ChatMessage'
import { cannedReply } from '@/data/insights/chat'

// The page reads its selected conversation from `?c=` (mezo-at8x.3), so it needs a router.
const FEEDBACK_GROUP = 'Visszajelzés a válaszról'

const renderPage = (path = '/mezo/chat') =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <ChatPage />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('ChatPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('seeds the conversation and the composer', () => {
    renderPage()
    expect(screen.getByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit…')).toBeInTheDocument()
    // assistant tool-transparency chip — collapsed into the work strip (mezo-vdf4);
    // both seed answers carry tools, hence two strips.
    expect(screen.getAllByRole('button', { name: /Utánanézett/ })).toHaveLength(2)
    // V1.3: the mock seed never carries a degraded answer — no badge
    expect(screen.queryByText('nem ellenőrzött')).not.toBeInTheDocument()
  })

  test('the composer wraps instead of scrolling sideways (mezo-a837)', () => {
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit…')
    // A textarea az, ami tördel — egy <input> vízszintesen csúsztatná el a hosszú üzenetet.
    expect(input.tagName).toBe('TEXTAREA')
    expect(input).toHaveAttribute('rows', '1')
  })

  test('Shift+Enter breaks a line instead of sending (mezo-a837)', () => {
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Első sor' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    // nem ment el: a piszkozat a mezőben marad, a szálban nem jelenik meg buborékként
    expect(input).toHaveValue('Első sor')
    expect(screen.queryByText('Első sor', { ignore: 'textarea' })).not.toBeInTheDocument()
  })

  test('parks the view on the newest message on open (mezo-at8x.2)', async () => {
    // jsdom has no layout and no scrollIntoView — stubbing it is how we observe the intent.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderPage()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'end' })
  })

  test('sending a message appends it and then simulates a reply', async () => {
    // fireEvent (not userEvent) — userEvent deadlocks under fake timers here; see
    // ImportItemSheet.test.tsx for the documented environment issue.
    vi.useFakeTimers()
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByText(/A gyógyszer-ciklus D3-án ez gyakori/)).toBeInTheDocument()
    vi.useRealTimers()
  })

  test('renders feedback chips on the assistant answers only (mezo-b3pp.15)', async () => {
    renderPage()
    // The demo thread is assistant / user / assistant — two votable answers, one user bubble.
    expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2)
    const [up] = screen.getAllByRole('button', { name: /Segített/ })
    expect(up).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(up)
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'))
    // ...and only that one card's chip flips — each answer carries its own instance.
    expect(screen.getAllByRole('button', { name: /Segített/ })[1]).toHaveAttribute('aria-pressed', 'false')
  })

  // ── Design 2.0 face (mezo-d20.5.2) — the Mozaik chat chrome ─────────────────────────

  test('the refs footer speaks human labels, falling back to the raw id only when no label exists', () => {
    renderPage()
    // seed ref [Workout w-2026-05-21] → kind label Edzés + derived date
    // both seed answers carry a refs footer
    expect(screen.getAllByText('Amire épült · L3')).toHaveLength(2)
    const workoutRef = screen.getAllByText('Edzés').find((el) => el.classList.contains('mzc-refk'))
    expect(workoutRef).toBeTruthy()
    expect(workoutRef!.parentElement).toHaveTextContent('máj. 21.')
    // seed ref [Pattern p-medication-appetite] → kind label Minta, HONEST raw-id fallback
    const patternRef = screen.getAllByText('Minta').find((el) => el.classList.contains('mzc-refk'))
    expect(patternRef).toBeTruthy()
    expect(patternRef!.parentElement).toHaveTextContent('p-medication-appetite')
  })

  // mezo-b3pp.29: the Emlékek row below the footer already carries every recalled memory's
  // date, source and gist, so a bare [Memory] refs chip beside it is pure duplication — but
  // ONLY once that row actually exists. These render ChatMessage directly (not the full seeded
  // page) so the refs/recalled combination under test is exact and not incidental to the seed.
  test('hides the Memory chips when the answer carries a recalled list, but keeps the Emlékek row and the other chips', () => {
    render(
      <ChatMessage
        m={{
          id: 'm-dedupe-1',
          role: 'assistant',
          ts: '10:00',
          text: 'Válasz.',
          refs: [
            { kind: 'Memory', id: '2026-05-21' },
            { kind: 'Workout', id: 'w-2026-05-20' },
          ],
          recalled: [
            { occurredOn: '2026-05-21', kind: 'Journal', label: 'Napló', gist: 'jól aludtam', similarity: 0.9 },
          ],
        }}
      />,
    )
    // the non-Memory chip survives the filter
    expect(screen.getByText('Edzés')).toBeInTheDocument()
    // no chip shows the Memory kind label ('Emlék') — it was filtered out by the dedupe
    expect(
      screen.queryAllByText('Emlék').find((el) => el.classList.contains('mzc-refk')),
    ).toBeUndefined()
    // dedupe, not deletion: the recalled content is still reachable via the Emlékek row
    expect(screen.getByText(/Emlékek · 1/)).toBeInTheDocument()
  })

  test('keeps the Memory chips when the answer has no recalled list — the chip is the only provenance', () => {
    render(
      <ChatMessage
        m={{
          id: 'm-dedupe-2',
          role: 'assistant',
          ts: '10:00',
          text: 'Válasz.',
          refs: [
            { kind: 'Memory', id: '2026-05-21' },
            { kind: 'Workout', id: 'w-2026-05-20' },
          ],
          // no `recalled` — nothing else in this render carries the memory's provenance
        }}
      />,
    )
    const memoryRef = screen.getAllByText('Emlék').find((el) => el.classList.contains('mzc-refk'))
    expect(memoryRef).toBeTruthy()
    expect(screen.getByText('Edzés')).toBeInTheDocument()
  })

  // mezo-b3pp.29 fix wave: find_similar_past_days (MemoryTools) emits a Memory ref for a day that
  // ambient recall never touched, so it is never in `recalled` — even though `recalled` is
  // non-empty (ambient recall is always-on, so most turns have some recalled item). A kind-only
  // filter would hide this chip and the day it points to would appear nowhere in the UI.
  test('keeps a Memory chip whose day the Emlékek row does not carry', () => {
    render(
      <ChatMessage
        m={{
          id: 'm-dedupe-4',
          role: 'assistant',
          ts: '10:00',
          text: 'Válasz.',
          refs: [{ kind: 'Memory', id: '2026-02-11' }],
          recalled: [
            { occurredOn: '2026-05-21', kind: 'Journal', label: 'Napló', gist: 'jól aludtam', similarity: 0.9 },
          ],
        }}
      />,
    )
    const memoryRef = screen.getAllByText('Emlék').find((el) => el.classList.contains('mzc-refk'))
    expect(memoryRef).toBeTruthy()
    expect(memoryRef!.parentElement).toHaveTextContent('febr. 11.')
  })

  test('hides the whole refs footer when filtering leaves nothing (latent empty-array-is-truthy bug)', () => {
    render(
      <ChatMessage
        m={{
          id: 'm-dedupe-3',
          role: 'assistant',
          ts: '10:00',
          text: 'Válasz.',
          refs: [{ kind: 'Memory', id: '2026-05-21' }],
          recalled: [
            { occurredOn: '2026-05-21', kind: 'Journal', label: 'Napló', gist: 'jól aludtam', similarity: 0.9 },
          ],
        }}
      />,
    )
    // without the length guard, the eyebrow would render alone over an empty chip row
    expect(screen.queryByText('Hivatkozott · L3')).not.toBeInTheDocument()
  })

  test('every assistant answer carries the Mezo eyebrow + timestamp meta row with the orb', () => {
    const { container } = renderPage()
    // two assistant answers in the seed → two orb-led meta rows
    expect(container.querySelectorAll('.mzc-meta')).toHaveLength(2)
    expect(screen.getAllByText('Mezo', { selector: '.mzc-meta .mzc-eb' })).toHaveLength(2)
    expect(screen.getByText('06:32')).toBeInTheDocument()
  })

  test('the tool chips render ABOVE the answer bubble, not inside it', () => {
    const { container } = renderPage()
    const first = container.querySelector('.mzc-msg-a')!
    const toolrow = first.querySelector('.mzc-tools')
    const bubble = first.querySelector('.mzc-bub-a')
    expect(toolrow).toBeTruthy()
    expect(bubble).toBeTruthy()
    // DOM order: the tool row precedes the bubble and is a sibling, never a child of it
    expect(bubble!.contains(toolrow!)).toBe(false)
    expect(toolrow!.compareDocumentPosition(bubble!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('the user bubble sits in the washed Mozaik card with its timestamp below', () => {
    const { container } = renderPage()
    const user = container.querySelector('.mzc-msg-u')!
    expect(user.querySelector('.mzc-bub-u')).toHaveTextContent('Aludtam 7h-t.')
    expect(user.querySelector('time')).toHaveTextContent('06:34')
  })

  test('the composer is the Mozaik pill with mic and send controls intact', () => {
    const { container } = renderPage()
    const composer = container.querySelector('.chat-composer')!
    expect(composer.classList.contains('mzc-composer')).toBe(true)
    expect(screen.getByLabelText('Hangbevitel')).toBeInTheDocument()
    expect(screen.getByLabelText('Küldés')).toBeInTheDocument()
  })

  test('the first assistant message shows a collapsed Emlékek row that reveals the recalled gists', async () => {
    renderPage()
    const toggle = await screen.findByText(/Emlékek · 2/)
    // collapsed by default — the answer is the point, this is only its provenance
    expect(screen.queryByText('futás után jobban aludtam')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByText('futás után jobban aludtam')).toBeInTheDocument()
    expect(screen.getByText('napló')).toBeInTheDocument()
    expect(screen.getByText('92')).toBeInTheDocument()
  })

  test('renders the orb-led header with the live status', async () => {
    renderPage()
    expect(await screen.findByLabelText('Vissza')).toBeInTheDocument()
    expect(screen.getByText('Mezo', { selector: '.mzc-hnm' })).toBeInTheDocument()
    // mock mode → demo status text (subtitle precedence unchanged)
    expect(screen.getByText('demo beszélgetés')).toBeInTheDocument()
    expect(document.querySelector('.mzc-hstat')).toHaveAttribute('data-st', 'demo')
  })
})

describe('ChatPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('loads the history from the backend', async () => {
    renderPage()
    expect(await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Utánanézett/ })).toHaveLength(2)
    expect(screen.getByText('élő · Gemini')).toBeInTheDocument()
  })

  test('batch-reads retrieval feedback once for the whole rendered thread', async () => {
    const runId = '11111111-1111-4111-8111-111111111111'
    const resultA = '22222222-2222-4222-8222-222222222222'
    const resultB = '33333333-3333-4333-8333-333333333333'
    const searches: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/conversation/:id/messages`, () => HttpResponse.json([
        {
          id: 'm-a', role: 'assistant', content: 'Első válasz', createdAt: '2026-09-05T08:00:00Z',
          tools: [], refs: [], degraded: false,
          recalled: [{
            occurredOn: '2026-09-01', kind: 'journal_entry', label: 'napló', gist: 'Első emlék',
            similarity: 0.8, retrievalRunId: runId, retrievalResultId: resultA,
            memoryItemId: '44444444-4444-4444-8444-444444444444', indicator: 'régi',
          }],
        },
        {
          id: 'm-b', role: 'assistant', content: 'Második válasz', createdAt: '2026-09-05T08:01:00Z',
          tools: [], refs: [], degraded: false,
          recalled: [{
            occurredOn: '2026-09-02', kind: 'daily_summary', label: 'összefoglaló', gist: 'Második emlék',
            similarity: 0.7, retrievalRunId: runId, retrievalResultId: resultB,
            memoryItemId: '55555555-5555-4555-8555-555555555555', indicator: 'összegzés',
          }],
        },
      ])),
      http.get(`${API_BASE}/api/companion/memory/retrieval-feedback`, ({ request }) => {
        searches.push(new URL(request.url).search)
        return HttpResponse.json([])
      }),
    )

    renderPage('/mezo/chat?c=c-1')
    await screen.findByText('Második válasz')
    await waitFor(() => expect(searches).toEqual([`?resultIds=${resultA},${resultB}`]))
  })

  test('sending a message streams the reply into the thread', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // waitFor + getByText (not findByText): the optimistic turn bubble is replaced by the
    // appended cache pair when the stream completes, so a captured node can go stale.
    await waitFor(() => expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
    // V0.5: the persisted reply renders its REAL tool work strip + ref chip (from the done
    // event) — the ref speaks the human label (Alvás + derived date), not the raw wire
    // kind/id (d20.5.2); the tool call itself is collapsed into the strip (mezo-vdf4).
    // three strips: the two seed answers plus this new one.
    expect(screen.getAllByRole('button', { name: /Utánanézett/ })).toHaveLength(3)
    const sleepRef = screen
      .getAllByText('Alvás')
      .find((el) => el.classList.contains('mzc-refk') && el.parentElement?.textContent?.includes('júl. 2.'))
    expect(sleepRef).toBeTruthy()
  })

  test('the streamed answer carries its own Emlékek disclosure (mezo-b3pp.28)', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    // the persisted history's first answer already discloses what it recalled
    expect(screen.getByText(/Emlékek · 2/)).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())

    const toggle = screen.getByText(/Emlékek · 1/)
    expect(screen.queryByText('korábban is rosszul aludtál edzés után')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByText('korábban is rosszul aludtál edzés után')).toBeInTheDocument()
  })

  test('renders the live tool chip while the turn is still streaming (mezo-280)', async () => {
    // the stream is gated after the 'tool' frame — the module handler's frames all land
    // within the same microtask flush (too fast for any assertion to catch mid-stream),
    // so this holds 'delta'/'done' back until the in-flight-chip assertions have run.
    let releaseRest: () => void = () => {}
    const rest = new Promise<void>((resolve) => { releaseRest = resolve })
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
      const { content } = (await request.json()) as { content: string }
      const reply = cannedReply(content)
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode(frame('tool', { type: 'read', name: 'get_recovery(days=3)' })))
          await rest
          controller.enqueue(encoder.encode(frame('delta', { text: reply })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-done', role: 'assistant', content: reply,
            createdAt: '2026-07-03T07:00:05Z',
            tools: [{ type: 'read', name: 'get_recovery(days=3)' }],
            refs: [{ kind: 'Sleep', id: '2026-07-02' }],
            recalled: [],
            degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // the strip renders from the live work-strip block (mezo-vdf4), before 'done' replaces it —
    // three strips: the two seed answers plus this in-flight one.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Utánanéz/ })).toHaveLength(3))
    // the live strip carries the "…" label (only ever true while `live`) — seeing it confirms
    // the chip came from the in-flight turn, not one of the persisted, authoritative rows.
    expect(screen.getByRole('button', { name: /Utánanéz…/ })).toBeInTheDocument()

    releaseRest()
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
  })

  test('busy turn flips the status to dolgozom rajta…', async () => {
    // same gated-stream idiom as the live-tool-chip test above: hold 'delta'/'done' back so
    // the in-flight turn (still truthy, no draft yet) is actually observable on screen.
    let releaseRest: () => void = () => {}
    const rest = new Promise<void>((resolve) => { releaseRest = resolve })
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
      const { content } = (await request.json()) as { content: string }
      const reply = cannedReply(content)
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await rest
          controller.enqueue(encoder.encode(frame('delta', { text: reply })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-done', role: 'assistant', content: reply,
            createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [], recalled: [], degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('dolgozom rajta…')).toBeInTheDocument())
    expect(document.querySelector('.mzc-hstat')).toHaveAttribute('data-st', 'busy')

    releaseRest()
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
  })

  test('keeps the thinking dots next to the live tool chip until the first delta arrives (mezo-280 Finding 3)', async () => {
    // same gated-stream idiom as the chip test above: hold 'delta'/'done' back so the
    // tool-arrived-but-no-draft-yet gap (the empty-grey-card bug) is actually observable.
    let releaseRest: () => void = () => {}
    const rest = new Promise<void>((resolve) => { releaseRest = resolve })
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
      const { content } = (await request.json()) as { content: string }
      const reply = cannedReply(content)
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode(frame('tool', { type: 'read', name: 'get_recovery(days=3)' })))
          await rest
          controller.enqueue(encoder.encode(frame('delta', { text: reply })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-done', role: 'assistant', content: reply,
            createdAt: '2026-07-03T07:00:05Z',
            tools: [{ type: 'read', name: 'get_recovery(days=3)' }],
            refs: [{ kind: 'Sleep', id: '2026-07-02' }],
            recalled: [],
            degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    const { container } = renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // the tool strip is up, but no delta has landed yet — this is exactly the gap that used to
    // render an empty grey answer card with no visible sign that anything is still happening.
    // three strips: the two seed answers plus this in-flight one.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Utánanéz/ })).toHaveLength(3))
    expect(container.querySelectorAll('.np-pulse')).toHaveLength(3)

    releaseRest()
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
    // once the real answer has landed, the dots are gone — no lingering placeholder.
    expect(container.querySelectorAll('.np-pulse')).toHaveLength(0)
  })

  test('renders the V1.3 badge when the done event flags the answer degraded', async () => {
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, () => {
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(frame('delta', { text: 'bizonytalan válasz' })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-degraded', role: 'assistant', content: 'bizonytalan válasz',
            createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [], recalled: [], degraded: true,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    expect(screen.queryByText('nem ellenőrzött')).not.toBeInTheDocument()
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Mennyit emeljek?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('bizonytalan válasz')).toBeInTheDocument())
    expect(screen.getByText('nem ellenőrzött')).toBeInTheDocument()
  })

  test('renders the answer markdown as blocks, not raw ** marks (mezo-at8x.1)', async () => {
    const answer = '**Összegzés**\n\n- alvás 7h 12p\n- súly -0.4 kg\n\nEz a trend jó.'
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, () => {
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(frame('delta', { text: answer })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-md', role: 'assistant', content: answer,
            createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [], recalled: [], degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    const { container } = renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Hogy állok?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Összegzés')).toBeInTheDocument())
    expect(container.querySelectorAll('.md-prose ul li')).toHaveLength(2)
    expect(container.textContent).not.toContain('**')
  })

  test('opens an empty draft thread on "Új beszélgetés" (mezo-at8x.3)', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    fireEvent.click(screen.getByLabelText('Új beszélgetés'))
    expect(await screen.findByText(/Új beszélgetés — kérdezz bármit/)).toBeInTheDocument()
    expect(screen.queryByText(/Jó reggelt\. Tegnap a Push Day/)).not.toBeInTheDocument()
  })

  test('the empty draft thread offers the quick-question chips, and a tap SENDS (mezo-dz3y)', async () => {
    renderPage('/mezo/chat?c=new')
    await screen.findByText(/Új beszélgetés — kérdezz bármit/)
    // the three seeded quick questions render as tappable chips
    const chip = screen.getByRole('button', { name: 'Foglald össze a mai napom röviden' })
    expect(screen.getByRole('button', { name: 'Alvás és súly alapján mire figyeljek ma?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hogy készüljek az esti edzésre?' })).toBeInTheDocument()

    fireEvent.click(chip)
    // one tap = the question is SENT, not prefilled
    await waitFor(() =>
      expect(screen.getByText(cannedReply('Foglald össze a mai napom röviden'))).toBeInTheDocument(),
    )
    // and the chips leave with the empty state
    expect(screen.queryByRole('button', { name: 'Hogy készüljek az esti edzésre?' })).not.toBeInTheDocument()
  })

  test('a draft thread creates its conversation on the first send (mezo-at8x.3)', async () => {
    const created: string[] = []
    server.use(http.post(`${API_BASE}/api/companion/conversation`, () => {
      created.push('c-new')
      return HttpResponse.json(
        { id: 'c-new', title: null, startedAt: '2026-07-03T07:00:00Z', lastMessageAt: null },
        { status: 201 },
      )
    }))
    renderPage('/mezo/chat?c=new')
    const input = await screen.findByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(created).toHaveLength(1))
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
  })

  test('the picker lists the persisted conversations (mezo-at8x.3)', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    fireEvent.click(screen.getByLabelText('Beszélgetések'))
    expect(await screen.findByText('Aludtam 7h-t…')).toBeInTheDocument()
  })

  test('chips ride the persisted answers, never the in-flight draft (mezo-b3pp.15)', async () => {
    // Same gated-stream idiom as the live-tool-chip test above: hold 'delta'/'done' back so the
    // streaming turn is actually observable on screen.
    let releaseRest: () => void = () => {}
    const rest = new Promise<void>((resolve) => { releaseRest = resolve })
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
      const { content } = (await request.json()) as { content: string }
      const reply = cannedReply(content)
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode(frame('delta', { text: reply })))
          await rest
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-done', role: 'assistant', content: reply,
            createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [], recalled: [], degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    // The MSW history is assistant / user / assistant — two votable answers.
    await waitFor(() => expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2))

    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // The draft answer is on screen but not yet persisted — there is nothing to vote on.
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
    expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2)

    releaseRest()
    // Once 'done' lands the persisted row carries an id — and gains its own chips.
    await waitFor(() => expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(3))
  })

  test('a 👎 + reason on one answer writes only that answer (mezo-b3pp.15)', async () => {
    const puts: unknown[] = []
    server.use(http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
      const body = await request.json()
      puts.push(body)
      return HttpResponse.json({ ...(body as object), updatedAt: '2026-08-21T12:00:00Z' })
    }))
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    await waitFor(() => expect(screen.getAllByRole('group', { name: FEEDBACK_GROUP })).toHaveLength(2))

    // The reason row is per-card state: opening it on the FIRST answer must not open it on the second.
    await userEvent.click(screen.getAllByRole('button', { name: /Nem talált/ })[0])
    expect(screen.getAllByRole('button', { name: 'pontatlan' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'pontatlan' }))

    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toMatchObject({
      artifactKind: 'chat_message', artifactId: 'msg-0', verdict: 'down', reason: 'inaccurate',
    })
  })

  test('renders the honest degraded state when the companion switch is off', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'off' }], { status: 404 })))
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit…')).toBeDisabled()
  })
})

// ==== F7.5 (mezo-d20.8.5): beszélgetés-műveletek + hiba-buborék retry ====

describe('ChatPage conversation actions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('the ⋯ disc opens the actions sheet for the current conversation', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)

    fireEvent.click(screen.getByRole('button', { name: 'A beszélgetés műveletei' }))
    expect(await screen.findByRole('button', { name: /Átnevezés/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Törlés/ })).toBeInTheDocument()
  })

  test('the picker rows carry a kebab that opens the actions sheet', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)

    fireEvent.click(screen.getByRole('button', { name: 'Beszélgetések' }))
    const kebabs = await screen.findAllByRole('button', { name: /^Műveletek:/ })
    expect(kebabs.length).toBeGreaterThan(0)
    fireEvent.click(kebabs[0])
    expect(await screen.findByRole('button', { name: /Átnevezés/ })).toBeInTheDocument()
  })

  test('a draft thread disables the ⋯ disc — no persisted row to act on', async () => {
    renderPage('/mezo/chat?c=new')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'A beszélgetés műveletei' })).toBeDisabled())
  })
})

describe('ChatPage error bubble retry (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const failStream = () =>
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(
            `event:error\ndata:${JSON.stringify({ code: 'COMPANION_UPSTREAM' })}\n\n`))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

  test('a failed send renders the amber bubble with Újra + Szerkesztés', async () => {
    failStream()
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByText('Nem sikerült válaszolni — próbáld újra.')
    expect(screen.getByText('Az üzeneted nem veszett el.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Szerkesztés' })).toBeInTheDocument()
  })

  test('Szerkesztés hands the failed text back to the composer and clears the bubble', async () => {
    failStream()
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Elgépeelt üzenet' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByRole('button', { name: 'Szerkesztés' })

    fireEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.getByPlaceholderText('Mondj valamit…')).toHaveValue('Elgépeelt üzenet')
    expect(screen.queryByRole('button', { name: 'Újra' })).not.toBeInTheDocument()
  })

  test('Újra re-sends the same turn and a now-healthy stream completes it', async () => {
    failStream()
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByRole('button', { name: 'Újra' })

    server.resetHandlers() // back to the healthy module handlers
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))

    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Újra' })).not.toBeInTheDocument()
    // replace, don't append: exactly one user bubble with the retried text
    expect(screen.getAllByText('Fáradt vagyok')).toHaveLength(1)
  })
})
