import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IslandEvening } from '@/features/today/components/IslandEvening'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// `useHabitActions` spy delegates to the real hook unless overridden (the
// WindDownBanner.test pattern) — the Pipa flow keeps the shared cache write.
const hooks = vi.hoisted(() => ({ useHabitActions: vi.fn(), real: { fn: null as unknown } }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  hooks.real.fn = orig.useHabitActions
  return { ...orig, useHabitActions: hooks.useHabitActions }
})

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:screen_off', source: 'habit', face: 'este', status: 'open', tone: 'mind', emoji: '📵',
  tag: 'ESTI RUTIN', title: 'Képernyő le', subtitle: '21:30-tól', time: null, xp: 10,
  group: 'Esti rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' } as TodayItem['action'], linkUrl: null, ...over,
})

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

// Mock sleep goal: bed 23:15 / wake 06:45 → dim 21:45–22:15 · winddown 22:15–23:15 · night 23:15–06:15.
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

const renderEvening = (over: Partial<Parameters<typeof IslandEvening>[0]> = {}, path = '/today') =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <IslandEvening
            open={[item()]}
            done={[]}
            dayXp={85}
            facts={[
              { label: 'Nap mérlege', value: '+85', unit: 'XP', delta: { text: '9/11 tétel ma', tone: 'good' } },
              { label: 'Alvás-kilátás', value: '7,5', unit: 'óra', delta: { text: 'ha 23:15-kor lefekszel', tone: 'muted' } },
            ]}
            listOpen={false}
            onToggleList={() => {}}
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

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  hooks.useHabitActions.mockImplementation((...args: unknown[]) =>
    (hooks.real.fn as (...a: unknown[]) => unknown)(...args),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('IslandEvening — phases', () => {
  test('normál evening: countdown hero + lavender CTA into /ritual', async () => {
    // 21:30 — inside the ritual window (opens 21:15) but before dim (21:45).
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening()
    expect(screen.getByText('1:45')).toBeInTheDocument()
    expect(screen.getByText('a villanyoltásig')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zárjuk le a napot' }))
    expect(screen.getByTestId('loc').textContent).toBe('/ritual')
  })

  test('dim: the REM evidence fact shows, no Pipa yet', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:00'))
    renderEvening()
    expect(screen.getByText('REM hűvösben')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leállás megvolt/ })).toBeNull()
  })

  test('winddown: the Pipa fires the wind_down check and the L1 hides the row', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:30'))
    const check = vi.fn().mockResolvedValue([])
    hooks.useHabitActions.mockReturnValue({ check, uncheck: vi.fn(), pending: false, consumeLevelUps: vi.fn() })
    const { unmount } = renderEvening({ open: [item(), item({ id: 'habit:wind_down', title: 'Leállás' })] })
    await userEvent.click(screen.getByRole('button', { name: 'Leállás megvolt ✓' }))
    expect(check).toHaveBeenCalledWith('wind_down')
    unmount()
    renderEvening({ open: [item(), item({ id: 'habit:wind_down', title: 'Leállás' })], listOpen: true })
    expect(screen.queryByText('Leállás')).toBeNull()
    expect(screen.getByText('Képernyő le')).toBeInTheDocument()
  })

  test('winddown: an in-flight write withdraws the Pipa', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:30'))
    hooks.useHabitActions.mockReturnValue({ check: vi.fn(), uncheck: vi.fn(), pending: true, consumeLevelUps: vi.fn() })
    renderEvening()
    expect(screen.queryByRole('button', { name: /Leállás megvolt/ })).toBeNull()
  })

  test('night: dark entry link only — no CTA, countdown reads elmúlt', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('23:40'))
    renderEvening()
    expect(screen.getByText('elmúlt')).toBeInTheDocument()
    expect(screen.getByText(/Éjszakai mód megnyitása/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zárjuk le a napot' })).toBeNull()
  })

  test('?ritual=done wins over the clock — done line, no CTA', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:00'))
    renderEvening({}, '/today?ritual=done')
    expect(screen.getByText('Napzárás kész ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zárjuk le a napot' })).toBeNull()
  })
})

describe('IslandEvening — L1 ownership rules', () => {
  test('the ritual row and the evening_ritual habit never appear in L1', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:00'))
    renderEvening({
      listOpen: true,
      open: [
        item({ id: 'ritual:day', source: 'ritual', title: 'Zárjuk le a napot' }),
        item({ id: 'habit:evening_ritual', title: 'Esti rituálé' }),
        item(),
      ],
    })
    expect(screen.queryByText('Esti rituálé')).toBeNull()
    expect(screen.getByText('Képernyő le')).toBeInTheDocument()
  })

  test('outside winddown the wind_down row IS reachable in L1 (act-anywhere)', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:00'))
    renderEvening({ listOpen: true, open: [item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.getByText('Leállás')).toBeInTheDocument()
  })

  test('the retrospective closes with the day XP line', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:00'))
    renderEvening({ listOpen: true, done: [item({ id: 'd', status: 'done', title: 'Mérés' })] })
    expect(screen.getByText('Ma összesen +85 XP')).toBeInTheDocument()
  })
})
