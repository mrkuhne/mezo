// ============================================================
// Mezo · DayLearningMark tests (mezo-3n2so, spec §5.4/§6.3/task-11) — the day-log mark line on
// FuelMaiPage. The data hooks are stubbed the same way LearningDaysList.test.tsx does, so the
// contract (which day is asked for, which mutation the action calls, the exact copy) is tested
// once and holds for both modes.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { onToast } from '@/shared/lib/toastBus'

const hooks = vi.hoisted(() => ({
  day: null as IntakeDayStatus | null,
  isPending: false,
  range: [] as string[],
  setMark: vi.fn(),
  clearMark: vi.fn(),
}))

vi.mock('@/data/fuel/expenditureHooks', () => ({
  useIntakeDays: (from: string, to: string) => {
    hooks.range = [from, to]
    return { days: hooks.day ? [hooks.day] : [], isPending: hooks.isPending }
  },
  useIntakeDayMark: () => ({ setMark: hooks.setMark, clearMark: hooks.clearMark, pending: false }),
}))

import { DayLearningMark } from '@/features/fuel/components/DayLearningMark'

const day = (status: IntakeDayStatus['status'], mark: IntakeDayStatus['mark'] = null): IntakeDayStatus => ({
  date: '2026-09-27', kcal: 1820, status, mark,
})

const result = (status: IntakeDayStatus['status'], before: number, after: number): IntakeDayMarkResult => ({
  day: day(status, status === 'confirmed_complete' ? 'complete' : status === 'marked_incomplete' ? 'incomplete' : null),
  appliedBaseBeforeKcal: before,
  appliedBaseAfterKcal: after,
  recomputed: true,
})

let toasts: string[] = []
let off: () => void = () => {}

function renderMark(date = '2026-09-27', today = false) {
  return render(
    <MemoryRouter initialEntries={['/fuel']}>
      <Routes>
        <Route path="/fuel" element={<DayLearningMark date={date} today={today} />} />
        <Route path="/fuel/tanulas" element={<p>Hogy tanultam</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hooks.day = null
  hooks.isPending = false
  hooks.setMark.mockReset()
  hooks.clearMark.mockReset()
  toasts = []
  off = onToast(t => { if ('text' in t) toasts.push(t.text) })
})
afterEach(() => off())

describe('DayLearningMark', () => {
  it('asks useIntakeDays for exactly the one viewed day', () => {
    hooks.day = day('usable')
    renderMark('2026-09-20')
    expect(hooks.range).toEqual(['2026-09-20', '2026-09-20'])
  })

  it('renders nothing while pending', () => {
    hooks.isPending = true
    const { container } = renderMark()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an unlogged day', () => {
    hooks.day = day('unlogged')
    const { container } = renderMark()
    expect(container).toBeEmptyDOMElement()
  })

  it('usable: says the day counts, offers to mark it incomplete', () => {
    hooks.day = day('usable')
    renderMark()
    expect(screen.getByText('Ez a nap számít a tanulásban')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hiányos volt' })).toBeInTheDocument()
  })

  it('suspicious: says it looked incomplete, offers to mark it complete', () => {
    hooks.day = day('suspicious')
    renderMark()
    expect(screen.getByText('Ez a nap hiányosnak tűnt, kihagytam')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Teljes volt' })).toBeInTheDocument()
  })

  it('marked_incomplete: says the owner marked it incomplete, offers to undo', () => {
    hooks.day = day('marked_incomplete', 'incomplete')
    renderMark()
    expect(screen.getByText('Ezt a napot hiányosnak jelölted — kihagyom a tanulásból')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visszavonom' })).toBeInTheDocument()
  })

  it('confirmed_complete: says the owner marked it complete, offers to undo', () => {
    hooks.day = day('confirmed_complete', 'complete')
    renderMark()
    expect(screen.getByText('Ezt a napot teljesnek jelölted — számít a tanulásban')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visszavonom' })).toBeInTheDocument()
  })

  it('today adds the Monday-recount note; a past day does not', () => {
    hooks.day = day('usable')
    renderMark('2026-09-27', true)
    expect(screen.getByText(/jövő hétfőn számolom bele/)).toBeInTheDocument()
  })

  it('a past day has no Monday-recount note', () => {
    hooks.day = day('usable')
    renderMark('2026-09-20', false)
    expect(screen.queryByText(/jövő hétfőn/)).toBeNull()
  })

  it('every state has a "Mit jelent ez?" link to /fuel/tanulas', async () => {
    hooks.day = day('usable')
    renderMark()
    await userEvent.click(screen.getByText('Mit jelent ez?'))
    expect(screen.getByText('Hogy tanultam')).toBeInTheDocument()
  })

  it('marking incomplete calls setMark and toasts the frame change', async () => {
    hooks.day = day('usable')
    hooks.setMark.mockResolvedValue(result('marked_incomplete', 2200, 2150))
    renderMark()
    await userEvent.click(screen.getByRole('button', { name: 'Hiányos volt' }))
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-27', 'incomplete')
    expect(toasts).toContain('A keret −50 kcal-lal változott')
  })

  it('marking complete calls setMark with complete', async () => {
    hooks.day = day('suspicious')
    hooks.setMark.mockResolvedValue(result('confirmed_complete', 2150, 2200))
    renderMark()
    await userEvent.click(screen.getByRole('button', { name: 'Teljes volt' }))
    expect(hooks.setMark).toHaveBeenCalledWith('2026-09-27', 'complete')
  })

  it('undoing a mark calls clearMark', async () => {
    hooks.day = day('marked_incomplete', 'incomplete')
    hooks.clearMark.mockResolvedValue(result('usable', 2150, 2200))
    renderMark()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(hooks.clearMark).toHaveBeenCalledWith('2026-09-27')
  })

  it('shows an error toast and keeps the row when the mutation fails', async () => {
    hooks.day = day('usable')
    hooks.setMark.mockRejectedValue(new Error('boom'))
    renderMark()
    await userEvent.click(screen.getByRole('button', { name: 'Hiányos volt' }))
    expect(toasts).toContain('Nem sikerült menteni, próbáld újra')
  })
})
