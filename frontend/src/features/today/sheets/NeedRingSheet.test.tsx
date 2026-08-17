// ============================================================
// Mezo · NeedRingSheet tests (mezo-dhzk, Task 4). See
// .superpowers/sdd/2026-08-17-needs-rings/task-4-brief.md.
// ============================================================
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NeedRingSheet } from '@/features/today/sheets/NeedRingSheet'
import type { NeedState } from '@/features/today/logic/needs'

const WAKE = '06:00'
const BED = '22:00'

function state(over: Partial<NeedState> = {}): NeedState {
  return {
    key: 'hidratacio',
    emoji: '💧',
    label: 'Hidratáció',
    color: 'var(--dv-sky)',
    pct: 64,
    ratePerHour: 6,
    zeroAt: null,
    band: 'green',
    lastFill: { at: new Date('2026-08-17T10:00:00'), label: 'Ivás' },
    todayFills: [{ at: new Date('2026-08-17T10:00:00'), label: 'Ivás' }],
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-08-17T12:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('NeedRingSheet', () => {
  test('renders the ring name + pct, and the last-fill line', () => {
    render(
      <NeedRingSheet
        state={state()} wakeTime={WAKE} bedTime={BED}
        onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Hidratáció' })).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText(/Utolsó log: 10:00 · Ivás/)).toBeInTheDocument()
  })

  test('with no lastFill, shows the empty-log copy instead', () => {
    render(
      <NeedRingSheet
        state={state({ lastFill: null })} wakeTime={WAKE} bedTime={BED}
        onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByText('Ma még nincs log')).toBeInTheDocument()
  })

  test('a forecast zeroAt shows its HH:mm plus the refill hint (12/6 = ~2 órát)', () => {
    render(
      <NeedRingSheet
        state={state({ zeroAt: new Date('2026-08-17T18:00:00') })}
        wakeTime={WAKE} bedTime={BED} onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByText(/Így 18:00 körül nullázódik\./)).toBeInTheDocument()
    expect(screen.getByText(/Egy pohár víz \(\+12%\) ~2 órát ad hozzá\./)).toBeInTheDocument()
  })

  test('pct === 0 with no forecast shows the "lemerült" copy', () => {
    render(
      <NeedRingSheet
        state={state({ pct: 0, zeroAt: null })} wakeTime={WAKE} bedTime={BED}
        onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByText('Lemerült — töltsd fel egy loggal.')).toBeInTheDocument()
  })

  test.each([
    ['energia', '🍽️ Étkezés logolása'],
    ['hidratacio', '💧 +250 ml — Logolás'],
    ['pihenes', '😴 Alvás logolása'],
    ['mozgas', '💪 Irány a Train'],
    ['lelek', '💗 Check-in'],
  ] as const)('%s renders its CTA label %s', (key, label) => {
    render(
      <NeedRingSheet
        state={state({ key })} wakeTime={WAKE} bedTime={BED}
        onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  })

  test('rend has no CTA button', () => {
    render(
      <NeedRingSheet
        state={state({ key: 'rend', label: 'Rend', emoji: '⚡' })}
        wakeTime={WAKE} bedTime={BED} onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Rend/ })).toBeNull()
    // only the sheet's own "Kész" button survives
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  test('the CTA click calls onCta with the ring key and closes the sheet', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onCta = vi.fn()
    const onClose = vi.fn()
    render(
      <NeedRingSheet
        state={state()} wakeTime={WAKE} bedTime={BED}
        onClose={onClose} onCta={onCta}
      />,
    )
    await user.click(screen.getByRole('button', { name: '💧 +250 ml — Logolás' }))
    expect(onCta).toHaveBeenCalledWith('hidratacio')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('the timeline shows today\'s fill labels', () => {
    render(
      <NeedRingSheet
        state={state({
          todayFills: [
            { at: new Date('2026-08-17T07:15:00'), label: 'Reggeli ital' },
            { at: new Date('2026-08-17T10:00:00'), label: 'Ivás' },
          ],
        })}
        wakeTime={WAKE} bedTime={BED} onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByText('07:15')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByTitle('Reggeli ital')).toHaveClass('td-need-tl-dot')
  })

  test('no fills today shows the muted empty-timeline line', () => {
    render(
      <NeedRingSheet
        state={state({ todayFills: [] })} wakeTime={WAKE} bedTime={BED}
        onClose={() => {}} onCta={() => {}}
      />,
    )
    expect(screen.getByText('Ma még nincs log.')).toBeInTheDocument()
  })
})
