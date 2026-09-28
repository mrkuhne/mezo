// ============================================================
// Mezo · LearningDaysList tests (mezo-3n2so, spec §5.4/§6.3) — „Az utolsó 14 nap” on the
// „Hogy tanultam?” page. The data hooks are stubbed so the contract (which range is asked for,
// which mutation a toggle calls, which copy) is tested the same way in mock and real mode.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { onToast } from '@/shared/lib/toastBus'
import { addDays, localDateString } from '@/shared/lib/dates'

const hooks = vi.hoisted(() => ({
  days: [] as IntakeDayStatus[],
  range: [] as string[],
  setMark: vi.fn(),
  clearMark: vi.fn(),
}))

vi.mock('@/data/fuel/expenditureHooks', () => ({
  useIntakeDays: (from: string, to: string) => {
    hooks.range = [from, to]
    return { days: hooks.days, isPending: false }
  },
  useIntakeDayMark: () => ({ setMark: hooks.setMark, clearMark: hooks.clearMark, pending: false }),
}))

import { LearningDaysList } from '@/features/fuel/components/LearningDaysList'

const DAYS: IntakeDayStatus[] = [
  { date: '2026-09-21', kcal: 2820, status: 'usable', mark: null },
  { date: '2026-09-22', kcal: 1610, status: 'confirmed_complete', mark: 'complete' },
  { date: '2026-09-23', kcal: 1180, status: 'suspicious', mark: null },
  { date: '2026-09-25', kcal: null, status: 'unlogged', mark: null },
  { date: '2026-09-19', kcal: 2150, status: 'marked_incomplete', mark: 'incomplete' },
]

const result = (date: string, status: IntakeDayStatus['status'], before: number, after: number, recomputed = true): IntakeDayMarkResult => ({
  day: { date, kcal: 1180, status, mark: status === 'confirmed_complete' ? 'complete' : status === 'marked_incomplete' ? 'incomplete' : null },
  appliedBaseBeforeKcal: before,
  appliedBaseAfterKcal: after,
  recomputed,
})

const row = (label: string) => screen.getByText(label).closest('.fln-day') as HTMLElement
const toggle = (label: string) => within(row(label)).getByRole('switch')

let toasts: string[] = []
let off: () => void = () => {}
beforeEach(() => {
  hooks.days = DAYS
  hooks.setMark.mockReset()
  hooks.clearMark.mockReset()
  toasts = []
  off = onToast(t => { if ('text' in t) toasts.push(t.text) })
})
afterEach(() => off())

