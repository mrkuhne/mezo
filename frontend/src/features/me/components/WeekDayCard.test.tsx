// Weekly review (mezo-p2tr, Task 10 fix round 1) — the "Beszélgess a napról" chip must disable
// (and show the same pending treatment as WeekReviewCard's chip) while the chat handoff's create
// round-trip is in flight, so a second click can't fire a second POST.
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { WeekDayCard } from '@/features/me/components/WeekDayCard'
import type { MeWeekDay } from '@/data/me/meWeek'

const DAY: MeWeekDay = {
  date: '2026-05-18',
  score: 78,
  subscores: { sleep: 82, fuel: 75, checkin: 74, activity: 88 },
  kcal: 2980, proteinG: 212, carbsG: 335, fatG: 92,
  kcalTarget: 3100, proteinTargetG: 220,
  weightKg: 84.3,
  sleepMin: 445, sleepQuality: 7,
  checkinCount: 4, checkinEnergyAvg: 7,
  workoutCount: 1, xp: 140,
}

test('the chat chip is enabled by default', () => {
  render(<WeekDayCard day={DAY} expanded onToggle={vi.fn()} onChat={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Beszélgess a napról/ })).not.toBeDisabled()
})

test('the chat chip disables and shows the pending treatment while chatPending is true', () => {
  render(<WeekDayCard day={DAY} expanded onToggle={vi.fn()} onChat={vi.fn()} chatPending />)
  const button = screen.getByRole('button', { name: /Indítás/ })
  expect(button).toBeDisabled()
  expect(screen.queryByText(/Beszélgess a napról/)).not.toBeInTheDocument()
})
