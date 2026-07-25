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

// HarvestStep composes useGamificationDay + useProgressionProfile directly — stub both
// (the LoopsStep.test.tsx precedent) so assertions are data-driven and identical
// regardless of VITE_USE_MOCK (both-modes gate trivially satisfied).
const mocks = vi.hoisted(() => ({
  useGamificationDay: vi.fn(),
  useProgressionProfile: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useGamificationDay: mocks.useGamificationDay,
  useProgressionProfile: mocks.useProgressionProfile,
}))

// The approved Harvest seed (mezo-huzd R3): QUEST 45 / HABIT 35 / ACTIVITY 15 / GYM 20 ->
// 115 XP; coins +10/+20; a 12-day alive streak.
function setup(overrides: Partial<GamificationDay> = {}) {
  const day: GamificationDay = { ...mockGamificationDay(localDateString()), ...overrides }
  mocks.useGamificationDay.mockReturnValue({ data: day, isPending: false })
  mocks.useProgressionProfile.mockReturnValue({ data: progressionProfileMock, isPending: false })
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
    render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText('A MAI TERMÉS')).toBeInTheDocument()
    expect(screen.getByText('115')).toBeInTheDocument()

    expect(screen.getByText('📜 Küldetések +45')).toBeInTheDocument()
    expect(screen.getByText('☀️ Rutin +35')).toBeInTheDocument()
    expect(screen.getByText('✍️ Napló +15')).toBeInTheDocument()
    expect(screen.getByText('🏋️ Edzés +20')).toBeInTheDocument()

    expect(screen.getByText('🪙 +10')).toBeInTheDocument()
    expect(screen.getByText('🪙 +20')).toBeInTheDocument()

    // Skill highlight = the LIFE skill with the highest progressPct < 100 in the mock
    // profile: `connection` (Kapcsolatok, progressPct 60, Lv 1) — bar + level only, the
    // "még N XP a Lv M-ig" hint is deliberately dropped (no per-skill curve to derive it
    // from honestly — see HarvestStep.tsx's doc comment).
    expect(screen.getByText(/Kapcsolatok/)).toBeInTheDocument()
    expect(screen.getByText('Lv 1')).toBeInTheDocument()
    expect(screen.queryByText(/még.*XP/)).not.toBeInTheDocument()

    expect(screen.getByText('🔥 12 napos sorozat él')).toBeInTheDocument()
  })

  test('a dead streak dims the row and appends "— megszakadt" (the AppHero precedent)', () => {
    stubReduced()
    setup({ streakAlive: false })
    const { container } = render(<HarvestStep onNext={vi.fn()} />)

    expect(screen.getByText('🔥 12 napos sorozat — megszakadt')).toBeInTheDocument()
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
    expect(screen.getByText('📜 Küldetések +45')).toBeInTheDocument()
    expect(screen.queryByText(/\+5\b/)).not.toBeInTheDocument()
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
