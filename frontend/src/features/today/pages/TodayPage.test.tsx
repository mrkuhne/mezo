import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { today, user, workout, workoutPrediction, volleyballNote } from '@/data/today/today'
import type { VolleyballSession } from '@/data/types'

// useToday is mocked here (not for the other today.* hooks) so the composition tests below
// — esp. the hero-slot swap — are deterministic regardless of ambient VITE_USE_MOCK: real mode
// loads `workout` async (React Query), which would otherwise race the synchronous assertions.
// useTodayScenario/useCheckins/useCompanionNote/resolveBriefing/useQuickStats/etc. stay real
// (importOriginal), so the dual-mode gate still exercises them per ambient mode.
const hooks = vi.hoisted(() => ({
  useToday: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useToday: hooks.useToday,
  // IntentionBanner (mounted under the greeting) is stubbed to an empty, settled day so the
  // composition tests stay deterministic regardless of ambient VITE_USE_MOCK — the banner renders
  // its "no creed yet" state and contributes no headings/labels the assertions below rely on.
  useIntentionDay: () => ({
    data: { date: '2026-07-20', creed: null, foci: [], reflection: null, focusCap: 3 },
    isPending: false,
  }),
  useIntentionActions: () => ({
    setCreed: async () => {}, addFocus: async () => {}, removeFocus: async () => {},
    reflect: async () => {}, pending: false,
  }),
}))

const baseTodayData = {
  today, user, briefing: null, briefingDemo: false,
  workout, workoutTime: today.workoutTime, prediction: workoutPrediction,
  volleyballSessions: [] as VolleyballSession[], volleyballNote,
}

beforeEach(() => {
  hooks.useToday.mockReturnValue(baseTodayData)
})

// LevelUpProvider: production mounts it once in AppLayout; TodayQuestsCard (via useLevelUp)
// needs it here the same way GrowthPage.test wraps it for DailyQuestsCard.
const renderAt = (path: string) => render(
  <QueryWrapper>
    <LevelUpProvider>
      <MemoryRouter initialEntries={[path]}><TodayPage /></MemoryRouter>
    </LevelUpProvider>
  </QueryWrapper>,
)

test('default (medium) renders the Napiv order: greeting, day arc, hero workout, briefing, check-ins, quick stats — not AnchorMode', () => {
  renderAt('/today')
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'A napod íve' })).toBeInTheDocument()
  // The hero workout teaser's <h2>. 'Pull Day' now ALSO appears in the fuel-preview's
  // computed workout slot (the unified mock plan surfaces the block), so target the heading.
  expect(screen.getByRole('heading', { name: 'Pull Day' })).toBeInTheDocument()
  expect(screen.getByText(/briefing/i)).toBeInTheDocument()
  expect(screen.getByText('Hogy vagy ma?')).toBeInTheDocument()
  expect(screen.getByText('Ma eddig')).toBeInTheDocument()
  expect(screen.queryByText(/Anchor mode/)).not.toBeInTheDocument()
})

test('action-first zones: both dividers render, quests sit between the hero and the check-in strip, briefing comes after', () => {
  renderAt('/today')
  expect(screen.getByRole('separator', { name: 'Teendők ma' })).toBeInTheDocument()
  expect(screen.getByRole('separator', { name: 'A napod' })).toBeInTheDocument()
  // document order: hero → Teendők (quests + check-in) → A napod (briefing …)
  const hero = screen.getByRole('heading', { name: 'Pull Day' }) // the hero teaser <h2> (not the fuel-preview mention)
  const teendok = screen.getByRole('separator', { name: 'Teendők ma' })
  const strip = screen.getByText('Hogy vagy ma?')
  const napod = screen.getByRole('separator', { name: 'A napod' })
  const briefing = screen.getByText(/briefing/i)
  const order = [hero, teendok, strip, napod, briefing]
  for (let i = 0; i + 1 < order.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
})

test('the GrowthTodayRow summary row is retired (its job moved into the quest card header)', () => {
  renderAt('/today')
  expect(screen.queryByText('Növekedés ma')).not.toBeInTheDocument()
})

test('removed teasers no longer render: reta phase bar, meso date header, insights teaser', () => {
  renderAt('/today')
  expect(screen.queryByText(/Retatrutide/)).not.toBeInTheDocument()
  expect(screen.queryByText(`Week ${user.weekInMeso} · Day ${user.dayInWeek}`)).not.toBeInTheDocument()
  expect(screen.queryByText('Insights → Patterns')).not.toBeInTheDocument()
})

test('day=rough renders AnchorMode instead of the normal screen', () => {
  renderAt('/today?day=rough')
  expect(screen.getByText(/Anchor mode · csendben/)).toBeInTheDocument()
  expect(screen.queryByText('Ma eddig')).not.toBeInTheDocument()
})

test('vulnerable=on shows the vulnerability card', () => {
  renderAt('/today?vulnerable=on')
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})

test('rest day (no workout): the volleyball session becomes the hero slot and is not repeated below', () => {
  const session: VolleyballSession = {
    day: 'Csü', time: '19:30', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés', today: true,
  }
  hooks.useToday.mockReturnValue({ ...baseTodayData, workout: null, workoutTime: null, volleyballSessions: [session] })
  renderAt('/today')
  // No workout hero heading on a rest day. ('Pull Day' may still appear as a fuel-preview
  // workout-slot span from the computed mock plan — that is a separate, correct surface.)
  expect(screen.queryByRole('heading', { name: 'Pull Day' })).not.toBeInTheDocument()
  expect(screen.getAllByText(/Sport · 19:30/)).toHaveLength(1)
})

test('workout day with a volleyball session: hero stays the workout, volleyball shows exactly once below', () => {
  const session: VolleyballSession = {
    day: 'Csü', time: '19:30', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés', today: true,
  }
  hooks.useToday.mockReturnValue({ ...baseTodayData, volleyballSessions: [session] })
  renderAt('/today')
  expect(screen.getByRole('heading', { name: 'Pull Day' })).toBeInTheDocument() // hero stays the workout teaser
  expect(screen.getAllByText(/Sport · 19:30/)).toHaveLength(1)
})
