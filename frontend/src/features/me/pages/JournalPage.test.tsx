import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { JournalPage } from '@/features/me/pages/JournalPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { JournalNote } from '@/data/journal/journalTypes'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

// Barrel-mock the journal hooks so the fixtures drive the view deterministically in both
// mock and real test modes (GrowthPage.test.tsx idiom). `useDecisions`/`useDecisionActions` join
// the same mock for the same reason — left unmocked, real-mode test runs hit a dead backend
// (`/api/journal/decision` has no MSW handler), so the decisions block silently stayed empty and
// the inline review's `reviewDecision` call rejected with no `.catch` (mezo-b3pp.4 Task 7 review
// finding — the page still guards this with a `.catch(() => {})`, see JournalPage.tsx). The
// Mozaik re-face (mezo-d20.6.6) adds `useGratitudeEntries` to the same mock: the page now reads
// it directly for the hero's streak number, alongside GratitudeStreakCard's own call to the same
// hook for the tile below (one shared react-query cache key, not a second network mode to fake).
const hooks = vi.hoisted(() => ({
  useJournalNotes: vi.fn(),
  useJournalActions: vi.fn(),
  useDecisions: vi.fn(),
  useDecisionActions: vi.fn(),
  useGratitudeEntries: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useJournalNotes: hooks.useJournalNotes,
  useJournalActions: hooks.useJournalActions,
  useDecisions: hooks.useDecisions,
  useDecisionActions: hooks.useDecisionActions,
  useGratitudeEntries: hooks.useGratitudeEntries,
}))

// Pin "today" to 2026-08-15 so the widening window + Ma/Tegnap labels are deterministic.
vi.mock('@/shared/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/dates')>()),
  localDateString: () => '2026-08-15',
}))

function note(over: Partial<JournalNote> = {}): JournalNote {
  return {
    id: 'jn-1',
    occurredOn: '2026-08-10',
    text: 'Augusztusi bejegyzés',
    source: 'quickinput',
    createdAt: '2026-08-10T08:00:00.000Z',
    ...over,
  }
}

function decision(over: Partial<DecisionEntry> = {}): DecisionEntry {
  return {
    id: 'dec2',
    decidedOn: '2026-07-21',
    decisionText: 'Esti edzésre váltok a reggeli helyett, mert reggel sosem alszom eleget.',
    reviewDue: '2026-08-15',
    reviewedAt: null,
    outcomeRating: null,
    outcomeText: null,
    createdAt: '2026-07-21T21:30:00Z',
    ...over,
  }
}

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/naplo']}>
        <JournalPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

const actions = { addNote: vi.fn(), updateNote: vi.fn(), removeNote: vi.fn(), pending: false }

beforeEach(() => {
  hooks.useJournalActions.mockReturnValue(actions)
  // Default: no open decisions, so the "Döntések" block stays out of the way for tests that
  // aren't exercising it — individual tests below override this.
  hooks.useDecisions.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisionActions.mockReturnValue({ addDecision: vi.fn(), reviewDecision: vi.fn().mockResolvedValue(undefined), pending: false })
  // Default: an empty gratitude window — the hero shows "0 napos hála-sorozat · 0 bejegyzés" and
  // the tile below shows its own honest empty copy. Individual tests override for the streak
  // fixtures.
  hooks.useGratitudeEntries.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
})
afterEach(() => vi.clearAllMocks())

test('renders the Napló hero and the back chip', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  expect(screen.getByText('Napló')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(screen.getByText('‹ Én')).toBeInTheDocument()
})

test('the hero shows the honest streak derived from the gratitude fixture', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useGratitudeEntries.mockReturnValue({
    data: [
      { id: 'g1', occurredOn: '2026-08-15', text: 'a', lifeArea: null, createdAt: '' },
      { id: 'g2', occurredOn: '2026-08-14', text: 'b', lifeArea: null, createdAt: '' },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  renderPage()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('napos hála-sorozat · 2 bejegyzés')).toBeInTheDocument()
})

test('while the gratitude fetch is pending the hero omits the streak number rather than showing 0', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useGratitudeEntries.mockReturnValue({ data: [], isPending: true, isError: false, refetch: vi.fn() })
  renderPage()
  expect(screen.queryByText(/napos hála-sorozat/)).not.toBeInTheDocument()
})

test('groups a two-month fixture under separate month separators, newest first', () => {
  const notes = [
    note({ id: 'jn-aug', occurredOn: '2026-08-10', text: 'Augusztusi bejegyzés' }),
    note({ id: 'jn-jul', occurredOn: '2026-07-05', text: 'Júliusi bejegyzés' }),
  ]
  hooks.useJournalNotes.mockReturnValue({ data: notes, isPending: false, isError: false, refetch: vi.fn() })
  const { container } = renderPage()
  // `.mem-month` is the month-separator's own class (distinct from the "Döntések" eyebrow, which
  // shares `.mz-eyebrow` but never `.mem-month`) — proves two distinct separators render, newest
  // month first.
  const separators = container.querySelectorAll('.mem-month')
  expect(separators).toHaveLength(2)
  expect(separators[0].textContent).toMatch(/augusztus/i)
  expect(separators[1].textContent).toMatch(/július/i)
  expect(screen.getByText('Augusztusi bejegyzés')).toBeInTheDocument()
  expect(screen.getByText('Júliusi bejegyzés')).toBeInTheDocument()
})

