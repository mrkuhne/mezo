import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { GoalGuardCard } from '@/features/me/components/GoalGuardCard'

test('derives strength status from typed fields', () => {
  const { container } = render(<GoalGuardCard kind="strength" status={{ active: true, e1rmTrendPct: -3.2, breached: true, notes: ['Két lift gyengült.'] }} />)
  expect(screen.getByText('Erővédelem')).toBeInTheDocument()
  expect(screen.getByText('Beavatkozás kell')).toBeInTheDocument()
  expect(screen.getByText('−3,2%')).toBeInTheDocument()
  expect(container.firstChild).toHaveClass('goal-guard-alert')
})

test('inactive muscle guard stays neutral', () => {
  const { container } = render(<GoalGuardCard kind="muscle" status={{ active: false, minWeeklySetsPerMuscle: 8, belowMaintenanceMuscles: ['mell'], rateWithinCap: false, proteinMonitored: false, notes: [] }} />)
  expect(screen.getByText('Nincs bekapcsolva')).toBeInTheDocument()
  expect(container.firstChild).toHaveClass('goal-guard-inactive')
  expect(container.firstChild).not.toHaveClass('goal-guard-alert')
})
