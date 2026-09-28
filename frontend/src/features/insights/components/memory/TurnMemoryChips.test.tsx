import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { TurnMemoryChips } from '@/features/insights/components/memory/TurnMemoryChips'

const renderChips = (text: string, ordinal: number, forgottenRefs: ReadonlySet<string> = new Set(), id = `mock-turn-${ordinal}`) =>
  render(
    <QueryWrapper><MemoryRouter>
      <TurnMemoryChips conversationId="c-1" anchor={{ id, ordinal, text }}
        forgottenRefs={forgottenRefs} onForgotten={vi.fn()} />
    </MemoryRouter></QueryWrapper>,
  )

describe('TurnMemoryChips (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a learning turn: Megjegyeztem (Dóri) + Megjegyezném; Igen turns it into a kept fact', async () => {
    renderChips('Dórival nyertünk', 0)
    expect(await screen.findByText('Dóri')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Igen' }))
    expect(await screen.findByText('a Tudástár Rólad részében látod')).toBeInTheDocument()
  })

  test('an earlier item forgotten later renders the struck line', async () => {
    renderChips('Dórival nyertünk', 0, new Set(['mock-pf-dori']))
    expect(await screen.findByText(/Elfelejtve ·/)).toBeInTheDocument()
  })

  test('a forget turn: Elfelejtettem list → widen sheet → confirm hides the offer', async () => {
    renderChips('Az Annásat inkább ne jegyezd meg.', 2)
    expect(await screen.findByText('Elfelejtettem:')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Mindent ebből a beszélgetésből?' }))
    expect(await screen.findByText('Ezt a kettőt is elfelejtem')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Elfelejtem mind a kettőt' }))
    expect(await screen.findByText(/a strandröpi-párod, együtt nyertétek/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).not.toBeInTheDocument()
  })
})

describe('TurnMemoryChips (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  // Owner ruling 2026-09-28: the forget request forgets only the preceding message — when that
  // learned nothing, the turn still answers with the empty state and keeps the widen offer.
  test('a forget turn with nothing to forget shows the empty state and still offers the widen', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () =>
        HttpResponse.json({ learned: [], proposed: [], forgotten: [], forgetRequest: true })),
      http.get(`${API_BASE}/api/companion/conversation/:id/forget-learned`, () =>
        HttpResponse.json([{ kind: 'person_fact', refId: 'pf-1', personId: 'p-1', who: 'Dóri', text: 'szereti a teát',
          createdAt: '2026-09-26T20:05:00Z', pending: false }])),
    )
    renderChips('Ezt ne jegyezd meg.', 1, new Set(), 'u-2')
    expect(await screen.findByText(/Nem volt mit elfelejteni/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeInTheDocument()
    expect(screen.queryByText('még figyelek…')).not.toBeInTheDocument()
  })

  test('an ordinary turn with nothing learned yet shows the listening status, not the empty forget state', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () =>
      HttpResponse.json({ learned: [], proposed: [], forgotten: [], forgetRequest: false })))
    renderChips('Jó volt a mai edzés.', 0, new Set(), 'u-1')
    expect(await screen.findByText('még figyelek…')).toBeInTheDocument()
    expect(screen.queryByText(/Nem volt mit elfelejteni/)).not.toBeInTheDocument()
  })

  // Final review (mezo-d6ivw.12): the backend lists only LIVE items — a later poll must not
  // unmount a chip whose action the owner just took, or its confirmation vanishes.
  describe('confirmations survive the next poll', () => {
    const proposedWire = { id: 'lf-1', candidateText: 'Reggel edzel a legszívesebben', category: 'preference', userDecision: null,
      refinedText: null, promotedFactId: null, createdAt: '2026-09-26T20:05:00Z' }
    const flush = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    test('Ne → "nem is javaslom újra" stays after the next polls', async () => {
      let decided = false
      server.use(
        http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () =>
          HttpResponse.json({ learned: [], proposed: decided ? [] : [proposedWire], forgotten: [], forgetRequest: false })),
        http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, () => {
          decided = true
          return HttpResponse.json({ ...proposedWire, userDecision: 'reject' })
        }),
      )
      renderChips('Reggel szeretek edzeni.', 0, new Set(), 'u-1')
      await flush(0)
      fireEvent.click(screen.getByRole('button', { name: 'Ne' }))
      await flush(0)
      expect(screen.getByText('Rendben, nem jegyzem meg — és nem is javaslom újra.')).toBeInTheDocument()
      await flush(20_000)
      expect(screen.getByText('Rendben, nem jegyzem meg — és nem is javaslom újra.')).toBeInTheDocument()
    })

    test('Igen → the kept chip with its Visszavonom; Visszavonom → "Visszavonva" stays after the next polls', async () => {
      let state: 'ask' | 'kept' | 'gone' = 'ask'
      server.use(
        http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () =>
          HttpResponse.json({ learned: [], forgotten: [], forgetRequest: false, proposed: state === 'gone' ? []
            : [{ ...proposedWire, userDecision: state === 'kept' ? 'accept' : null, promotedFactId: state === 'kept' ? 'kf-1' : null }] })),
        http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, () => {
          state = 'kept'
          return HttpResponse.json({ ...proposedWire, userDecision: 'accept', promotedFactId: 'kf-1' })
        }),
        http.delete(`${API_BASE}/api/companion/fact/:id`, () => {
          state = 'gone'
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderChips('Reggel szeretek edzeni.', 0, new Set(), 'u-1')
      await flush(0)
      fireEvent.click(screen.getByRole('button', { name: 'Igen' }))
      await flush(0)
      expect(screen.getByText('a Tudástár Rólad részében látod')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
      await flush(0)
      expect(screen.getByText('Visszavonva — nem jegyeztem meg.')).toBeInTheDocument()
      await flush(20_000)
      expect(screen.getByText('Visszavonva — nem jegyeztem meg.')).toBeInTheDocument()
    })
  })
})
