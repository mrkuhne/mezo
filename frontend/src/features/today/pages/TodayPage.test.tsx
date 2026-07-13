import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { today, user, workout, workoutPrediction, volleyballNote, fuelToday } from '@/data/today/today'
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
}))

const baseTodayData = {
  today, user, briefing: null, briefingDemo: false,
  workout, workoutTime: today.workoutTime, prediction: workoutPrediction,
  volleyballSessions: [] as VolleyballSession[], volleyballNote, fuelToday,
}

beforeEach(() => {
  hooks.useToday.mockReturnValue(baseTodayData)
})

const renderAt = (path: string) => render(
  <QueryWrapper><MemoryRouter initialEntries={[path]}><TodayPage /></MemoryRouter></QueryWrapper>,
)

test('default (medium) renders the Napiv order: greeting, day arc, hero workout, briefing, check-ins, quick stats — not AnchorMode', () => {
  renderAt('/today')
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'A napod íve' })).toBeInTheDocument()
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getByText(/briefing/i)).toBeInTheDocument()
  expect(screen.getByText('Hogy vagy ma?')).toBeInTheDocument()
  expect(screen.getByText('Ma eddig')).toBeInTheDocument()
  expect(screen.queryByText(/Anchor mode/)).not.toBeInTheDocument()
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
  expect(screen.queryByText('Pull Day')).not.toBeInTheDocument()
  expect(screen.getAllByText(/Sport · 19:30/)).toHaveLength(1)
})

test('workout day with a volleyball session: hero stays the workout, volleyball shows exactly once below', () => {
  const session: VolleyballSession = {
    day: 'Csü', time: '19:30', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés', today: true,
  }
  hooks.useToday.mockReturnValue({ ...baseTodayData, volleyballSessions: [session] })
  renderAt('/today')
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getAllByText(/Sport · 19:30/)).toHaveLength(1)
})
