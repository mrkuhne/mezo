import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { WeightHero } from '@/features/me/components/WeightHero'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'

const log: WeightEntry[] = [{ date: '2026-04-22', value: 81.4 }, { date: '2026-05-22', value: 78.6 }]
const trends: WeightTrends = { last7d: { avg: 78.96, weeklyRate: -0.5 }, last4w: { weeklyRate: -0.7 } }
const goal = { startWeight: 81.4, currentWeight: 78.6, targetWeight: 73.0, kind: 'cut' } as Goal

test('renders down-from-start, progress, stats, and fires onLog', () => {
  const onLog = vi.fn()
  render(<WeightHero log={log} weightTrends={trends} goal={goal} onLog={onLog} />)
  expect(screen.getByText('Induláshoz képest')).toBeInTheDocument()
  expect(screen.getByText('−2.8')).toBeInTheDocument()
  expect(screen.getByText('✓ 33% a célig')).toBeInTheDocument()
  expect(screen.getByText('Jelenleg')).toBeInTheDocument()
  expect(screen.getByText(/4-hét tempó/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /naplózás/i }))
  expect(onLog).toHaveBeenCalledOnce()
})

test('no-goal fallback: no progress pill, ETA dash', () => {
  render(<WeightHero log={log} weightTrends={trends} goal={null} onLog={() => {}} />)
  expect(screen.queryByText(/a célig/)).not.toBeInTheDocument()
  expect(screen.getByText('ETA')).toBeInTheDocument()
})
