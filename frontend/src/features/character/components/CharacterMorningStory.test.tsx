import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CharacterMorningStory } from '@/features/character/components/CharacterMorningStory'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
import type { CharacterConferenceResponse, CharacterFeedItem } from '@/data/character/characterApi'

const state = vi.hoisted(() => ({ conference: null as CharacterConferenceResponse | null }))
vi.mock('@/data/hooks', () => ({ useCharacterConference: () => ({ conference: state.conference }) }))
const item: CharacterFeedItem = { kind: 'CONFERENCE_CHANGE', sourceType: 'CONFERENCE_CHANGE', sourceId: 'meeting', sourceIndex: 0, at: '2026-09-20T10:00:00Z', text: 'A két hét eltérő képet mutat.' }
beforeEach(() => { state.conference = null })

test('an observation invites reading without pretending a debate happened', () => {
  const open = vi.fn()
  render(<CharacterMorningStory item={{ ...item, kind: 'OBSERVATION', sourceType: 'OBSERVATION', expertKey: 'edzo' }} experts={MOCK_EXPERTS} onOpen={open} />)
  expect(screen.getByRole('heading')).toHaveTextContent('Egy új gondolat rólad.')
  expect(screen.getByText(item.text)).toBeInTheDocument()
  expect(screen.queryByText(/hozzászólás|ma reggel/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Megnézem a bejegyzést/ }))
  expect(open).toHaveBeenCalledOnce()
})

test('only the matching stored conversation supplies the scene and exact quote', () => {
  state.conference = { id: 'meeting', kind: 'WEEKLY', generatedAt: item.at, transcript: [], deliberationSource: 'STORED', changes: [{ claimId: 'claim', kind: 'NEW', summary: item.text }], deliberation: [{ title: 'Alvás', items: [{ index: 0, expertKey: 'szomnologus', claimId: 'claim', sensitive: false, text: 'Rövid éjszakák után nehezebb.', reactions: [{ expertKey: 'edzo', stance: 'NUANCE', argument: 'A terhelés is számít.' }] }] }] }
  const { rerender } = render(<CharacterMorningStory item={item} experts={MOCK_EXPERTS} onOpen={vi.fn()} />)
  expect(screen.getByRole('heading')).toHaveTextContent('Rólad beszélgettünk.')
  expect(screen.getByText('„A terhelés is számít.”')).toBeInTheDocument()
  expect(screen.getByText('2 karakter · 1 szakértői hozzászólás')).toBeInTheDocument()
  state.conference.deliberationSource = 'DERIVED'
  rerender(<CharacterMorningStory item={item} experts={MOCK_EXPERTS} onOpen={vi.fn()} />)
  expect(screen.queryByText(/Rólad beszélgettünk|A terhelés is számít/)).not.toBeInTheDocument()
})
