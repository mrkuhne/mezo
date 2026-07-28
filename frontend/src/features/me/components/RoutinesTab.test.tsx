import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { localDateString } from '@/shared/lib/dates'

const habitsToday = [
  { key: 'wake_on_time', chain: 'MORNING', title: 'Ébredés időben', status: 'done', xp: 5 },
  { key: 'morning_sunlight', chain: 'MORNING', title: 'Reggeli napfény', status: 'pending', xp: 5 },
  { key: 'bed_on_time', chain: 'EVENING', title: 'Időben ágyban', status: 'missed', xp: 5 },
]

// `vi.mock` is hoisted above module-scope consts, so the mock fns must be created via `vi.hoisted`
// — a bare `const fn = vi.fn()` referenced inside the factory throws "cannot access before init".
const { useHabitDay, useHabitSummary } = vi.hoisted(() => ({
  useHabitDay: vi.fn(),
  useHabitSummary: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitDay: (d: string) => useHabitDay(d),
  useHabitSummary: () => useHabitSummary(),
}))

beforeEach(() => {
  useHabitDay.mockReset()
  useHabitDay.mockReturnValue({ habits: habitsToday })
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({
    data: {
      perfectMorningDays30: 22,
      perfectEveningDays30: 18,
      habits: [{ key: 'wake_on_time', strengthPct: 71 }],
    },
  })
})

describe('RoutinesTab', () => {
  it('today: shows the 30-day perfect-day counters + per-habit strength bars', () => {
    const { container } = render(<RoutinesTab />)
    expect(screen.getByText('Tökéletes reggelek')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    // today keeps the strength rows (percentage + bar)
    expect(screen.getByText('71%')).toBeInTheDocument()
    expect(container.querySelector('.hab-sbar')).not.toBeNull()
  })

  it('navigating to a past day queries that date and shows the day-summary chip (no counters, no strength)', () => {
    const { container } = render(<RoutinesTab />)
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    const yesterday = screen.getByRole('button', { name: /dátum kiválasztása/i })
    expect(useHabitDay).toHaveBeenCalledWith(expect.not.stringMatching(localDateString()))
    expect(screen.queryByText('Tökéletes reggelek')).not.toBeInTheDocument()
    expect(screen.getByText(/Reggel \d+\/\d+/)).toBeInTheDocument() // summary chip
    expect(yesterday).toBeInTheDocument()
    // status-only rows on a past day — no strength percentage / bar
    expect(container.querySelector('.hab-sbar')).toBeNull()
  })

  it('empty past day: shows the quiet ghost', () => {
    render(<RoutinesTab />)
    useHabitDay.mockReturnValue({ habits: [] })
    fireEvent.click(screen.getByRole('button', { name: /előző nap/i }))
    expect(screen.getByText(/Nincs rutinadat erre a napra/i)).toBeInTheDocument()
  })
})
