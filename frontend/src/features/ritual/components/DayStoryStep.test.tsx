import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DayStoryStep } from '@/features/ritual/components/DayStoryStep'
import type { DayRecap } from '@/data/ritual/recapHooks'
import type { CheckinSlot } from '@/data/types'

// Force reduced-motion so the np-draw/np-pop/np-anim entrance choreography never masks
// content under jsdom (stubReduced pattern, RitualPage.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// DayStoryStep is a pure presentational composition over useCheckins + useDayRecap — stub
// both directly (the ActivityLogCard.test.tsx precedent) so the assertions are data-driven
// and identical regardless of VITE_USE_MOCK (both-modes gate is then trivially satisfied).
const mocks = vi.hoisted(() => ({ useCheckins: vi.fn(), useDayRecap: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useCheckins: mocks.useCheckins,
  useDayRecap: mocks.useDayRecap,
}))

const checkins: CheckinSlot[] = [
  { time: '08:00', state: 'done', values: null, note: null },
  { time: '12:00', state: 'done', values: null, note: null },
  { time: '16:00', state: 'now', values: null, note: null },
  { time: '20:00', state: 'pending', values: null, note: null },
]

const recap: DayRecap = {
  events: [
    { icon: 'i-edzes', label: 'Pull A — kész', meta: '17:30 ✓', done: true },
    { icon: 'i-fuel', label: '4 étkezés', meta: '132 g fehérje', done: false },
  ],
  checkinsDone: 2,
  thinDay: false,
  closingNote: null,
}

function setup(overrides?: Partial<DayRecap>) {
  mocks.useCheckins.mockReturnValue({ checkins, saveCheckIn: vi.fn() })
  mocks.useDayRecap.mockReturnValue({ ...recap, ...overrides })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('DayStoryStep', () => {
  test('renders the header, the arc, and one .rz-ev row per recap event with icon/label/meta', () => {
    stubReduced()
    setup()
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)

    expect(screen.getByText('A napod íve')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'A napod íve — összegzés' })).toBeInTheDocument()

    const rows = container.querySelectorAll('.rz-ev')
    expect(rows).toHaveLength(recap.events.length)
    expect(screen.getByText('Pull A — kész')).toBeInTheDocument()
    expect(screen.getByText('17:30 ✓')).toBeInTheDocument()
    expect(screen.getByText('4 étkezés')).toBeInTheDocument()
    expect(screen.getByText('132 g fehérje')).toBeInTheDocument()
  })

  test('done rows carry .ok, not-done rows do not', () => {
    stubReduced()
    setup()
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)
    const rows = container.querySelectorAll('.rz-ev')

    expect(rows[0].querySelector('.ok')).not.toBeNull() // Pull A — done: true
    expect(rows[1].querySelector('.ok')).toBeNull() // 4 étkezés — done: false
  })

  test('thinDay renders the soft acceptance line above whatever events exist — never a gap list', () => {
    stubReduced()
    setup({ thinDay: true })
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)

    expect(screen.getByText('Ma ennyi fért bele. Az is számít.')).toBeInTheDocument()
    // events still render — thinDay never replaces the list with nothing
    expect(container.querySelectorAll('.rz-ev')).toHaveLength(recap.events.length)
  })

  test('thinDay is false renders no soft line', () => {
    stubReduced()
    setup({ thinDay: false })
    render(<DayStoryStep onNext={vi.fn()} />)
    expect(screen.queryByText('Ma ennyi fért bele. Az is számít.')).not.toBeInTheDocument()
  })

  test('Tovább advances to the next act', async () => {
    stubReduced()
    setup()
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<DayStoryStep onNext={onNext} />)

    await user.click(screen.getByText('Tovább'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
