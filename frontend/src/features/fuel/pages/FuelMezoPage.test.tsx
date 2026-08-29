// ============================================================
// Mezo · Fuel messages page (mezo-d20.4.1) — the hub's Mezo banner → own full page
// (prototype fuel-body.html #page-mezofuel): p-coral tone, orb hero, the day's
// FUEL-CONTEXT companion messages as a thread with time + context eyebrows.
// The hub shows only the counter; the voice lives here and nowhere else.
//
// Data is stubbed at the hook boundary (the NapHubPage.test exemplar): the companion
// feed is [] in mock mode and MSW-fixture-fed in real mode, and these assertions are
// about the FACE, not about which fixture a mode happens to serve.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FuelMezoPage } from '@/features/fuel/pages/FuelMezoPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FeedMessage } from '@/data/types'

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

const lunchMsg: FeedMessage = {
  id: 'fm-1', kind: 'midday', eyebrow: 'Ebéd-ablak',
  body: [{ type: 'p', text: 'Az ebéd-ablakban járunk — a bowl 42 g fehérjét hozna.' }],
  refs: [{ kind: 'Meal', label: 'Csirkés rizs-bowl' }],
  generatedAt: '2026-05-22T13:05:00',
}
const workoutMsg: FeedMessage = {
  id: 'fm-2', kind: 'morning', eyebrow: 'Reggeli briefing',
  body: [{ type: 'p', text: 'Ma Pull Day, és a Chest Row PR-t húzzuk magunk után.' }],
  refs: [{ kind: 'Workout', label: 'Pull A' }],
  generatedAt: '2026-05-22T07:05:00',
}

beforeEach(() => {
  feedMock.useCompanionFeed.mockReturnValue([])
  voteMock.vote.mockClear()
})

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel', '/fuel/uzenetek']} initialIndex={1}>
        <Routes>
          <Route path="/fuel" element={<div>fuel-hub</div>} />
          <Route path="/fuel/uzenetek" element={<FuelMezoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('the hero is the orb with the Mezo · Fuel name and the honest message count', async () => {
  feedMock.useCompanionFeed.mockReturnValue([lunchMsg])
  renderPage()
  expect(await screen.findByText('Mezo · Fuel')).toBeInTheDocument()
  expect(screen.getByText('1 üzenet · a mai evésed fonala')).toBeInTheDocument()
  expect(document.querySelector('.mz-page-hero.orb use[href="#s-orb"]')).not.toBeNull()
  expect(document.querySelector('.mz-page.mz-p-coral')).not.toBeNull()
})

test('a fuel-context message renders as a thread card with a time + context eyebrow and its refs', async () => {
  feedMock.useCompanionFeed.mockReturnValue([lunchMsg])
  renderPage()
  expect(await screen.findByText('13:05 · Ebéd-ablak')).toBeInTheDocument()
  expect(screen.getByText(/42 g fehérjét/)).toBeInTheDocument()
  expect(screen.getByText(/Csirkés rizs-bowl$/)).toBeInTheDocument() // the ref tag
})

test('a message with no fuel reference never leaks onto the Fuel thread', async () => {
  feedMock.useCompanionFeed.mockReturnValue([workoutMsg, lunchMsg])
  renderPage()
  await screen.findByText('13:05 · Ebéd-ablak')
  expect(document.querySelectorAll('.fh-mzmsg')).toHaveLength(1)
  expect(screen.queryByText(/Pull Day/)).toBeNull()
})

test('no fuel-context message today → the page says so instead of padding the thread', async () => {
  feedMock.useCompanionFeed.mockReturnValue([workoutMsg])
  renderPage()
  expect(await screen.findByText('ma még nincs Fuel-üzenet')).toBeInTheDocument()
  expect(document.querySelectorAll('.fh-mzmsg')).toHaveLength(0)
})

test('a persisted feed message carries the feedback chips and votes with its artifactId', async () => {
  feedMock.useCompanionFeed.mockReturnValue([lunchMsg])
  renderPage()
  const card = (await screen.findByText('13:05 · Ebéd-ablak')).closest('.fh-mzmsg') as HTMLElement
  await userEvent.click(within(card).getByRole('button', { name: /Segített/ }))
  expect(voteMock.vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
})

test('the back chip returns to the Fuel hub', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('fuel-hub')).toBeInTheDocument()
})
