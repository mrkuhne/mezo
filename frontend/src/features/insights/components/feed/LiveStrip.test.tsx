import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useTeamChat } from '@/data/hooks'
import type { TeamChatDay, TeamChatLine, TeamChatThread } from '@/data/character/teamChatApi'
import { TEAM_CHAT_LAST_SEEN_KEY } from '@/features/insights/logic/teamChat'
import { LiveStrip } from './LiveStrip'

vi.mock('@/data/hooks', async importOriginal => {
  const mod = await importOriginal<typeof import('@/data/hooks')>()
  return { ...mod, useTeamChat: vi.fn() }
})

const DATE = '2026-09-26'
const at = (hm: string) => new Date(`${DATE}T${hm}:00`).toISOString()

const line = (id: string, hm: string, over: Partial<TeamChatLine> = {}): TeamChatLine => ({
  id,
  threadId: null,
  kind: 'OPEN',
  character: 'szunya',
  body: `sor ${id}`,
  voiced: true,
  facts: [],
  occurredAt: at(hm),
  ...over,
})

const thread = (id: string, hm: string, over: Partial<TeamChatThread> = {}): TeamChatThread => ({
  id,
  flagKey: 'sleep_debt',
  ruleLabel: 'Alvásadósság',
  owner: 'szunya',
  guest: null,
  status: 'OPEN',
  openedAt: at(hm),
  closedAt: null,
  pushed: false,
  actions: [],
  applied: null,
  ...over,
})

const day = (lines: TeamChatLine[], openThreads: TeamChatThread[] = []): TeamChatDay => ({
  date: DATE,
  lines,
  openThreads,
  pushesToday: 0,
  pushBudget: 2,
})

const withDay = (d: TeamChatDay) => vi.mocked(useTeamChat).mockReturnValue({ day: d, loading: false })

const renderStrip = () =>
  render(
    <MemoryRouter initialEntries={['/mezo']}>
      <Routes>
        <Route path="/mezo" element={<LiveStrip />} />
        <Route path="/mezo/elo" element={<p>a csapat beszél</p>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => localStorage.removeItem(TEAM_CHAT_LAST_SEEN_KEY))

test('üres nap, nyitott ügy nélkül → nincs sáv', () => {
  withDay(day([]))
  const { container } = renderStrip()
  expect(container).toBeEmptyDOMElement()
})

test('töltés közben sincs sáv (nem villan fel)', () => {
  vi.mocked(useTeamChat).mockReturnValue({ day: day([line('a', '08:00')]), loading: true })
  const { container } = renderStrip()
  expect(container).toBeEmptyDOMElement()
})

test('a legutóbbi beszélő + a mondata, a címke, és a sáv NEM üveg', () => {
  withDay(day([
    line('a', '08:00', { character: 'szunya', body: 'Korábbi mondat' }),
    line('u', '09:00', { kind: 'USER', character: null, body: 'Én írtam' }),
    line('b', '12:40', { kind: 'RESOLVE', character: 'falat', body: 'Megvan, 1 140 kcal — rendeződött ✅' }),
  ]))
  renderStrip()
  const strip = screen.getByRole('button', { name: /A CSAPAT BESZÉL/ })
  expect(strip).toHaveTextContent('ÉLŐBEN · A CSAPAT BESZÉL')
  expect(strip).toHaveTextContent('Falat: Megvan, 1 140 kcal — rendeződött ✅')
  expect(strip).not.toHaveTextContent('Én írtam')
  expect(strip).not.toHaveClass('glass')
  expect(strip.querySelector('.tf-av')).not.toBeNull()
})

test('olvasatlan szám: lastSeen nélkül mind a karakter-sor számít', () => {
  withDay(day([line('a', '08:00'), line('b', '12:40', { character: 'falat' })]))
  renderStrip()
  expect(screen.getByText('2')).toHaveClass('tf-live-cnt')
})

test('a szoba meglátogatása után (lastSeen a legutóbbi sor után) eltűnik a szám', () => {
  localStorage.setItem(TEAM_CHAT_LAST_SEEN_KEY, at('13:00'))
  withDay(day([line('a', '08:00'), line('b', '12:40', { character: 'falat' })]))
  renderStrip()
  expect(screen.getByRole('button', { name: /A CSAPAT BESZÉL/ })).toBeInTheDocument()
  expect(document.querySelector('.tf-live-cnt')).toBeNull()
})

test('kieső böngésző-tár → a sáv él, a szám marad (ártalmatlan alapállás)', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  withDay(day([line('a', '08:00')]))
  renderStrip()
  expect(document.querySelector('.tf-live-cnt')).toHaveTextContent('1')
  spy.mockRestore()
})

test('csak nyitott ügy (ma még nincs sor) → a legrégebbi ügy címkéje + a gazdája', () => {
  withDay(day([], [
    thread('t2', '10:00', { ruleLabel: 'Tartós stressz', owner: 'deru' }),
    thread('t1', '07:00', { ruleLabel: 'Alvásadósság', owner: 'szunya' }),
  ]))
  renderStrip()
  expect(screen.getByRole('button', { name: /A CSAPAT BESZÉL/ })).toHaveTextContent('Alvásadósság — Szunya figyeli')
  expect(document.querySelector('.tf-live-cnt')).toBeNull()
})

test('a sáv a csapat-chatbe visz', async () => {
  withDay(day([line('a', '08:00')]))
  renderStrip()
  await userEvent.click(screen.getByRole('button', { name: /A CSAPAT BESZÉL/ }))
  expect(screen.getByText('a csapat beszél')).toBeInTheDocument()
})
