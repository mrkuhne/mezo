import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { RememberedChips } from '@/features/insights/components/RememberedChips'

/** S3 (mezo-d6ivw.3): a „Megjegyeztem" chip — beúszás, visszavonás, érzékeny-címke, apró jel. */
describe('RememberedChips (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the chip with undo for the demo fact, and removes it on undo', async () => {
    render(<RememberedChips userMessageId="msg-1" />, { wrapper: makeHookWrapper() })
    expect(screen.getByText('Megjegyeztem:')).toBeInTheDocument()
    expect(screen.getByText(/Petra nem szereti a meglepetés/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    await waitFor(() => {
      expect(screen.queryByText('Megjegyeztem:')).not.toBeInTheDocument()
    })
  })

  it('renders nothing without a userMessageId', () => {
    const { container } = render(<RememberedChips userMessageId={null} />, { wrapper: makeHookWrapper() })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RememberedChips (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const wireFact = (over: Record<string, unknown> = {}) => ({
    id: 'pf-1', personId: 'p-1', kind: 'preference', factText: 'Szereti a teát',
    confidence: 'high', sourceRefKind: 'chat_turn', active: true, includeInPrompt: true,
    seen: false, createdAt: '2026-07-03T20:20:00Z', ...over,
  })

  it('shows the minimal pending indicator while the capture window is open, then the chip', async () => {
    let call = 0
    server.use(http.get(`${API_BASE}/api/people/facts`, () => {
      call++
      return HttpResponse.json(call === 1 ? [] : [wireFact()])
    }))
    render(<RememberedChips userMessageId="msg-2" />, { wrapper: makeHookWrapper() })
    await waitFor(() => expect(screen.getByRole('status')).toHaveAccessibleName('Mezo még figyel'))
    await waitFor(() => expect(screen.getByText(/Szereti a teát/)).toBeInTheDocument(),
      { timeout: 6000 })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  }, 10_000)

  it('marks a sensitivity fact with the discreet tag', async () => {
    server.use(http.get(`${API_BASE}/api/people/facts`, () =>
      HttpResponse.json([wireFact({ id: 'pf-2', kind: 'sensitivity', factText: 'Gyász a családban' })])))
    render(<RememberedChips userMessageId="msg-3" />, { wrapper: makeHookWrapper() })
    await waitFor(() => expect(screen.getByText(/Gyász a családban/)).toBeInTheDocument())
    expect(screen.getByText('érzékeny')).toBeInTheDocument()
  })
})
