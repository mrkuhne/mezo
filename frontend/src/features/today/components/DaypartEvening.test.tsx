import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockHabitDay } from '@/data/habit/habitMock'
import { DaypartEvening } from '@/features/today/components/DaypartEvening'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// `useHabitDay` spy delegates to the real hook unless overridden (the IslandEvening.test.tsx
// pattern for `useHabitActions`) — needed for the one test that must observe the wind_down
// habit already checked (`status: 'done'`), which no prop can drive.
const hooks = vi.hoisted(() => ({ useHabitDay: vi.fn(), real: { fn: null as unknown } }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  hooks.real.fn = orig.useHabitDay
  return { ...orig, useHabitDay: hooks.useHabitDay }
})

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:read', source: 'habit', face: 'este', status: 'open', tone: 'body', emoji: '📖',
  tag: 'ESTI RUTIN', title: 'Olvasás', subtitle: '15 perc', time: null, xp: 10,
  group: 'Esti rutin', action: { kind: 'habit', habit: { key: 'read' }, label: 'Pipa' } as TodayItem['action'],
  linkUrl: null, ...over,
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const renderEvening = (over: Partial<Parameters<typeof DaypartEvening>[0]> = {}, path = '/today') =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <DaypartEvening
            open={[item()]}
            done={[]}
            dayXp={120}
            facts={[{ label: 'Alvás-kilátás', value: '7,5', unit: 'óra' }]}
            note={null}
            celebrations={[]}
            onAct={() => {}}
            {...over}
          />
          <LocationProbe />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

// Mock sleep goal: bed 23:15 / wake 06:45 → dim 21:45–22:15 · winddown 22:15–23:15 · night from
// 23:15 (windDown.ts). The brief's original 21:50 clock actually lands INSIDE the dim window,
// not `none` — moved to 21:30 (still before the ritual window closes at +12h from its 21:15
// open, so the CTA is still 'open') so the "normal phase" tests genuinely exercise `none`.
describe('DaypartEvening', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useHabitDay.mockImplementation((...args: unknown[]) =>
      (hooks.real.fn as (...a: unknown[]) => unknown)(...args),
    )
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks() })

  test('the normal phase shows the countdown hero and the Napzárás CTA, which navigates to /ritual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening()
    expect(screen.getByText('Olvasás')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zárjuk le a napot' }))
    expect(screen.getByTestId('loc').textContent).toBe('/ritual')
  })

  test('rows need no unfolding — the list is part of the view', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'összecsuk ↑' })).toBeNull()
  })

  test('the ritual-owned rows never appear as list rows — the CTA owns that act', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening({
      open: [item(), item({ id: 'habit:evening_ritual', title: 'Napzárás rituálé' }),
             item({ id: 'ritual:day', source: 'ritual', title: 'Napzárás' })],
    })
    expect(screen.queryByText('Napzárás rituálé')).toBeNull()
    expect(screen.getByText('Olvasás')).toBeInTheDocument()
  })

  test('the dim phase swaps in the REM evidence fact and offers no wind_down ghost yet', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:00'))
    renderEvening()
    expect(screen.getByText('REM hűvösben')).toBeInTheDocument()
    expect(screen.getByText('ráhangolódás: fény 30 lux alá · szoba ~18 °C')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leállás megvolt ✓' })).toBeNull()
  })

  test('the winddown phase offers wind_down exactly once — the ghost, not a row', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:40'))
    renderEvening({ open: [item(), item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.queryByText('Leállás')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leállás megvolt ✓' })).toBeInTheDocument()
  })

  test('the winddown phase shows the done state line once wind_down is already checked', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:40'))
    const doneHabits = mockHabitDay.map((h) => (h.key === 'wind_down' ? { ...h, status: 'done' as const } : h))
    hooks.useHabitDay.mockReturnValue({ habits: doneHabits, levelUps: [], mode: 'mock' })
    renderEvening()
    expect(screen.getByText('Leállás megvolt ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leállás megvolt ✓' })).toBeNull()
  })

  test('outside the winddown phase the wind_down row IS the only affordance', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening({ open: [item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.getByText('Leállás')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leállás megvolt ✓' })).toBeNull()
  })

  test('the night phase darkens the VIEW and offers the night-mode row only', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('23:40'))
    const { container } = renderEvening()
    expect(container.querySelector('.dayview.is-night')).toBeInTheDocument()
    expect(screen.getByText(/Éjszakai mód megnyitása/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zárjuk le a napot' })).toBeNull()
  })

  test('?ritual=done overrides the clock — the done state line shows, the CTA does not', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:00'))
    renderEvening({}, '/today?ritual=done')
    expect(screen.getByText('Napzárás kész ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zárjuk le a napot' })).toBeNull()
  })

  test('the retrospective fold carries the evening label and the day total', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening({ done: [item({ id: 'habit:x', status: 'done', title: 'Hűvös szoba' })] })
    expect(screen.getByRole('button', { name: /Ahogy a nap telt · 1 tétel/ })).toBeInTheDocument()
  })
})
