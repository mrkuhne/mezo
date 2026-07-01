import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoalRecept } from '@/features/me/components/GoalRecept'
import type { GoalResponse } from '@/lib/goalApi'

type Prescription = NonNullable<GoalResponse['prescription']>

const prescription: Prescription = {
  generatedAt: '2026-05-22T06:05:00Z',
  basis: 'formula',
  segments: [
    {
      fromWeek: 1,
      toWeek: 6,
      label: 'Mély deficit',
      kcal: 2150,
      proteinG: 163,
      sleepTargetH: 7.5,
      restDays: [3, 7],
      projectedRateKgPerWk: -0.55,
      rationale: 'Agresszívabb deficit a gym blokk alatt.',
    },
    {
      fromWeek: 7,
      toWeek: 12,
      label: 'Taper',
      kcal: 2380,
      proteinG: 155,
      sleepTargetH: 8,
      restDays: [4, 7],
      projectedRateKgPerWk: -0.35,
      rationale: 'Lassítunk a célsúly közelében.',
    },
  ],
  guardStatus: {
    strength: { active: true, e1rmTrendPct: 1.2, breached: false, notes: [] },
    muscle: {
      active: true,
      minWeeklySetsPerMuscle: 8,
      belowMaintenanceMuscles: [],
      rateWithinCap: true,
      proteinMonitored: false,
      notes: [],
    },
  },
  feasibility: {
    verdict: 'feasible-with-warnings',
    notes: ['A tempó a cap közelében van.'],
  },
}

test('GoalRecept renders the feasibility verdict label + notes', () => {
  render(<GoalRecept prescription={prescription} />)
  expect(screen.getByText('Reális, figyelmeztetésekkel')).toBeInTheDocument()
  expect(screen.getByText(/A tempó a cap közelében van/)).toBeInTheDocument()
})

test('GoalRecept renders every segment with week range, kcal, protein and signed rate', () => {
  render(<GoalRecept prescription={prescription} />)
  expect(screen.getByText('Mély deficit')).toBeInTheDocument()
  expect(screen.getByText('Taper')).toBeInTheDocument()
  expect(screen.getByText(/W1–6/)).toBeInTheDocument()
  expect(screen.getByText(/W7–12/)).toBeInTheDocument()
  expect(screen.getByText(/2150/)).toBeInTheDocument()
  expect(screen.getByText(/163/)).toBeInTheDocument()
  // signed projected rate (negative for a cut)
  expect(screen.getByText(/-0\.55/)).toBeInTheDocument()
  expect(screen.getByText(/Agresszívabb deficit/)).toBeInTheDocument()
})

test('GoalRecept renders the guard-status pills (strength e1RM, muscle sets, protein waits for Fuel)', () => {
  render(<GoalRecept prescription={prescription} />)
  // strength e1RM trend %
  expect(screen.getByText(/e1RM/)).toBeInTheDocument()
  expect(screen.getByText(/1\.2/)).toBeInTheDocument()
  // muscle min weekly sets
  expect(screen.getByText(/8 szett/)).toBeInTheDocument()
  // protein is monitored=false → shown as waiting for Fuel
  expect(screen.getByText(/Fuel-re vár/)).toBeInTheDocument()
})

test('GoalRecept marks a breached strength guard with an error tone label', () => {
  const breached: Prescription = {
    ...prescription,
    guardStatus: {
      ...prescription.guardStatus,
      strength: { active: true, e1rmTrendPct: -6.1, breached: true, notes: ['Erő-esés a deficit alatt.'] },
    },
  }
  render(<GoalRecept prescription={breached} />)
  expect(screen.getByText(/sérülve/i)).toBeInTheDocument()
  expect(screen.getByText(/Erő-esés a deficit alatt/)).toBeInTheDocument()
})

test('GoalRecept renders the evaluate CTA when prescription is null', async () => {
  const onEvaluate = vi.fn()
  render(<GoalRecept prescription={null} onEvaluate={onEvaluate} />)
  const cta = screen.getByRole('button', { name: /Értékeld a célt/ })
  expect(cta).toBeInTheDocument()
  await userEvent.click(cta)
  expect(onEvaluate).toHaveBeenCalledTimes(1)
})

test('GoalRecept feasible verdict shows the calm label', () => {
  const feasible: Prescription = { ...prescription, feasibility: { verdict: 'feasible', notes: [] } }
  render(<GoalRecept prescription={feasible} />)
  expect(screen.getByText('Reális')).toBeInTheDocument()
})

test('GoalRecept aggressive verdict shows the error label', () => {
  const aggressive: Prescription = { ...prescription, feasibility: { verdict: 'aggressive', notes: ['Túl gyors tempó.'] } }
  render(<GoalRecept prescription={aggressive} />)
  expect(screen.getByText('Agresszív')).toBeInTheDocument()
})
