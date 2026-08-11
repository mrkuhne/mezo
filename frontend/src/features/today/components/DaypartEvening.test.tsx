import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DaypartEvening } from '@/features/today/components/DaypartEvening'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

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

const renderEvening = (over: Partial<Parameters<typeof DaypartEvening>[0]> = {}) =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
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
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

// Mock sleep goal: bed 23:15 / wake 06:45 → dim 21:45–22:15 · winddown 22:15–23:15 · night from 23:15
// (windDown.ts). The brief's original 21:50 clock actually lands INSIDE the dim window, not
// `none` — moved to 21:30 (still before the ritual window closes at +12h from its 21:15 open,
// so the CTA is still 'open') so the "normal phase" tests genuinely exercise `none`.
describe('DaypartEvening', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('the normal phase shows the countdown hero and the Napzárás CTA', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening()
    expect(screen.getByRole('button', { name: 'Zárjuk le a napot' })).toBeInTheDocument()
    expect(screen.getByText('Olvasás')).toBeInTheDocument()
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

  test('the winddown phase offers wind_down exactly once — the ghost, not a row', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:40'))
    renderEvening({ open: [item(), item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.queryByText('Leállás')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leállás megvolt ✓' })).toBeInTheDocument()
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

  test('the retrospective fold carries the evening label and the day total', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:30'))
    renderEvening({ done: [item({ id: 'habit:x', status: 'done', title: 'Hűvös szoba' })] })
    expect(screen.getByRole('button', { name: /Ahogy a nap telt · 1 tétel/ })).toBeInTheDocument()
  })
})
