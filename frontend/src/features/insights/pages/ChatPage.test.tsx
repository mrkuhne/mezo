import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { cannedReply } from '@/data/insights/chat'

const renderPage = () => render(<ChatPage />, { wrapper: QueryWrapper })

describe('ChatPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('seeds the conversation and the composer', () => {
    renderPage()
    expect(screen.getByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
    // assistant tool-transparency chip
    expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
    // V1.3: the mock seed never carries a degraded answer — no badge
    expect(screen.queryByText('nem ellenőrzött')).not.toBeInTheDocument()
  })

  test('sending a message appends it and then simulates a reply', async () => {
    // fireEvent (not userEvent) — userEvent deadlocks under fake timers here; see
    // ImportItemSheet.test.tsx for the documented environment issue.
    vi.useFakeTimers()
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit...')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByText(/A Reta D3-on ez gyakori/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('ChatPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('loads the history from the backend', async () => {
    renderPage()
    expect(await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
    expect(screen.getByText('Gemini · élő')).toBeInTheDocument()
  })

  test('sending a message streams the reply into the thread', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit...')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // waitFor + getByText (not findByText): the optimistic turn bubble is replaced by the
    // appended cache pair when the stream completes, so a captured node can go stale.
    await waitFor(() => expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument())
    // V0.5: the persisted reply renders its REAL tool chip + ref tag (from the done event)
    expect(screen.getByText('get_sleep(days=3)')).toBeInTheDocument()
    expect(screen.getByText(/\[Sleep\]/)).toBeInTheDocument()
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
            createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [], degraded: true,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    expect(screen.queryByText('nem ellenőrzött')).not.toBeInTheDocument()
    const input = screen.getByPlaceholderText('Mondj valamit...')
    fireEvent.change(input, { target: { value: 'Mennyit emeljek?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('bizonytalan válasz')).toBeInTheDocument())
    expect(screen.getByText('nem ellenőrzött')).toBeInTheDocument()
  })

  test('renders the honest degraded state when the companion switch is off', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'off' }], { status: 404 })))
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit...')).toBeDisabled()
  })
})