test('tapping an entry opens the edit sheet, prefilled with its text', async () => {
  const notes = [note({ id: 'jn-1', occurredOn: '2026-08-10', text: 'Fáradt vagyok, de motivált' })]
  hooks.useJournalNotes.mockReturnValue({ data: notes, isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  await userEvent.click(screen.getByText('Fáradt vagyok, de motivált'))
  expect(await screen.findByText('Bejegyzés szerkesztése')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Fáradt vagyok, de motivált')).toBeInTheDocument()
})

test('the add button opens the sheet in create mode', async () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Új bejegyzés/ }))
  expect(await screen.findByText('Mi jár a fejedben?')).toBeInTheDocument()
})

test('empty fixture shows the ghost state', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  expect(screen.getByText('Még nincs bejegyzés — kezdd a + gombbal.')).toBeInTheDocument()
})

test('loading state shows skeleton rows, not the ghost state', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: true, isError: false, refetch: vi.fn() })
  renderPage()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(screen.queryByText('Még nincs bejegyzés — kezdd a + gombbal.')).not.toBeInTheDocument()
})

test('"Korábbi hónapok" widens the window (a new range is requested from useJournalNotes)', async () => {
  hooks.useJournalNotes.mockReturnValue({
    data: [note()], isPending: false, isError: false, refetch: vi.fn(),
  })
  renderPage()
  const callsBefore = hooks.useJournalNotes.mock.calls.length
  await userEvent.click(screen.getByRole('button', { name: 'Korábbi hónapok' }))
  const callsAfter = hooks.useJournalNotes.mock.calls
  expect(callsAfter.length).toBeGreaterThan(callsBefore)
  const [lastFrom] = callsAfter[callsAfter.length - 1]
  const [firstFrom] = callsAfter[0]
  expect(lastFrom < firstFrom).toBe(true)
})

test('an empty current window still offers "Korábbi hónapok" (older notes may sit outside it), and it requests an earlier `from`', async () => {
  // The current 3-month window has no notes — but that doesn't mean the user has none, only that
  // their newest entry predates the window. Without a widen affordance here the ghost state would
  // strand them (mezo-b3pp.1 review finding). GhostState's own ctaLabel/onCta carries it, wired to
  // the same widen handler the in-list footer button uses.
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  const callsBefore = hooks.useJournalNotes.mock.calls.length
  await userEvent.click(screen.getByRole('button', { name: 'Korábbi hónapok' }))
  const callsAfter = hooks.useJournalNotes.mock.calls
  expect(callsAfter.length).toBeGreaterThan(callsBefore)
  const [firstFrom] = callsAfter[0]
  const [lastFrom] = callsAfter[callsAfter.length - 1]
  expect(lastFrom < firstFrom).toBe(true)
})

test('a failed fetch shows the retry state, not the create-invite empty state', async () => {
  const refetch = vi.fn()
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: true, refetch })
  renderPage()
  expect(screen.getByText('Nem sikerült betölteni a naplót.')).toBeInTheDocument()
  expect(screen.queryByText('Még nincs bejegyzés — kezdd a + gombbal.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  expect(refetch).toHaveBeenCalledTimes(1)
})

test('an error with stale-but-present notes falls through to the normal list (not the retry state)', () => {
  hooks.useJournalNotes.mockReturnValue({
    data: [note({ text: 'Régi, de meglévő bejegyzés' })], isPending: false, isError: true, refetch: vi.fn(),
  })
  renderPage()
  expect(screen.getByText('Régi, de meglévő bejegyzés')).toBeInTheDocument()
  expect(screen.queryByText('Nem sikerült betölteni a naplót.')).not.toBeInTheDocument()
})

// The decisions block reads `useDecisions` off the barrel mock (fixtures below), not a real or
// MSW-backed fetch — dec2's reviewDue (2026-08-15) is pinned to this file's frozen "today" so the
// due state is deterministic (isDecisionDue itself stays real/unmocked, a pure function).
test('lists open decisions with a due chip', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({
    data: [decision()],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('Döntések')).toBeInTheDocument()
  expect(screen.getByText('Nézd vissza')).toBeInTheDocument()
  expect(screen.getByText(/Esti edzésre váltok/)).toBeInTheDocument()
})

