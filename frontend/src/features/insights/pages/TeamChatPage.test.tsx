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
import type { TeamChatDay, TeamChatLine, TeamChatThread } from '@/data/character/teamChatApi'
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
    vi.mocked(useTeamChatActions).mockReturnValue({
      apply, reply, pending: false,
      answer: vi.fn().mockResolvedValue(undefined),
      undoRemembered: vi.fn().mockResolvedValue(undefined),
      awaiting: new Set(),
    })
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
    expect(screen.getByText('3 nyitott ügy')).toBeInTheDocument()
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
    expect(screen.getByText('3 nyitott ügy')).toHaveClass('is-warn')
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
    expect(await screen.findByText(/Szunya válaszol rá — ha konkrét okot mondasz/)).toBeInTheDocument()
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

  test('a mai nap alján lapos lábjegyzet: 21:00-kor az esti kiadás összefoglalja a napot', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    const note = screen.getByText('21:00-kor az esti kiadás összefoglalja a nap szálait a falon.')
    expect(note).toHaveClass('tf-note')
    expect(note.closest('.glass')).toBeNull()
  })

  test('egy korábbi napon nincs esti-kiadás lábjegyzet', async () => {
    renderChat('/mezo/elo?d=2026-09-20')
    await screen.findByText('A csapat beszél')
    // nem üres a nap: a mock ugyanazokat a sorokat építi erre a dátumra is — a lábjegyzet
    // hiánya tehát a „nem ma” miatt van, nem a csend miatt
    expect(screen.getByText('Rizses csirkét ettem, dupla adag rizzsel.')).toBeInTheDocument()
    expect(screen.queryByText(/Ma · élőben/)).not.toBeInTheDocument()
    expect(screen.queryByText(/21:00-kor az esti kiadás/)).not.toBeInTheDocument()
  })

  test('megnyitáskor elmenti, mikor láttad utoljára', async () => {
    renderChat()
    await screen.findByText('A csapat beszél')
    expect(localStorage.getItem(TEAM_CHAT_LAST_SEEN_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  // S7 (mezo-d6ivw.7, Task 9): the seeded "Késői étkezés" ügy carries an EXCUSE offer OPEN —
  // the one-tap "ismerős kifogás?" button is visible without a reply round-trip first.
  test('egy ismert kivétel ajánlatára koppintva az answer-t hívja EXCUSED-del', async () => {
    const answer = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useTeamChatActions).mockReturnValue({
      apply, reply, answer, pending: false,
      undoRemembered: vi.fn().mockResolvedValue(undefined),
      awaiting: new Set(),
    })
    renderChat()
    // R2: the seeded offer reads as the backend's question-form template.
    expect(await screen.findByText('Tudom, hogy meccsnapokon később eszel — ez rendben van. Ma is meccsnap volt?'))
      .toBeInTheDocument()
    const btn = await screen.findByRole('button', { name: 'Igen, meccsnap volt' })
    await userEvent.click(btn)
    expect(answer).toHaveBeenCalledWith('tc-thread-late-eating', 'EXCUSED')
  })

  test('amíg a válasz vár, a „Falat ír…" sor a szál utolsó sora alatt jelenik meg', async () => {
    vi.mocked(useTeamChatActions).mockReturnValue({
      apply, reply, pending: false,
      answer: vi.fn().mockResolvedValue(undefined),
      undoRemembered: vi.fn().mockResolvedValue(undefined),
      awaiting: new Set(['tc-thread-late-eating']),
    })
    renderChat()
    await screen.findByText('A csapat beszél')
    expect(screen.getByRole('status')).toHaveTextContent('Falat ír…')
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

  test('a mai nap alján a lábjegyzet valós módban is ott van', async () => {
    renderChat()
    expect(await screen.findByText('21:00-kor az esti kiadás összefoglalja a nap szálait a falon.')).toBeInTheDocument()
  })

  test('csendes napon nincs lábjegyzet — nincs mit összefoglalni', async () => {
    server.use(http.get(`${API_BASE}/api/character/team-chat`, () =>
      HttpResponse.json({ date: localDateString(), lines: [], openThreads: [], pushesToday: 0, pushBudget: 2 })))
    renderChat()
    await screen.findByText(/Ma még csend van/)
    expect(screen.queryByText(/21:00-kor az esti kiadás/)).not.toBeInTheDocument()
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

// S7 final review (items 2, 3): the reply afterlife — close tag + remembered chip — lives on
// the ügy's LAST REPLY line only, never on a DATA close, and the undo confirmation survives the
// reopen the undo itself causes.
describe('TeamChatPage (real mode, reply afterlife)', () => {
  const lineAnchorId = (id: string) => `tc-${id}`
  const today = localDateString()
  const at = (hhmm: string) => new Date(`${today}T${hhmm}:00`).toISOString()
  const thread = (over: Partial<TeamChatThread> = {}): TeamChatThread => ({
    id: 't-late', flagKey: 'late_eating', ruleLabel: 'Késői étkezés', owner: 'falat', guest: null,
    status: 'RESOLVED', openedAt: at('17:50'), closedAt: at('21:52'), pushed: false, actions: [],
    applied: null, closeReason: 'REPLY', closeNote: 'meccsnap', offer: null, offerTag: null,
    remembered: { text: 'Meccsnapokon későn eszel — ez rendben van.', contextTag: 'meccsnap', active: true },
    ...over,
  })
  const line = (id: string, hhmm: string, kind: TeamChatLine['kind'], t: TeamChatThread | undefined, body = `sor ${id}`): TeamChatLine => ({
    id, threadId: 't-late', kind, character: kind === 'USER' ? null : 'falat', body, voiced: true,
    facts: [], occurredAt: at(hhmm), ...(t ? { thread: t } : {}),
  })
  const dayOf = (t: TeamChatThread, lines: TeamChatLine[]): TeamChatDay => ({
    date: today, lines, openThreads: t.status === 'OPEN' ? [t] : [], pushesToday: 0, pushBudget: 2,
  })
  const serve = (d: () => TeamChatDay) =>
    server.use(http.get(`${API_BASE}/api/character/team-chat`, () => HttpResponse.json(d())))

  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.mocked(useTeamChatActions).mockImplementation(() => actual.useTeamChatActions())
  })
  afterEach(() => vi.unstubAllEnvs())

  test('egy adattal lezárt ügy válasz-során nincs „lezárta:” címke és nincs chip', async () => {
    const t = thread({ closeReason: 'DATA', closeNote: null, remembered: null })
    serve(() => dayOf(t, [
      line('o', '17:50', 'OPEN', t), line('u', '18:00', 'USER', undefined, 'Nem volt kedvem.'),
      line('r', '18:01', 'REPLY', t, 'Értem, köszönöm.'), line('x', '21:00', 'RESOLVE', t),
    ]))
    renderChat()
    expect(await screen.findByText('Értem, köszönöm.')).toBeInTheDocument()
    expect(screen.queryByText(/lezárta:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Megjegyeztem:/)).not.toBeInTheDocument()
    expect(screen.getByText(/^Rendeződött ·/)).toBeInTheDocument()
  })

  test('két válasz-sorból csak az utolsó hordja a lezárás-címkét és a chipet', async () => {
    const t = thread()
    serve(() => dayOf(t, [
      line('o', '17:50', 'OPEN', t), line('u1', '21:00', 'USER', undefined, 'Nem volt kedvem.'),
      line('r1', '21:01', 'REPLY', t, 'Értem.'), line('u2', '21:50', 'USER', undefined, 'Meccs volt.'),
      line('r2', '21:52', 'REPLY', t, 'Akkor ez kivétel volt.'),
    ]))
    renderChat()
    await screen.findByText('Akkor ez kivétel volt.')
    expect(screen.getAllByText('Falat lezárta: meccsnap')).toHaveLength(1)
    expect(screen.getAllByText(/Megjegyeztem:/)).toHaveLength(1)
    const lastBubble = document.getElementById(lineAnchorId('r2'))!
    expect(within(lastBubble).getByText(/Megjegyeztem:/)).toBeInTheDocument()
  })

  test('a visszavonás újranyitja az ügyet — és a megerősítés ott marad', async () => {
    let undone = false
    const lines = (t: TeamChatThread) => [
      line('o', '17:50', 'OPEN', t), line('u', '21:50', 'USER', undefined, 'Meccs volt.'),
      line('r', '21:52', 'REPLY', t, 'Akkor ez kivétel volt.'),
    ]
    serve(() => {
      const t = undone
        ? thread({ status: 'OPEN', closedAt: null, closeReason: null, closeNote: null,
          remembered: { text: 'Meccsnapokon későn eszel — ez rendben van.', contextTag: 'meccsnap', active: false } })
        : thread()
      return dayOf(t, lines(t))
    })
    server.use(http.delete(`${API_BASE}/api/character/team-chat/threads/:threadId/remembered`, () => {
      undone = true
      return HttpResponse.json(thread({ status: 'OPEN' }))
    }))
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByText('Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.')).toBeInTheDocument()
    expect(screen.queryByText(/Megjegyeztem:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/lezárta:/)).not.toBeInTheDocument()
  })
})
