import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { LoopsStep } from '@/features/ritual/components/LoopsStep'
import type { CheckinSlot, IntentionDay } from '@/data/types'

// Force reduced-motion so the np-anim entrance choreography never masks content under jsdom
// (stubReduced pattern, DayStoryStep.test.tsx precedent).
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

// LoopsStep composes useCheckins + useIntentionDay/useIntentionActions directly — stub all
// three (the DayStoryStep.test.tsx precedent) so assertions are data-driven and identical
// regardless of VITE_USE_MOCK (both-modes gate trivially satisfied).
const mocks = vi.hoisted(() => ({
  useCheckins: vi.fn(),
  useIntentionDay: vi.fn(),
  useIntentionActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useCheckins: mocks.useCheckins,
  useIntentionDay: mocks.useIntentionDay,
  useIntentionActions: mocks.useIntentionActions,
}))

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot => ({ time, state, values: null, note: null })

const DONE_CHECKINS: CheckinSlot[] = [
  slot('08:00', 'done'), slot('12:00', 'done'), slot('16:00', 'done'), slot('20:00', 'done'),
]
const OPEN_CHECKINS: CheckinSlot[] = [
  slot('08:00', 'done'), slot('12:00', 'done'), slot('16:00', 'done'), slot('20:00', 'now'),
]

const FOCUS = { id: 'f1', focusDate: '2026-07-25', text: 'Jelenlét a meetingen' }
const intentionDay = (overrides: Partial<IntentionDay> = {}): IntentionDay => ({
  date: '2026-07-25', creed: 'Jelen lenni.', foci: [], reflection: null, focusCap: 3, ...overrides,
})

function setup(opts: { checkins: CheckinSlot[]; intention: IntentionDay; reflect?: ReturnType<typeof vi.fn> }) {
  const reflect = opts.reflect ?? vi.fn()
  mocks.useCheckins.mockReturnValue({ checkins: opts.checkins, saveCheckIn: vi.fn() })
  mocks.useIntentionDay.mockReturnValue({ data: opts.intention, isPending: false })
  mocks.useIntentionActions.mockReturnValue({
    reflect, setCreed: vi.fn(), addFocus: vi.fn(), removeFocus: vi.fn(), pending: false,
  })
  return { reflect }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('LoopsStep', () => {
  test('an open check-in renders the glowing row + fires onOpenCheckIn on Koppints', async () => {
    stubReduced()
    setup({ checkins: OPEN_CHECKINS, intention: intentionDay() })
    const user = userEvent.setup()
    const onOpenCheckIn = vi.fn()
    const { container } = render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={onOpenCheckIn} onOpenJournal={vi.fn()} />)

    expect(screen.getByText('20:00 check-in kimaradt')).toBeInTheDocument()
    const glowing = container.querySelector('.rz-loop.glow')
    expect(glowing).not.toBeNull()
    expect(glowing?.textContent).toContain('check-in kimaradt')

    await user.click(screen.getByRole('button', { name: 'Koppints' }))
    expect(onOpenCheckIn).toHaveBeenCalledTimes(1)
  })

  test('a fully-done check-in day renders the dim summary row, not the open row', () => {
    stubReduced()
    setup({ checkins: DONE_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: null }) })
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    expect(screen.getByText('4/4 check-in kész')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Koppints' })).not.toBeInTheDocument()
  })

  test('the reflect row renders inline Igen/Részben/Nem buttons that call reflect(v) directly', async () => {
    stubReduced()
    const { reflect } = setup({ checkins: DONE_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: null }) })
    const user = userEvent.setup()
    const { container } = render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    expect(screen.getByText('Szándékkal élted a napot?')).toBeInTheDocument()
    expect(container.querySelector('.rz-loop.glow')?.textContent).toContain('Szándékkal élted a napot?')

    await user.click(screen.getByRole('button', { name: 'Részben' }))
    expect(reflect).toHaveBeenCalledWith('partial')
  })

  test('once reflection is set, the reflect row collapses to the checkmark line (no buttons)', () => {
    stubReduced()
    // check-in stays open so the "nothing open" beat does not swallow the collapse row too.
    setup({ checkins: OPEN_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: 'yes' }) })
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    expect(screen.getByText('A mai szándékodra reflektáltál.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Igen' })).not.toBeInTheDocument()
  })

  test('no focus at all renders no reflect row, in either form', () => {
    stubReduced()
    setup({ checkins: OPEN_CHECKINS, intention: intentionDay({ foci: [], reflection: null }) })
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    expect(screen.queryByText('Szándékkal élted a napot?')).not.toBeInTheDocument()
    expect(screen.queryByText('A mai szándékodra reflektáltál.')).not.toBeInTheDocument()
  })

  test('the journal row always renders and fires onOpenJournal on Napló, regardless of other loop state', async () => {
    stubReduced()
    setup({ checkins: DONE_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: 'yes' }) })
    const user = userEvent.setup()
    const onOpenJournal = vi.fn()
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={onOpenJournal} />)

    expect(screen.getByText('Történt még valami ma?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Napló' }))
    expect(onOpenJournal).toHaveBeenCalledTimes(1)
  })

  test('nothing open (check-ins done, reflected) shows the single "Minden hurok zárva" beat, not the individual closed rows', () => {
    stubReduced()
    setup({ checkins: DONE_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: 'partial' }) })
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    expect(screen.getByText('Minden hurok zárva ✓')).toBeInTheDocument()
    expect(screen.queryByText('4/4 check-in kész')).not.toBeInTheDocument()
    expect(screen.queryByText('A mai szándékodra reflektáltál.')).not.toBeInTheDocument()
    // the journal invite is evergreen — still present even once the beat replaces the rest
    expect(screen.getByText('Történt még valami ma?')).toBeInTheDocument()
  })

  test('nothing open with no focus at all also shows the beat', () => {
    stubReduced()
    setup({ checkins: DONE_CHECKINS, intention: intentionDay({ foci: [], reflection: null }) })
    render(<LoopsStep onNext={vi.fn()} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)
    expect(screen.getByText('Minden hurok zárva ✓')).toBeInTheDocument()
  })

  test('Tovább always fires onNext, even with open loops remaining (soft — nothing mandatory)', async () => {
    stubReduced()
    setup({ checkins: OPEN_CHECKINS, intention: intentionDay({ foci: [FOCUS], reflection: null }) })
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<LoopsStep onNext={onNext} onOpenCheckIn={vi.fn()} onOpenJournal={vi.fn()} />)

    await user.click(screen.getByText('Tovább'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