// mezo-d20.6.6: the gold decision card reviews INLINE (prototype #page-naplo .decrow) — no sheet.
// Tapping a rating both calls the same `reviewDecision` mutation the old sheet used AND settles
// the card to the sage acknowledgement without waiting for a refetch.
test('tapping a rating settles the card to the sage acknowledgement and calls reviewDecision', async () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({ data: [decision()], isPending: false, isError: false, refetch: vi.fn() })
  const reviewDecision = vi.fn().mockResolvedValue(undefined)
  hooks.useDecisionActions.mockReturnValue({ addDecision: vi.fn(), reviewDecision, pending: false })
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: '5 · bevált' }))

  expect(reviewDecision).toHaveBeenCalledWith('dec2', 5)
  expect(await screen.findByText('✓ Visszanézve · 5/5')).toBeInTheDocument()
  expect(screen.queryByText(/Esti edzésre váltok/)).not.toBeInTheDocument()
})

test('a lower rating (1–4) also settles the card, with that rating in the acknowledgement', async () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({ data: [decision()], isPending: false, isError: false, refetch: vi.fn() })
  const reviewDecision = vi.fn().mockResolvedValue(undefined)
  hooks.useDecisionActions.mockReturnValue({ addDecision: vi.fn(), reviewDecision, pending: false })
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: '2' }))

  expect(reviewDecision).toHaveBeenCalledWith('dec2', 2)
  expect(await screen.findByText('✓ Visszanézve · 2/5')).toBeInTheDocument()
})

test('does not list already-reviewed decisions among the open ones', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({
    data: [
      decision(),
      decision({
        id: 'dec1',
        decidedOn: '2026-06-10',
        decisionText: 'Kihagyom a nyári versenyt, és inkább alapozok.',
        reviewDue: '2026-07-10',
        reviewedAt: '2026-07-11T08:00:00Z',
        outcomeRating: 4,
        outcomeText: 'Jó döntés volt, ősszel sokkal frissebb voltam.',
      }),
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  })
  renderPage()
  expect(screen.getByText('Döntések')).toBeInTheDocument()

  expect(screen.queryByText(/Kihagyom a nyári versenyt/)).not.toBeInTheDocument()
})

// mezo-b3pp.4 Task 7 review finding: JournalPage previously destructured only `data` from
// useDecisions, discarding isError — a failed decisions fetch rendered as nothing at all (an
// overdue decision silently vanishing with no signal), unlike the notes list's own isError branch.
test('a failed decisions fetch shows a retry state instead of silently vanishing', async () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  const refetchDecisions = vi.fn()
  hooks.useDecisions.mockReturnValue({ data: [], isPending: false, isError: true, refetch: refetchDecisions })
  renderPage()

  expect(await screen.findByText('Nem sikerült betölteni a döntéseket.')).toBeInTheDocument()
  expect(screen.queryByText('Döntések')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  expect(refetchDecisions).toHaveBeenCalledTimes(1)
})

test('a decisions error with stale-but-present open decisions falls through to the normal list', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({
    data: [decision()],
    isPending: false,
    isError: true,
    refetch: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('Döntések')).toBeInTheDocument()
  expect(screen.queryByText('Nem sikerült betölteni a döntéseket.')).not.toBeInTheDocument()
})

// ── mezo-d20.11 (1:1 fidelity audit) ────────────────────────────────────────────────────────

// The prototype prints the question under the 1–5 row (#page-naplo .decrow + .foot9). It was
// only an aria-label here, so a sighted user saw five bare digits with no prompt.
test('the decision card prints the 1–5 question visibly, not just as an aria-label', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({ data: [decision()], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()

  expect(screen.getByText('Mennyire vált be? (1–5)')).toBeInTheDocument()
})

// LOST-FUNCTION REPAIR: between mezo-d20.6.6 and mezo-d20.11 nothing mounted DecisionReviewSheet,
// so `reviewDecision` was permanently called WITHOUT its third argument and a review could no
// longer record outcome prose — even though DecisionReviewRequest.outcome, its column and the
// embedding path that reads it are all live. The sage acknowledgement now carries the door to it.
test('the sage acknowledgement re-opens the review sheet so outcome prose can still be recorded', async () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  hooks.useDecisions.mockReturnValue({ data: [decision()], isPending: false, isError: false, refetch: vi.fn() })
  const reviewDecision = vi.fn().mockResolvedValue(undefined)
  hooks.useDecisionActions.mockReturnValue({ addDecision: vi.fn(), reviewDecision, pending: false })
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: '4' }))
  expect(reviewDecision).toHaveBeenLastCalledWith('dec2', 4)

  await user.click(screen.getByRole('button', { name: 'Mi lett belőle?' }))
  // The sheet opens PREFILLED with the rating the inline row just committed — so the second
  // save is the same review, now carrying the prose, not a fresh unrated one.
  await user.type(screen.getByRole('textbox', { name: /Hogyan sült el/i }), 'Végül tartotta magát.')
  await user.click(screen.getByRole('button', { name: 'Mentem' }))

  expect(reviewDecision).toHaveBeenLastCalledWith('dec2', 4, 'Végül tartotta magát.')
})
