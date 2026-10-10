import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DayStoryStep } from '@/features/ritual/components/DayStoryStep'
import type { DayRecap } from '@/data/ritual/recapHooks'
import type { CheckinSlot } from '@/data/types'

// Force reduced-motion so no entrance choreography ever masks
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
  test('renders the header, the arc, and one row per recap event with icon/label/meta', () => {
    stubReduced()
    setup()
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)

    expect(screen.getByText('A napod íve')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'A napod íve — összegzés' })).toBeInTheDocument()

    // the arc is the kit's liquid surface, with a dot per DONE check-in (2 of the 4 slots)
    expect(container.querySelectorAll('.nrz-arc svg.fo-area')).toHaveLength(1)
    expect(container.querySelectorAll('.nrz-arc circle[r="2"]')).toHaveLength(2)

    const rows = container.querySelectorAll('.fo-card .fo-row')
    expect(rows).toHaveLength(recap.events.length)
    expect(screen.getByText('Pull A — kész')).toBeInTheDocument()
    // The data's „✓" glyph renders as the tick mark (Folyadék kit `Mark`): the time stays as text.
    expect(screen.getByText('17:30')).toBeInTheDocument()
    expect(rows[0].querySelector('.fo-mk.d')).not.toBeNull()
    // each row wears its Folyadék-jel glyph: the workout the dumbbell, the meals the bowl
    expect(rows[0].querySelector('.si use')).toHaveAttribute('href', '#t-dumbbell')
    expect(screen.queryByText(/✓/)).not.toBeInTheDocument()
    expect(screen.getByText('4 étkezés')).toBeInTheDocument()
    expect(screen.getByText('132 g fehérje')).toBeInTheDocument()
  })

  test('done rows carry the ok value colour, not-done rows do not', () => {
    stubReduced()
    setup()
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)
    const rows = container.querySelectorAll('.fo-card .fo-row')

    expect(rows[0]).toHaveClass('nrz-ok') // Pull A — done: true
    expect(rows[1]).not.toHaveClass('nrz-ok') // 4 étkezés — done: false
    // …and only a done row the data marked „✓" carries the tick
    expect(rows[1].querySelector('.fo-mk')).toBeNull()
  })

  test('thinDay renders the soft acceptance line above whatever events exist — never a gap list', () => {
    stubReduced()
    setup({ thinDay: true })
    const { container } = render(<DayStoryStep onNext={vi.fn()} />)

    expect(screen.getByText('Ma ennyi fért bele. Az is számít.')).toBeInTheDocument()
    // events still render — thinDay never replaces the list with nothing
    expect(container.querySelectorAll('.fo-card .fo-row')).toHaveLength(recap.events.length)
    // …and it IS the verdict now, replacing the default one
    expect(screen.queryByText('Így telt a mai nap.')).not.toBeInTheDocument()
  })

  test('thinDay is false renders no soft line', () => {
    stubReduced()
    setup({ thinDay: false })
    render(<DayStoryStep onNext={vi.fn()} />)
    expect(screen.queryByText('Ma ennyi fért bele. Az is számít.')).not.toBeInTheDocument()
    expect(screen.getByText('Így telt a mai nap.')).toBeInTheDocument()
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
