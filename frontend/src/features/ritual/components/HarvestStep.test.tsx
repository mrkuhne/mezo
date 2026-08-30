import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HarvestStep } from '@/features/ritual/components/HarvestStep'
import { mockGamificationDay } from '@/data/gamification/gamificationDayMock'
import { progressionProfileMock } from '@/data/progression/progressionMock'
import type { GamificationDay } from '@/data/gamification/gamificationTypes'
import { localDateString } from '@/shared/lib/dates'

// Force reduced-motion so the choreography (harvestStages' inline animationDelay + the
// np-anim/np-pop entrance classes) never masks content under jsdom (stubReduced pattern,
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
  test('renders the eyebrow, XP total, HU-labelled source chips, coin chips, the skill highlight, and an alive streak', () => {
    stubReduced()
    setup()
    const { container } = render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText('A MAI TERMÉS')).toBeInTheDocument()
    expect(screen.getByText('115')).toBeInTheDocument()

    // Label and amount are separate spans since the Mozaik night pass (mezo-d20.8.1.1) — the
    // chip is a night-washed tile with a clay spot, not one emoji-prefixed string.
    expect(screen.getByText('Küldetések')).toBeInTheDocument()
    expect(container.querySelector('.rz-chip-xp')).toHaveTextContent('+45')
    expect(screen.getByText('Rutin')).toBeInTheDocument()
    expect(screen.getByText('Napló')).toBeInTheDocument()
    expect(screen.getByText('Edzés')).toBeInTheDocument()
    // One clay spot per visible source, and the quest source resolves to i-kihivas.
    expect(container.querySelectorAll('.rz-chip .rz-nw-spot')).toHaveLength(4)
    expect(container.querySelector('.rz-chip use')).toHaveAttribute('href', '#i-kihivas')

    // Scoped to the coin row: a source chip also reads +20 (GYM), so a bare text query is ambiguous.
    const coins = [...container.querySelectorAll('.rz-coin-chip')].map((c) => c.textContent?.trim())
    expect(coins).toEqual(['+10', '+20'])
    expect(container.querySelectorAll('.rz-coin-chip use')).toHaveLength(2)

    // Skill highlight = the LIFE skill with the highest progressPct < 100 in the mock
    // profile: `connection` (Kapcsolatok, progressPct 60, Lv 1) — bar + level only, the
    // "még N XP a Lv M-ig" hint is deliberately dropped (no per-skill curve to derive it
    // from honestly — see HarvestStep.tsx's doc comment).
    expect(screen.getByText(/Kapcsolatok/)).toBeInTheDocument()
    expect(screen.getByText('Lv 1')).toBeInTheDocument()
    expect(screen.queryByText(/még.*XP/)).not.toBeInTheDocument()

    expect(screen.getByText(/12 napos sorozat él/)).toBeInTheDocument()
  })

  test('a dead streak dims the row and appends "— megszakadt" (the AppHero precedent)', () => {
    stubReduced()
    setup({ streakAlive: false })
    const { container } = render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText(/12 napos sorozat — megszakadt/)).toBeInTheDocument()
    expect(container.querySelector('.rz-streak')).toHaveClass('dim')
  })

  test('confetti bursts (10 particles) only when xpTotal > 0', () => {
    stubReduced()
    setup()
    const { container } = render(<HarvestStep onNext={vi.fn()} />)
    expect(container.querySelectorAll('.rz-conf i')).toHaveLength(10)
  })

  test('a thin (zero-XP) day renders no confetti', () => {
    stubReduced()
    setup({ xpTotal: 0, xpBySource: [], coinEvents: [], coinTotal: 0 })
    const { container } = render(<HarvestStep onNext={vi.fn()} />)
    expect(container.querySelector('.rz-conf')).toBeNull()
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
