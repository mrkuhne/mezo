import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { JournalPage } from '@/features/me/pages/JournalPage'
import { QueryWrapper } from '@/test/queryWrapper'
import type { JournalNote } from '@/data/journal/journalTypes'

// Barrel-mock the journal hooks so the fixtures drive the view deterministically in both
// mock and real test modes (GrowthPage.test.tsx idiom).
const hooks = vi.hoisted(() => ({
  useJournalNotes: vi.fn(),
  useJournalActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useJournalNotes: hooks.useJournalNotes,
  useJournalActions: hooks.useJournalActions,
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
})
afterEach(() => vi.clearAllMocks())

test('renders the Napló header', () => {
  hooks.useJournalNotes.mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() })
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Napló' })).toBeInTheDocument()
  expect(screen.getByText('Me · Napló')).toBeInTheDocument()
})

test('groups a two-month fixture under separate month separators, newest first', () => {
  const notes = [
    note({ id: 'jn-aug', occurredOn: '2026-08-10', text: 'Augusztusi bejegyzés' }),
    note({ id: 'jn-jul', occurredOn: '2026-07-05', text: 'Júliusi bejegyzés' }),
  ]
  hooks.useJournalNotes.mockReturnValue({ data: notes, isPending: false, isError: false, refetch: vi.fn() })
  const { container } = renderPage()
  // Scope to the month-separator elements (not the entry prose, which itself mentions the month
  // name for these fixtures) — proves two distinct separators render, newest month first.
  const separators = container.querySelectorAll('.eyebrow.text-tertiary')
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
