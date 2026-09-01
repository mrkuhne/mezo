// Emberek S3 Említések (mezo-06o0.2 Task 5) — MentionRow rewrite. New interface:
// { mention, person?, onUndo?, delayMs? } (no more bare `onUndo` gate on props alone —
// the row still decides ✕-visibility itself from `mention.source`). Behavioral contract
// carried over from the S2 row: FIGYELEM only on `mention.flagged`, the tie chip only
// when `mention.tiedTo` is present, ✕ only on an automata source (`text`/`chat`) AND an
// `onUndo` callback.
import { fireEvent, render, screen } from '@testing-library/react'
import type { Mention, PersonEntry } from '@/data/types'
import { MentionRow } from '@/features/me/components/MentionRow'

const BASE: Mention = {
  id: 'mn-test',
  ts: '2026-05-24T09:00',
  dayLabel: 'Ma',
  timeLabel: '09:00',
  person_id: 'pp-adam',
  personName: 'Ádám',
  source: 'text',
  excerpt: 'Ádámmal átbeszéltük a hétvégi túrát.',
}

const PERSON: PersonEntry = {
  id: 'pp-adam',
  name: 'Ádám',
  initial: 'Á',
  relationship: 'friend',
  relationshipHu: 'Barát',
  aliases: [],
  status: 'active',
  sourceKind: 'seed',
  affect_baseline: 'positive',
  mentionCount: 3,
  mentionsThisWeek: 1,
  last_mentioned_at: '2026-05-24T09:00',
  lastMentionLabel: 'Ma · 09:00',
  contactCadenceLabel: 'Heti',
  notes: '',
  affectTrend: [],
  knownFacts: [],
  ties: [],
  graphEdges: [],
}

test('tone-less mention renders no ppl-tw-* wash', () => {
  const { container } = render(<MentionRow mention={BASE} />)
  expect(container.querySelector('.ppl-mrowt')?.className).not.toMatch(/ppl-tw-/)
})

test.each([
  ['positive', 'ppl-tw-jo'],
  ['mixed', 'ppl-tw-vegyes'],
  ['negative', 'ppl-tw-nehez'],
] as const)('tone=%s washes with %s', (tone, wash) => {
  const { container } = render(<MentionRow mention={{ ...BASE, tone }} />)
  expect(container.querySelector('.ppl-mrowt')?.className).toContain(wash)
})

test('neutral tone renders no wash either (only jo/vegyes/nehez are washed)', () => {
  const { container } = render(<MentionRow mention={{ ...BASE, tone: 'neutral' }} />)
  expect(container.querySelector('.ppl-mrowt')?.className).not.toMatch(/ppl-tw-/)
})

test('the source disc renders the SRC_META clay icon for a text mention, and the icon for a chip mention', () => {
  const { container: textC } = render(<MentionRow mention={{ ...BASE, source: 'text' }} />)
  expect(textC.querySelector('.ppl-srcdisc svg use')?.getAttribute('href')).toBe('#i-naplo')

  const { container: chipC } = render(<MentionRow mention={{ ...BASE, source: 'chip' }} />)
  expect(chipC.querySelector('.ppl-srcdisc svg use')).toBeNull()
  expect(chipC.querySelector('.ppl-srcdisc svg')).not.toBeNull()
})

test('the mini avatar shows the PersonEntry initial when a person is passed', () => {
  render(<MentionRow mention={BASE} person={PERSON} />)
  expect(screen.getByText('Á', { selector: '.ppl-mavat' })).toBeInTheDocument()
})

test('the mini avatar falls back to the mention personName\'s first letter with no person', () => {
  render(<MentionRow mention={{ ...BASE, personName: 'Zsófia' }} />)
  expect(screen.getByText('Z', { selector: '.ppl-mavat' })).toBeInTheDocument()
})

test('a contextLabel renders the CTX_META context chip', () => {
  render(<MentionRow mention={{ ...BASE, contextLabel: 'edzes' }} />)
  expect(screen.getByText('edzés')).toBeInTheDocument()
})

test('no contextLabel renders no context chip', () => {
  const { container } = render(<MentionRow mention={BASE} />)
  expect(container.querySelector('.ppl-ctxch')).toBeNull()
})

test('FIGYELEM renders only when flagged', () => {
  const { rerender } = render(<MentionRow mention={BASE} />)
  expect(screen.queryByText('FIGYELEM')).toBeNull()
  rerender(<MentionRow mention={{ ...BASE, flagged: true }} />)
  expect(screen.getByText('FIGYELEM')).toBeInTheDocument()
})

test('the tie chip renders only when tiedTo is present', () => {
  const { rerender } = render(<MentionRow mention={BASE} />)
  expect(screen.queryByText('kapcsolódik')).toBeNull()
  rerender(<MentionRow mention={{ ...BASE, tiedTo: { kind: 'checkin', label: 'Esti check-in · 21:00' } }} />)
  expect(screen.getByText('kapcsolódik')).toBeInTheDocument()
  expect(screen.getByText('Esti check-in · 21:00')).toBeInTheDocument()
})

test('✕ renders and calls onUndo on a text-source mention with onUndo passed', () => {
  const onUndo = vi.fn()
  render(<MentionRow mention={{ ...BASE, source: 'text' }} onUndo={onUndo} />)
  fireEvent.click(screen.getByRole('button', { name: 'Említés visszavonása' }))
  expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: 'mn-test', source: 'text' }))
})

test('✕ renders on a chat-source mention with onUndo passed', () => {
  render(<MentionRow mention={{ ...BASE, source: 'chat' }} onUndo={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Említés visszavonása' })).toBeInTheDocument()
})

test('✕ is absent on a voice-source mention even with onUndo passed (not an automata source)', () => {
  render(<MentionRow mention={{ ...BASE, source: 'voice' }} onUndo={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Említés visszavonása' })).toBeNull()
})

test('✕ is absent with no onUndo, even on a text-source mention', () => {
  render(<MentionRow mention={{ ...BASE, source: 'text' }} />)
  expect(screen.queryByRole('button', { name: 'Említés visszavonása' })).toBeNull()
})
