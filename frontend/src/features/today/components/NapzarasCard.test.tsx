import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { NapzarasCard } from '@/features/today/components/NapzarasCard'
import type { NormalizedDayEvaluation } from '@/data/me/dayEvaluation'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const evaluation = (dims: Partial<Record<string, unknown>> = {}): NormalizedDayEvaluation => ({
  date: '2026-09-24', state: 'in_progress', score: null, base: null, reviewId: null,
  adjustment: null, narrative: [], highlights: [], context: [],
  dimensions: [
    { id: 'nutrition', label: 'Táplálkozás', weight: 0.3, score: 80, status: 'DONE', facts: [], note: null },
    { id: 'quality', label: 'Minőség', weight: 0.1, score: 80, status: 'DONE', facts: [], note: null },
    { id: 'training', label: 'Edzés', weight: 0.2, score: 90, status: 'DONE', facts: [{ label: 'edzés', value: '1 / 1' }], note: null },
    { id: 'sleep', label: 'Alvás', weight: 0.15, score: null, status: 'NO_DATA', facts: [], note: null },
    { id: 'logging', label: 'Naplózás', weight: 0.15, score: null, status: 'IN_PROGRESS', facts: [], note: null },
    { id: 'rhythm', label: 'Ritmus', weight: 0.1, score: null, status: 'NO_DATA', facts: [], note: null },
  ] as NormalizedDayEvaluation['dimensions'],
  ...dims,
})

const store = vi.hoisted(() => ({
  ritualClosed: false,
  kcal: 1800 as number | null,
  checkins: [{ state: 'done' }, { state: 'done' }, { state: 'now' }, { state: 'pending' }],
}))
vi.mock('@/data/hooks', () => ({
  useRitualDay: () => ({ data: { closed: store.ritualClosed }, isPending: false }),
  useFuelDay: () => ({ fuel: { consumed: { kcal: store.kcal } }, isPending: false }),
  useCheckins: () => ({ checkins: store.checkins }),
  useDayEvaluation: () => ({ data: evaluation(), isPending: false }),
  normalizeDayEvaluation: (raw: NormalizedDayEvaluation) => raw,
}))

function renderCard(now: Date) {
  return render(<MemoryRouter><NapzarasCard now={now} /></MemoryRouter>)
}

afterEach(() => {
  store.ritualClosed = false
  store.kcal = 1800
  store.checkins = [{ state: 'done' }, { state: 'done' }, { state: 'now' }, { state: 'pending' }]
})

test('before 20:00 renders nothing', () => {
  renderCard(new Date(2026, 8, 24, 19, 59))
  expect(screen.queryByText('Tegyük le a napot.')).toBeNull()
})

test('after midnight (00:30) renders nothing — the window ends at midnight', () => {
  renderCard(new Date(2026, 8, 25, 0, 30))
  expect(screen.queryByText('Tegyük le a napot.')).toBeNull()
  expect(screen.queryByText('Letetted a napot')).toBeNull()
})

test('after 20:00 and not closed: card with CTA to /ritual', async () => {
  renderCard(new Date(2026, 8, 24, 20, 1))
  expect(screen.getByText('Tegyük le a napot.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Napzárás indítása' }))
  expect(mockNavigate).toHaveBeenCalledWith('/ritual')
})

test('after closing: the compact done row links to A napom', () => {
  store.ritualClosed = true
  renderCard(new Date(2026, 8, 24, 21, 0))
  expect(screen.getByText('Letetted a napot')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'A napom ›' })).toHaveAttribute('href', '/nap/napom')
})

test('the kcal chip uses the HU thousands separator and every fact chip leads with its icon', () => {
  store.kcal = 2060
  const { container } = renderCard(new Date(2026, 8, 24, 20, 1))
  expect(screen.getByText('2 060 kcal')).toBeInTheDocument()
  const hrefs = [...container.querySelectorAll('.nap-zchips use')].map((u) => u.getAttribute('href'))
  expect(hrefs).toEqual(['#t-bowl', '#t-dumbbell', '#t-checkin'])
})

test('renders known chips and omits the kcal chip when unknown', () => {
  store.kcal = null
  renderCard(new Date(2026, 8, 24, 20, 1))
  expect(screen.getByText('edzés 1 / 1')).toBeInTheDocument()
  expect(screen.getByText('check-in 2/4')).toBeInTheDocument()
  expect(screen.getByText('3/6 terület kész')).toBeInTheDocument()
  expect(screen.queryByText(/kcal$/)).toBeNull()
})
