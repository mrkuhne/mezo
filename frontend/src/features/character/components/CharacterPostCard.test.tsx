import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CharacterPostCard } from '@/features/character/components/CharacterPostCard'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
import type { CharacterConferenceResponse, CharacterFeedItem } from '@/data/character/characterApi'
const state = vi.hoisted(() => ({ conference: null as CharacterConferenceResponse | null, isError: false, feedback: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/data/hooks', () => ({ useCharacterConference: () => ({ ...state, isLoading: false, refetch: vi.fn() }), useClaimFeedback: () => ({ submit: state.feedback, pending: false }) }))
vi.mock('@/features/character/components/CharacterReplyThread', () => ({ CharacterReplyThread: ({ source }: { source: { sourceType: string; sourceIndex: number } }) => <div data-testid="reply-source">{source.sourceType}:{source.sourceIndex}</div> }))
const post: CharacterFeedItem = { kind: 'CONFERENCE_POST', sourceType: 'CONFERENCE_ITEM', sourceId: 'meeting', sourceIndex: 7, expertKey: 'szomnologus', at: '2026-09-21T06:00:00Z', text: 'Rövid éjszakák után nehezebb.' }
beforeEach(() => {
  state.isError = false
  state.feedback.mockReset().mockResolvedValue(undefined)
  state.conference = { id: 'meeting', kind: 'DAILY', generatedAt: post.at, transcript: [], deliberationSource: 'STORED', changes: [], deliberation: [{ title: 'Alvás', items: [{ index: 7, expertKey: 'szomnologus', sensitive: false, text: post.text, reactions: [{ expertKey: 'edzo', stance: 'NUANCE', argument: 'A terhelés is számít.', round: 2, replyToExpert: 'szomnologus' }], skeptic: { verdict: 'WEAKEN', argument: 'Még kevés az adat.' }, chair: { accepted: false, reason: 'Egyelőre nyitva hagyjuk.' } }] }] }
})
test('a conference post keeps its real indexed discussion, verdicts and reply source', () => {
  render(<CharacterPostCard item={post} experts={MOCK_EXPERTS} />)
  expect(screen.getByText('A terhelés is számít.')).toBeInTheDocument()
  expect(screen.getByText('Még kevés az adat.')).toBeInTheDocument()
  expect(screen.getByText('Egyelőre nyitva hagyjuk.')).toBeInTheDocument()
  expect(screen.getByText('3 szakértői hozzászólás')).toBeInTheDocument()
  expect(screen.getByTestId('reply-source')).toHaveTextContent('CONFERENCE_ITEM:7')
  expect(screen.queryByRole('button', { name: /Hasznos|Nem így érzem/ })).not.toBeInTheDocument()
})
test('another proposal index cannot supply invented comments for this post', () => {
  render(<CharacterPostCard item={{ ...post, sourceIndex: 8 }} experts={MOCK_EXPERTS} />)
  expect(screen.queryByText('A terhelés is számít.')).not.toBeInTheDocument()
})
test('failed discussion loading is visible instead of looking like no replies', () => {
  state.conference = null
  state.isError = true
  render(<CharacterPostCard item={post} experts={MOCK_EXPERTS} />)
  expect(screen.getByRole('alert')).toHaveTextContent('beszélgetés nem töltődött be')
  expect(screen.getByRole('button', { name: 'Újratöltés' })).toBeInTheDocument()
})
test('long peer threads collapse after two comments, while Mezo remains visible', () => {
  state.conference!.deliberation![0].items[0].reactions.push({ expertKey: 'doki', stance: 'SUPPORT', argument: 'Második vélemény.' }, { expertKey: 'drill', stance: 'CHALLENGE', argument: 'Harmadik vélemény.' })
  render(<CharacterPostCard item={post} experts={MOCK_EXPERTS} />)
  expect(screen.queryByText('Harmadik vélemény.')).not.toBeInTheDocument()
  expect(screen.getByText('Egyelőre nyitva hagyjuk.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'További 1 szakértői hozzászólás' }))
  expect(screen.getByText('Harmadik vélemény.')).toBeInTheDocument()
})
test('feedback targets the persisted claim and reports success only after saving', async () => {
  state.conference!.deliberation![0].items[0].claimId = 'bound-claim'
  render(<CharacterPostCard item={post} experts={MOCK_EXPERTS} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hasznos' }))
  await waitFor(() => expect(state.feedback).toHaveBeenCalledWith('bound-claim', 'TALAL'))
  expect(await screen.findByText('Köszönjük a visszajelzést.')).toBeInTheDocument()
})

test('an open followup stays attached to its actual post and names the needed evidence', () => {
  state.conference!.followups = [{ id: 'followup', sourceIndex: 7, kind: 'HYPOTHESIS', expertKey: 'edzo', question: 'Pihenőnap után könnyebb volt?', requiredEvidence: 'Két új edzés és alvásnapló.', dueOn: '2026-10-01', status: 'WAITING' }]
  render(<CharacterPostCard item={post} experts={MOCK_EXPERTS} />)
  expect(screen.getByText('Pihenőnap után könnyebb volt?')).toBeInTheDocument()
  expect(screen.getByText('Két új edzés és alvásnapló.')).toBeInTheDocument()
  expect(screen.getByText(/Ekkor nézzük újra/)).toBeInTheDocument()
})
