import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HarvestStep } from '@/features/ritual/components/HarvestStep'
import { mockGamificationDay } from '@/data/gamification/gamificationDayMock'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import type { GamificationDay } from '@/data/gamification/gamificationTypes'
import { localDateString } from '@/shared/lib/dates'

// Force reduced-motion so the choreography (harvestStages' inline animationDelay on the vessel's
// layers) never masks content under jsdom (stubReduced pattern,
// LevelUpScreen.test.tsx / LoopsStep.test.tsx precedent).
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

// HarvestStep composes useGamificationDay + useProgressionProfile + useNeedsSummary directly
// — stub all three (the LoopsStep.test.tsx precedent) so assertions are data-driven and
// identical regardless of VITE_USE_MOCK (both-modes gate trivially satisfied).
const mocks = vi.hoisted(() => ({
  useGamificationDay: vi.fn(),
  useProgressionProfile: vi.fn(),
  useNeedsSummary: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useGamificationDay: mocks.useGamificationDay,
  useProgressionProfile: mocks.useProgressionProfile,
  useNeedsSummary: mocks.useNeedsSummary,
}))

// The approved Harvest seed (mezo-huzd R3): QUEST 45 / HABIT 35 / ACTIVITY 15 / GYM 20 ->
// 115 XP; coins +10/+20; a 12-day alive streak.
function setup(overrides: Partial<GamificationDay> = {}, needsStreakDays = 0) {
  const day: GamificationDay = { ...mockGamificationDay(localDateString()), ...overrides }
  mocks.useGamificationDay.mockReturnValue({ data: day, isPending: false })
  mocks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock, isPending: false })
  mocks.useNeedsSummary.mockReturnValue({ data: { streakDays: needsStreakDays }, isPending: false })
  return { day }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('HarvestStep', () => {
  test('renders the label, the XP total, one vessel layer per HU-labelled source, the coins, the skill highlight, and an alive streak', () => {
    stubReduced()
    setup()
    const { container } = render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText('A mai termés')).toBeInTheDocument()
    expect(screen.getByText('115')).toBeInTheDocument()
    expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('+115 XP')
    expect(screen.getByText(/Ennyit gyűjtöttél ma, négy forrásból\./)).toBeInTheDocument()

    // One vessel (Folyadék, mezo-n4wf5.2): a layer per visible source, heaviest at the bottom, and
    // the list beside it — the amount and the label, no icon.
    expect(container.querySelectorAll('.nrz-strata .v i')).toHaveLength(4)
    const rows = [...container.querySelectorAll('.nrz-strata li')].map((li) => li.textContent)
    expect(rows).toEqual(['+45Küldetések', '+35Rutin', '+20Edzés', '+15Napló'])
    // a layer is as tall as the XP it brought
    expect((container.querySelector('.nrz-strata .v i') as HTMLElement).style.flexGrow).toBe('45')

    // The coins are ONE row with the day's sum (10 + 20).
    expect(container.querySelector('.nrz-coins')).toHaveTextContent('Érme')
    expect(container.querySelector('.nrz-coins .v')).toHaveTextContent('+30')

    // Skill highlight = the LIFE skill with the highest progressPct < 100 in the mock
    // profile: `connection` (Kapcsolatok, progressPct 60, Lv 1) — level bar + level only, the
    // "még N XP a Lv M-ig" hint is deliberately dropped (no per-skill curve to derive it
    // from honestly — see HarvestStep.tsx's doc comment).
    expect(screen.getByText(/Kapcsolatok/)).toBeInTheDocument()
    expect(screen.getByText('Lv 1')).toBeInTheDocument()
    expect(container.querySelector('.fo-row .fo-level i')).toHaveStyle({ width: '60%' })
    expect(screen.queryByText(/még.*XP/)).not.toBeInTheDocument()

    expect(screen.getByText(/12 napos sorozat él/)).toBeInTheDocument()
    expect(container.querySelector('.nrz-streak')).not.toHaveClass('dim')
  })

  test('a dead streak dims the row and appends "— megszakadt" (the AppHero precedent)', () => {
    stubReduced()
    setup({ streakAlive: false })
    const { container } = render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText(/12 napos sorozat — megszakadt/)).toBeInTheDocument()
    expect(container.querySelector('.nrz-streak')).toHaveClass('dim')
  })

  test('the dark skin\'s confetti is gone — the filling vessel is the celebration', () => {
    stubReduced()
    setup()
    const { container } = render(<HarvestStep onNext={vi.fn()} />)
    expect(container.querySelector('.rz-conf')).toBeNull()
    expect(container.querySelectorAll('.nrz-strata .v')).toHaveLength(1)
  })

  test('a thin (zero-XP) day shows an empty vessel and the soft acceptance line, no coin row', () => {
    stubReduced()
    setup({ xpTotal: 0, xpBySource: [], coinEvents: [], coinTotal: 0 })
    const { container } = render(<HarvestStep onNext={vi.fn()} />)
    expect(container.querySelector('.fo-hero-verdict')).toHaveTextContent('+0 XP')
    expect(container.querySelectorAll('.nrz-strata .v')).toHaveLength(1)
    expect(container.querySelectorAll('.nrz-strata .v i')).toHaveLength(0)
    expect(screen.getByText('Ma ennyi fért bele. Az is számít.')).toBeInTheDocument()
    expect(screen.queryByText(/forrásból/)).not.toBeInTheDocument()
    expect(container.querySelector('.nrz-coins')).toBeNull()
  })

  test('an unmapped xp source is skipped defensively (the wire\'s open string type)', () => {
    stubReduced()
    setup({ xpBySource: [{ source: 'MEAL', xp: 5 }, { source: 'QUEST', xp: 45 }] })
    render(<HarvestStep onNext={vi.fn()} />)
    expect(screen.getByText('Küldetések')).toBeInTheDocument()
    expect(screen.queryByText(/\+5\b/)).not.toBeInTheDocument()
  })

  test('a positive needs streak renders the "napja életben" line', () => {
    stubReduced()
    setup({}, 4)
    render(<HarvestStep onNext={vi.fn()} />)
    expect(screen.getByText(/4 napja életben/)).toBeInTheDocument()
  })

  test('a zero needs streak renders no "napja életben" line', () => {
    stubReduced()
    setup({}, 0)
    render(<HarvestStep onNext={vi.fn()} />)
    expect(screen.queryByText(/napja életben/)).not.toBeInTheDocument()
  })

  test('Tovább fires onNext', async () => {
    stubReduced()
    setup()
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<HarvestStep onNext={onNext} />)
    await user.click(screen.getByText('Tovább'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
