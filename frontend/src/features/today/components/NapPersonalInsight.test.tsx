import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapPersonalInsight } from '@/features/today/components/NapPersonalInsight'
import type { Observation } from '@/data/types'

const mocks = vi.hoisted(() => ({ feed: vi.fn(), reply: vi.fn(), retry: vi.fn() }))
vi.mock('@/data/hooks', () => ({ useObservations: mocks.feed, useObservationReply: () => ({ reply: mocks.reply }) }))
const item: Observation = { id: 'event-1', patternId: 'pattern-1', card: 'fresh', occurredAt: '2026-09-17T10:00:00Z', title: 'A te ritmusod', text: 'A **sétás napokon** többet pihentél.', evidence: ['Két rögzített séta'], status: 'monitoring', evidenceHits: 2, evidenceMisses: 0, sourceIcon: 'i-mezo' }
function feed(overrides = {}) { return { observations: [item], isPending: false, isError: false, degraded: false, refetch: mocks.retry, ...overrides } }
function Probe() { const location = useLocation(); return <p>{location.search || location.state?.compose}</p> }
function tree() { return <MemoryRouter><Routes><Route path="/" element={<NapPersonalInsight />} /><Route path="/mezo/chat" element={<Probe />} /></Routes></MemoryRouter> }
function mount() { return render(tree()) }
beforeEach(() => { vi.clearAllMocks(); mocks.feed.mockReturnValue(feed()); mocks.reply.mockResolvedValue({}) })

test('uses the first substantive non-rejected observation and reveals its evidence', async () => {
  mocks.feed.mockReturnValue(feed({ observations: [{ ...item, id: 'empty', text: ' ' }, { ...item, id: 'rejected', repliedChoice: 'reject', text: 'Elvetve' }, item] }))
  mount()
  expect(screen.queryByText('Elvetve')).not.toBeInTheDocument()
  expect(screen.getByText('sétás napokon').tagName).toBe('STRONG')
  await userEvent.click(screen.getByText('Miből látom?'))
  expect(screen.getByText('Két rögzített séta')).toBeVisible()
})
test.each([{ isPending: true, copy: 'Összerakom az észrevételeidet…' }, { degraded: true, copy: 'Az észrevételek most nem érhetők el.' }, { observations: [], copy: 'Még nincs személyes észrevétel.' }])('renders an honest unavailable state: $copy', ({ copy, ...state }) => {
  mocks.feed.mockReturnValue(feed(state)); mount(); expect(screen.getByText(copy)).toBeInTheDocument(); expect(screen.queryByText('A te ritmusod')).not.toBeInTheDocument()
})
test('failed reads retry without displaying stale claims', async () => {
  mocks.feed.mockReturnValue(feed({ isError: true })); mount(); await userEvent.click(screen.getByRole('button', { name: 'Újrapróbálom' })); expect(mocks.retry).toHaveBeenCalledOnce(); expect(screen.queryByText('A te ritmusod')).not.toBeInTheDocument()
})
test('blocks repeat replies while pending and after success even if the feed is stale', async () => {
  let finish!: (result: {}) => void
  mocks.reply.mockReturnValue(new Promise(resolve => { finish = resolve }))
  mount(); await userEvent.dblClick(screen.getByRole('button', { name: 'Igen, jellemző' })); expect(mocks.reply).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Nem stimmel' })).toBeDisabled()
  await act(async () => finish({}))
  expect(screen.queryByRole('button', { name: 'Igen, jellemző' })).not.toBeInTheDocument()
  expect(screen.getByText('Megjegyeztem a válaszod.')).toBeInTheDocument()
})
test('failed writes restore the controls and never claim success', async () => {
  mocks.reply.mockRejectedValue(new Error('offline')); mount(); await userEvent.click(screen.getByRole('button', { name: 'Igen, jellemző' })); expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült'); expect(screen.getByRole('button', { name: 'Igen, jellemző' })).toBeEnabled(); expect(screen.queryByText('Megjegyeztem a válaszod.')).not.toBeInTheDocument()
})
test('talk uses the server conversation', async () => {
  mocks.reply.mockResolvedValue({ conversationId: 'conv-9' }); mount(); await userEvent.click(screen.getByRole('button', { name: 'Beszéljük meg' })); expect(await screen.findByText('?c=conv-9')).toBeInTheDocument(); expect(mocks.reply).toHaveBeenCalledWith(item.patternId, 'talk')
})
test('confirmed observations open a contextual chat without replying again', async () => {
  mocks.feed.mockReturnValue(feed({ observations: [{ ...item, card: 'confirmed' }] })); mount(); await userEvent.click(screen.getByRole('button', { name: 'Beszéljünk róla' })); expect(await screen.findByText(/Beszéljünk erről az észrevételről:/)).toHaveTextContent(item.text); expect(mocks.reply).not.toHaveBeenCalled()
})
test('return observations offer three responses and reject maps correctly', async () => {
  mocks.feed.mockReturnValue(feed({ observations: [{ ...item, card: 'return' }] })); mount()
  expect(screen.getByRole('button', { name: 'Beszéljük meg' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Nem stimmel' }))
  expect(mocks.reply).toHaveBeenCalledWith(item.patternId, 'reject')
})
test('a new observation resets local reply state after the current one was answered', async () => {
  const view = mount(); await userEvent.click(screen.getByRole('button', { name: 'Igen, jellemző' }))
  mocks.feed.mockReturnValue(feed({ observations: [{ ...item, id: 'event-2', patternId: 'pattern-2' }] }))
  view.rerender(tree())
  await userEvent.click(screen.getByRole('button', { name: 'Igen, jellemző' }))
  expect(mocks.reply).toHaveBeenLastCalledWith('pattern-2', 'watch')
})
test('the observations link opens the observations tab directly', () => {
  mount(); expect(screen.getByRole('link', { name: 'Összes észrevétel ↗' })).toHaveAttribute('href', '/nap/uzenetek?tab=eszrevetelek')
})
