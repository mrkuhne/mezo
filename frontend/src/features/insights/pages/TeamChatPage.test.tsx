import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { buildTeamChatDay } from '@/data/character/teamChatMock'
import { localDateString } from '@/shared/lib/dates'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { useTeamChatActions } from '@/data/hooks'
import { TEAM_CHAT_LAST_SEEN_KEY } from '@/features/insights/logic/teamChat'
import { TeamChatPage } from './TeamChatPage'

const actual = vi.hoisted(() => ({ useTeamChatActions: null as unknown as typeof import('@/data/hooks').useTeamChatActions }))
vi.mock('@/data/hooks', async importOriginal => {
  const mod = await importOriginal<typeof import('@/data/hooks')>()
  actual.useTeamChatActions = mod.useTeamChatActions
  return { ...mod, useTeamChatActions: vi.fn() }
})

const apply = vi.fn()
const reply = vi.fn()

const renderChat = (url = '/mezo/elo') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/mezo/elo" element={<TeamChatPage />} />
        <Route path="/mezo/coaching/megfigyelo" element={<p>megfigyelő</p>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('TeamChatPage (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    apply.mockReset()
    reply.mockReset()
    apply.mockResolvedValue(undefined)
    reply.mockResolvedValue(undefined)
    vi.mocked(useTeamChatActions).mockReturnValue({ apply, reply, pending: false })
    localStorage.removeItem(TEAM_CHAT_LAST_SEEN_KEY)
  })
  afterEach(() => vi.unstubAllEnvs())

  test('a mintanap: fej, napszakok, sorok — és pontosan EGY üveg, a „Rád vár” sáv', async () => {
    renderChat()
    expect(await screen.findByText('A csapat beszél')).toBeInTheDocument()
    expect(screen.getByText('Reggel')).toBeInTheDocument()
    expect(screen.getByText('Délben')).toBeInTheDocument()
    expect(screen.getByText('Délután')).toBeInTheDocument()
    expect(screen.getByText('Rizses csirkét ettem, dupla adag rizzsel.')).toBeInTheDocument()
    const glass = document.querySelectorAll('.glass')
    expect(glass).toHaveLength(1)
    expect(glass[0].textContent).toMatch(/Rád vár/)
    expect(glass[0].textContent).toMatch(/Alvásadósság/)
  })

  test('a chipek és a rendeződött ügy címkéje', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    expect(screen.getByText('2 nyitott ügy')).toBeInTheDocument()
    expect(screen.getByText('1 rendeződött')).toBeInTheDocument()
    expect(screen.getByText('értesítés ma: 2 / 2')).toBeInTheDocument()
    expect(screen.getByText('Rendeződött · 13:05')).toBeInTheDocument()
    expect(screen.getByText('Alvásadósság · nyitott')).toBeInTheDocument()
    expect(screen.getByText('értesítettünk · 07:40')).toBeInTheDocument()
  })

  test('egy ajánlott lépésre koppintva az apply-t hívja az ügy azonosítójával', async () => {
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: /Horgony −30 perc/ }))
    expect(apply).toHaveBeenCalledWith('tc-thread-sleep-debt', 'shift_sleep_anchor')
    expect(await screen.findByText('Beállítva: Horgony −30 perc')).toBeInTheDocument()
  })

  test('nyitott ügynél a chip figyelmeztető színű', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    expect(screen.getByText('2 nyitott ügy')).toHaveClass('is-warn')
  })

  test('„Miből látszik?” a sor tényeit és a Gépterem-linket mutatja', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    await userEvent.click(screen.getAllByRole('button', { name: 'Miből látszik?' })[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('3 éjszaka alatt 2 óra 10 perc hiány')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /A motor naplója a Gépteremben/ })).toHaveAttribute('href', '/mezo/coaching/megfigyelo')
  })

  test('Elmesélem → lap → a válasz az ügyhöz kerül', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    await userEvent.click(screen.getAllByRole('button', { name: /Elmesélem/ })[0])
    await userEvent.type(await screen.findByLabelText('A válaszod'), 'Későn értem haza.')
    await userEvent.click(screen.getByRole('button', { name: /Válasz küldése/ }))
    expect(reply).toHaveBeenCalledWith('tc-thread-sleep-debt', 'Későn értem haza.')
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('másik ügy válasz-lapja nem örökli a félig írt szöveget', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    const tells = screen.getAllByRole('button', { name: /Elmesélem/ })
    await userEvent.click(tells[0])
    await userEvent.type(await screen.findByLabelText('A válaszod'), 'félig')
    await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
    await userEvent.click(tells[1])
    expect(await screen.findByLabelText('A válaszod')).toHaveValue('')
  })

  test('megnyitáskor elmenti, mikor láttad utoljára', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    expect(localStorage.getItem(TEAM_CHAT_LAST_SEEN_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// Honesty (fix round 1): a failed save must never look like a success.
describe('TeamChatPage (real mode, failing saves)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.mocked(useTeamChatActions).mockImplementation(() => actual.useTeamChatActions())
    server.use(
      http.get(`${API_BASE}/api/character/team-chat`, () => HttpResponse.json(buildTeamChatDay(localDateString()))),
      http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/apply/:actionKey`, () => new HttpResponse(null, { status: 500 })),
      http.post(`${API_BASE}/api/character/team-chat/threads/:threadId/reply`, () => new HttpResponse(null, { status: 500 })),
    )
  })
  afterEach(() => vi.unstubAllEnvs())

  test('üres napon: 0 nyitott ügy semleges chip, őszinte csend-mondat, nincs üveg', async () => {
    server.use(http.get(`${API_BASE}/api/character/team-chat`, () =>
      HttpResponse.json({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })))
    renderChat()
    expect(await screen.findByText(/Ma még csend van/)).toBeInTheDocument()
    expect(screen.getByText('0 nyitott ügy')).not.toHaveClass('is-warn')
    expect(document.querySelectorAll('.glass')).toHaveLength(0)
  })

  test('egy elbukott beállítás nem mutat „Beállítva”-t, hanem kimondja a hibát', async () => {
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: /Horgony −30 perc/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült beállítani')
    expect(screen.queryByText(/Beállítva/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Horgony −30 perc/ })).toBeInTheDocument()
  })

  test('egy elbukott válasz nyitva hagyja a lapot, a szöveggel és a hibával', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    await userEvent.click(screen.getAllByRole('button', { name: /Elmesélem/ })[0])
    await userEvent.type(await screen.findByLabelText('A válaszod'), 'Későn értem haza.')
    await userEvent.click(screen.getByRole('button', { name: /Válasz küldése/ }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nem sikerült elküldeni')
    expect(within(dialog).getByLabelText('A válaszod')).toHaveValue('Későn értem haza.')
  })
})