describe('LearningDaysList', () => {
  it('asks for the 14 days before today and lists them newest first', () => {
    render(<LearningDaysList mode="learning" />)
    const today = localDateString()
    expect(hooks.range).toEqual([addDays(today, -14), addDays(today, -1)])
    const dates = [...document.querySelectorAll('.fln-day strong')].map(e => e.textContent)
    expect(dates).toEqual(['P, szept. 25.', 'Sze, szept. 23.', 'K, szept. 22.', 'H, szept. 21.', 'Szo, szept. 19.'])
  })

  it('writes each status as its chip and gives unlogged days no toggle', () => {
    render(<LearningDaysList mode="learning" />)
    expect(within(row('H, szept. 21.')).getByText('számít')).toBeInTheDocument()
    expect(within(row('Sze, szept. 23.')).getByText('hiányosnak tűnt')).toBeInTheDocument()
    expect(within(row('Szo, szept. 19.')).getByText('te jelölted hiányosnak')).toBeInTheDocument()
    expect(within(row('K, szept. 22.')).getByText('te jelölted teljesnek')).toBeInTheDocument()
    expect(within(row('P, szept. 25.')).getByText('nincs felírva')).toBeInTheDocument()
    expect(within(row('P, szept. 25.')).queryByRole('switch')).toBeNull()
    expect(within(row('H, szept. 21.')).getByText('2 820 kcal')).toBeInTheDocument()
    // „számít” is checked for usable and confirmed_complete only
    expect(toggle('H, szept. 21.')).toHaveAttribute('aria-checked', 'true')
    expect(toggle('K, szept. 22.')).toHaveAttribute('aria-checked', 'true')
    expect(toggle('Sze, szept. 23.')).toHaveAttribute('aria-checked', 'false')
    expect(toggle('Szo, szept. 19.')).toHaveAttribute('aria-checked', 'false')
  })

  it('a suspicious day switched on is marked complete, and the toast says how the frame moved', async () => {
    hooks.setMark.mockResolvedValue(result('2026-09-23', 'confirmed_complete', 2480, 2440))
    render(<LearningDaysList mode="learning" />)
    await userEvent.click(toggle('Sze, szept. 23.'))
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-23', 'complete')
    expect(hooks.clearMark).not.toHaveBeenCalled()
    expect(toasts).toContain('A keret −40 kcal-lal változott')
  })

  it('a usable day switched off is marked incomplete', async () => {
    hooks.setMark.mockResolvedValue(result('2026-09-21', 'marked_incomplete', 2480, 2480))
    render(<LearningDaysList mode="learning" />)
    await userEvent.click(toggle('H, szept. 21.'))
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-21', 'incomplete')
    expect(toasts).toContain('A keret nem változott')
  })

  it('a day returned to its rule state clears the mark instead of setting one', async () => {
    hooks.clearMark
      .mockResolvedValueOnce(result('2026-09-22', 'suspicious', 2440, 2480))
      .mockResolvedValueOnce(result('2026-09-19', 'usable', 2480, 2440))
    render(<LearningDaysList mode="learning" />)
    await userEvent.click(toggle('K, szept. 22.')) // confirmed_complete → off = back to suspicious
    await userEvent.click(toggle('Szo, szept. 19.')) // marked_incomplete → on = back to usable
    expect(hooks.clearMark.mock.calls).toEqual([['2026-09-22'], ['2026-09-19']])
    expect(hooks.setMark).not.toHaveBeenCalled()
    expect(toasts).toEqual(['A keret +40 kcal-lal változott', 'A keret −40 kcal-lal változott'])
  })

  it('when clearing does not land on the wanted state, the mark follows (rule was the other way)', async () => {
    hooks.clearMark.mockResolvedValue(result('2026-09-19', 'suspicious', 2480, 2480))
    hooks.setMark.mockResolvedValue(result('2026-09-19', 'confirmed_complete', 2480, 2440))
    render(<LearningDaysList mode="learning" />)
    await userEvent.click(toggle('Szo, szept. 19.'))
    expect(hooks.clearMark).toHaveBeenCalledWith('2026-09-19')
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-19', 'complete')
    expect(toasts).toEqual(['A keret −40 kcal-lal változott'])
  })

  it('says it only saved when learning is off or has no rows yet', async () => {
    hooks.setMark.mockResolvedValue(result('2026-09-23', 'confirmed_complete', 2480, 2440))
    const { unmount } = render(<LearningDaysList mode="off" />)
    await userEvent.click(toggle('Sze, szept. 23.'))
    expect(toasts).toContain('Elmentettem — a tanult érték frissült, a keretet most a képlet adja.')
    unmount()
    render(<LearningDaysList mode="empty" />)
    await userEvent.click(toggle('Sze, szept. 23.'))
    expect(toasts).toContain('Elmentettem — amint elég adatom lesz, beleszámolom.')
  })

  it('a failed save toasts an error and leaves the switch as it was', async () => {
    hooks.setMark.mockRejectedValue(new Error('boom'))
    render(<LearningDaysList mode="learning" />)
    await userEvent.click(toggle('Sze, szept. 23.'))
    expect(toasts).toContain('Nem sikerült menteni, próbáld újra')
    expect(toggle('Sze, szept. 23.')).toHaveAttribute('aria-checked', 'false')
  })
})
