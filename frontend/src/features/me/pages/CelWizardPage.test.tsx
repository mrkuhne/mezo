import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelWizardPage } from '@/features/me/pages/CelWizardPage'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { mockPropose } from '@/data/lifegoal/lifegoalMock'
import type { LifeGoalProposeRequest } from '@/data/lifegoal/lifegoalApi'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// Echoes the id so a real-mode create test proves the wizard landed on the NEW goal's route.
function GoalProbe() {
  const { id } = useParams<{ id: string }>()
  return <div>GOAL PAGE {id}</div>
}

const renderWiz = () => render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals/new']}>
  <Routes><Route path="/me/goals/new" element={<CelWizardPage />} /><Route path="/me/goals" element={<div>HUB</div>} /><Route path="/me/goals/:id" element={<GoalProbe />} /></Routes>
</MemoryRouter></QueryWrapper>)

test('walks all five steps: extrinsic why gets the reframe offer, proposal pillars toggle, activation lands on the goal page', async () => {
  renderWiz()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
  fireEvent.change(screen.getByLabelText('Miért fontos? · egy mondat'), { target: { value: 'hogy jobban nézzek ki a strandon' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByText('⚠ Külső keret')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Egészség-keret · elfogadom' }))
  expect(screen.getByText('✓ Belső keret · egészség + képesség')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  const toggles = screen.getAllByRole('button', { name: / ki$/ })
  expect(toggles.length).toBeGreaterThanOrEqual(2)
  fireEvent.click(toggles[0])
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  expect(screen.getAllByText('HA').length).toBeGreaterThanOrEqual(1)
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  expect(screen.getByText('Így indul')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aktiválás' }))
  await waitFor(() => expect(screen.getByText(/^GOAL PAGE /)).toBeInTheDocument())
})

test('Mentés tervezettként returns to the hub', async () => {
  renderWiz()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Spanyol C1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))
  await waitFor(() => expect(screen.getByText('HUB')).toBeInTheDocument())
})

// ── Real mode (mezo-iizd.1 final review, items 2 + 8) ────────────────────────────────────────
describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  // Item 8: a rejected `propose` used to leave the step-2 spinner running forever with „Tovább"
  // permanently disabled — the wizard dead-ended with no way back to a working state.
  test('a failed propose swaps the spinner for a retry card, and the retry recovers', async () => {
    let fail = true
    server.use(http.post(`${API_BASE}/api/life-goals/propose`, async ({ request }) => {
      if (fail) return new HttpResponse(null, { status: 500 })
      return HttpResponse.json(mockPropose((await request.json()) as LifeGoalProposeRequest))
    }))
    renderWiz()
    fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))

    const retry = await screen.findByRole('button', { name: 'Újra' })
    expect(document.querySelector('.lg-aiwait')).toBeNull()

    fail = false
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
  })

  // The wizard navigates to the id the CREATE RESPONSE carried (not a guessed one). The cache
  // seeding that keeps the detail page from flashing "Nincs ilyen cél." is asserted precisely in
  // data/lifegoal/lifegoalHooks.test.tsx ("create seeds the list cache").
  test('activation lands on the created goal id', async () => {
    renderWiz()
    fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aktiválás' }))

    await waitFor(() => expect(screen.getByText('GOAL PAGE lg-new')).toBeInTheDocument())
  })
})
