import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CharacterFeedPage } from '@/features/character/pages/CharacterFeedPage'
import { MOCK_EXPERTS, MOCK_FEED } from '@/data/character/characterMock'
import type { CharacterFeedItem } from '@/data/character/characterApi'
import { QueryWrapper } from '@/test/queryWrapper'
const navigate = vi.fn()
vi.mock('react-router-dom', async (original) => ({
  ...(await original<object>()),
  useNavigate: () => navigate,
}))
const state = vi.hoisted(() => ({ items: [] as CharacterFeedItem[], error: false }))
vi.mock('@/data/hooks', async (original) => ({
  ...(await original<object>()),
  useCharacterFeed: () => ({ items: state.items, isLoading: false, isError: state.error, refetch: vi.fn() }),
  useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
  useCharacterConferences: () => ({ conferences: [], isLoading: false }),
  useCharacterConference: () => ({ conference: null, isLoading: false }),
  useCharacterReplies: () => ({ replies: [], isLoading: false, isError: false, pending: false }),
}))
beforeEach(() => {
  state.items = MOCK_FEED
  state.error = false
  navigate.mockReset()
})
const show = () =>
  render(
    <QueryWrapper>
      <CharacterFeedPage />
    </QueryWrapper>,
  )
test('the feed shows posts directly across days and has three clear destinations', () => {
  show()
  expect(screen.getByRole('button', { name: 'Üzenőfal' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(screen.getByRole('button', { name: 'Rólad' }))
  expect(navigate).toHaveBeenCalledWith('/mezo/karakter/dimenziok')
  expect(screen.getAllByRole('article')).toHaveLength(MOCK_FEED.length)
  expect(screen.queryByRole('button', { name: 'Új bejegyzés' })).not.toBeInTheDocument()
})
test('evidence opens a glass dialog with the actual source and closes with Escape', () => {
  show()
  fireEvent.click(screen.getAllByRole('button', { name: 'Miből látszik?' })[0])
  const dialog = screen.getByRole('dialog', { name: 'Miből látszik?' })
  expect(within(dialog).getByText(MOCK_FEED[0].text)).toBeInTheDocument()
  expect(dialog).toHaveClass('gl-card')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
test('self-report keeps the user identity and never gains invented peer reactions', () => {
  state.items = [
    { kind: 'OBSERVATION', at: '2026-09-20T08:00:00Z', expertKey: 'user', text: 'Már nem szedem.' },
  ]
  show()
  expect(screen.getByText(/Saját közlés/)).toBeInTheDocument()
  expect(screen.getAllByText('Te').length).toBeGreaterThan(0)
  expect(screen.queryByText(/támogatja|vitatja/)).not.toBeInTheDocument()
})
test('failed loading is not presented as an empty feed', () => {
  state.items = []
  state.error = true
  show()
  expect(screen.getByRole('alert')).toHaveTextContent('Nem sikerült betölteni')
  expect(screen.queryByText(/nincs friss megfigyelés/)).not.toBeInTheDocument()
})
