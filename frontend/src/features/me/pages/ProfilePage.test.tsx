import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { ProfilePage } from '@/features/me/pages/ProfilePage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

function renderProfile() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the Biometria card with the derived base-TDEE line', async () => {
  renderProfile()
  // Card resolves from useBiometricProfile (mock static / MSW default profile).
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  expect(screen.getByText(/≈2960/)).toBeInTheDocument()
})

test('renders the goal mini-track first, before the Biometria card (spec §4.6 order)', async () => {
  // Real mode: GoalMiniCard needs an active goal from the API, and handlers.ts
  // has NO default /api/goals handler (an unhandled request bypasses to a
  // nonexistent backend → the query errors → the card correctly stays null).
  // Seed one goal + its timeline, mirroring GoalsPage.test.tsx's handler set.
  // Mock mode ignores these handlers (the hooks never fetch — static seed).
  server.use(
    http.get(`${API_BASE}/api/goals`, () =>
      HttpResponse.json([
        {
          id: 'g1',
          title: 'Nyári cut',
          trajectory: 'cut',
          guards: [],
          status: 'active',
          startDate: '2026-06-01',
          targetDate: '2026-07-27',
          startWeightKg: 84.2,
          targetWeightKg: 80,
          rateTargetPctPerWeek: 0.7,
          identityFrame: 'Erős és könnyű.',
        },
      ]),
    ),
    http.get(`${API_BASE}/api/goals/g1/timeline`, () =>
      HttpResponse.json({ goalId: 'g1', weeks: 8, links: [], gaps: [] }),
    ),
  )
  renderProfile()
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  // Await the card too: real mode resolves the goal asynchronously via MSW and
  // GoalMiniCard renders null until then (mock mode seeds synchronously).
  await waitFor(() => expect(document.querySelector('.goalmini')).not.toBeNull())
  const goalmini = document.querySelector('.goalmini')!
  const biometria = screen.getByText('Biometria')
  // goalmini precedes the Biometria heading in DOM order → Node.DOCUMENT_POSITION_FOLLOWING set.
  expect(goalmini.compareDocumentPosition(biometria) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('renders the consolidated Growth summary card below biometrics (radars retired)', async () => {
  renderProfile()
  // The three profile radar/level cards were consolidated into GrowthSummaryCard,
  // whose whole surface is a button to /me/growth (present in both ghost + populated states).
  expect(await screen.findByRole('button', { name: /Growth oldal megnyitása/ })).toBeInTheDocument()
  // The retired cards' chrome is gone.
  expect(screen.queryByText('Atlétikai profil')).not.toBeInTheDocument()
  expect(screen.queryByText('Izom-szintek')).not.toBeInTheDocument()
})

test('Szerkesztés opens the BiometricSheet', async () => {
  renderProfile()
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  // The sheet's title appears once open.
  expect(screen.getByText('A motor ebből számol')).toBeInTheDocument()
})
