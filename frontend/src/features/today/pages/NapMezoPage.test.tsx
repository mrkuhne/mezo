import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FeedMessage } from '@/data/types'

// Mezo üzenetei page (mezo-d20.2.2) — the Nap hub's Mezo tile → own full page
// (prototype nap-body.html #page-mezo): p-coral tone, breathing-orb hero, the day's
// companion messages as a thread of cards, chat CTA at the bottom. The thread logic is
// the sheet's verbatim (buildMezoMessages + useCompanionFeed + useFeedback wiring).

// Mode-agnostic data stubs: the companion feed is [] in mock mode and MSW-fixture-fed in
// real mode — this suite tests the page, not the data layer (QuickInputSheet.test pattern).
const feedMock = vi.hoisted(() => ({ useCompanionFeed: vi.fn<() => FeedMessage[]>(() => []) }))
const voteMock = vi.hoisted(() => ({ vote: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCompanionFeed: () => feedMock.useCompanionFeed(),
    useFeedback: () => ({ get: () => undefined, vote: voteMock.vote, pending: false }),
  }
})

const morningMsg: FeedMessage = {
  id: 'fm-1', kind: 'morning', eyebrow: 'Reggeli briefing',
  body: [{ type: 'p', text: 'Két nap múlva W3-csúcs — ma a Pull A a hét kulcs-edzése.' }],
  refs: [{ kind: 'workout', label: 'Pull A' }],
  generatedAt: '2026-05-22T07:05:00',
}
const sleepMsg: FeedMessage = {
  id: 'fm-2', kind: 'sleep', eyebrow: 'Alvás-reakció',
  body: [{ type: 'p', text: '7:24, 92% hatékonyság — zsinórban a harmadik cél feletti éjszakád.' }],
  refs: [],
  generatedAt: '2026-05-22T07:12:00',
}

beforeEach(() => {
  feedMock.useCompanionFeed.mockReturnValue([])
  voteMock.vote.mockClear()
})

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap', '/nap/uzenetek']} initialIndex={1}>
        <Routes>
          <Route path="/nap" element={<div>nap-hub</div>} />
          <Route path="/nap/uzenetek" element={<NapMezoPage />} />
          <Route path="/mezo/chat" element={<div>chat-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('the hero is the breathing orb with the Mezo · ma name and the honest message count', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  expect(await screen.findByText('Mezo · ma')).toBeInTheDocument()
  expect(screen.getByText('2 üzenet · a napod fonala')).toBeInTheDocument()
  expect(document.querySelector('.mz-page-hero.orb use[href="#s-orb"]')).not.toBeNull()
  expect(document.querySelector('.mz-page.mz-p-coral')).not.toBeNull()
})

test('the back chip navigates back to the hub', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('nap-hub')).toBeInTheDocument()
})

test('feed messages render as thread cards: time · eyebrow head, body, refs, daypart spot', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  expect(await screen.findByText('07:05 · Reggeli briefing')).toBeInTheDocument()
  expect(screen.getByText('07:12 · Alvás-reakció')).toBeInTheDocument()
  expect(screen.getByText(/W3-csúcs/)).toBeInTheDocument()
  expect(screen.getByText(/Pull A$/)).toBeInTheDocument() // the ref tag
  // kind → spot mapping: morning → s-reggel, sleep → s-este
  expect(document.querySelector('.nap-mzmsg use[href="#s-reggel"]')).not.toBeNull()
  expect(document.querySelector('.nap-mzmsg use[href="#s-este"]')).not.toBeNull()
})

test('no morning message in the feed → the labelled demo briefing leads the thread', async () => {
  feedMock.useCompanionFeed.mockReturnValue([sleepMsg])
  renderPage()
  expect(await screen.findByText('Demo tartalom')).toBeInTheDocument()
  const cards = document.querySelectorAll('.nap-mzmsg')
  expect(cards).toHaveLength(2)
  expect(within(cards[0] as HTMLElement).getByText('Demo tartalom')).toBeInTheDocument()
})

test('a persisted feed message carries the feedback chips and votes with its artifactId', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  renderPage()
  const card = await screen.findByText('07:05 · Reggeli briefing')
  const msg = card.closest('.nap-mzmsg') as HTMLElement
  await userEvent.click(within(msg).getByRole('button', { name: /Segített/ }))
  expect(voteMock.vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
})

test('the demo briefing card carries NO feedback chips — nothing persisted to vote on', async () => {
  feedMock.useCompanionFeed.mockReturnValue([])
  renderPage()
  const meta = await screen.findByText('Demo tartalom')
  const msg = meta.closest('.nap-mzmsg') as HTMLElement
  expect(within(msg).queryByRole('button', { name: /Segített/ })).toBeNull()
})

test('the chat CTA navigates to /mezo/chat', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Beszélgess Mezóval ›' }))
  expect(await screen.findByText('chat-page')).toBeInTheDocument()
})
