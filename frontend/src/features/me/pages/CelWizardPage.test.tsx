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
import { pillarFromCatalog } from '@/features/me/logic/pillarFromCatalog'

// Wrapped (not replaced) so every other test's catalog picks still get a real, always-allowed
// kind — only the "kind not allowed" test below overrides a single call via mockReturnValueOnce.
vi.mock('@/features/me/logic/pillarFromCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/me/logic/pillarFromCatalog')>()
  return { ...actual, pillarFromCatalog: vi.fn(actual.pillarFromCatalog) }
})

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

// mezo-iwoc: mockValidatePillars (lifegoalHooks.ts) throws LIFE_GOAL_KIND_NOT_ALLOWED for the
// same reason the real backend's LifeGoalPillarService.validate would 400 — a pillar whose kind
// the catalog entry doesn't list (sleep_duration allows habit/average/baseline, not linked). The
// wizard's own UI can never produce this (pillarFromCatalog.preferredKind always picks an allowed
// kind), so this drives the catalog sheet and hand-patches ONE pick's kind to force the error, and
// checks it surfaces through the same inline error card as a real-mode create failure.
test('mock mode: a pillar with a kind the catalog entry disallows shows the same inline error card', async () => {
  vi.mocked(pillarFromCatalog).mockReturnValueOnce({
    label: 'Alvás', skillKey: 'recovery', kind: 'linked', weight: 1, active: true,
    source: { type: 'metric', key: 'SLEEP_DURATION_H' }, rule: {},
  })
  renderWiz()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))

  fireEvent.click(screen.getByRole('button', { name: '＋ Pillér a katalógusból' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Alváshossz' }))

  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))

  await screen.findByText('Nem sikerült elmenteni')
  expect(screen.queryByText('HUB')).not.toBeInTheDocument()
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

  // mezo-iwoc: a failed create used to navigate blindly (or silently do nothing beyond the
  // global toast) — the draft was gone with no way to retry. It must now stay on the summary
  // step with an inline error card, and the same button must re-fire the request.
  test('a failed create keeps the wizard on the summary with an inline error card', async () => {
    server.use(http.post(`${API_BASE}/api/life-goals`, () =>
      HttpResponse.json([{ code: 'LIFE_GOAL_INVALID_RULE', message: 'Invalid life goal rule' }], { status: 400 })))
    renderWiz()
    fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))

    fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))
    await screen.findByText('Nem sikerült elmenteni')
    expect(screen.queryByText('HUB')).not.toBeInTheDocument()

    // Retry re-uses the same draft (still on step 4) and re-fires the request.
    let secondAttempt = false
    server.use(http.post(`${API_BASE}/api/life-goals`, async ({ request }) => {
      secondAttempt = true
      const body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ ...body, id: 'lg-retry', status: 'draft' }, { status: 201 })
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))
    await waitFor(() => expect(screen.getByText('HUB')).toBeInTheDocument())
    expect(secondAttempt).toBe(true)
  })

  // Create succeeds (the goal now exists as a draft) but the follow-up activation call fails —
  // staying on the wizard would let a retry create a DUPLICATE goal, so navigation must still
  // land on the created goal's detail page; the global toast + the draft state tell the truth.
  test('activation failure after a successful create still lands on the goal detail', async () => {
    server.use(
      http.post(`${API_BASE}/api/life-goals`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...body, id: 'lg-activate-fail', status: 'draft' }, { status: 201 })
      }),
      http.post(`${API_BASE}/api/life-goals/:id/status`, () =>
        HttpResponse.json([{ code: 'LIFE_GOAL_STATUS_CONFLICT', message: 'Cannot activate' }], { status: 409 })),
    )
    renderWiz()
    fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aktiválás' }))

    await waitFor(() => expect(screen.getByText('GOAL PAGE lg-activate-fail')).toBeInTheDocument())
  })
})
