import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePage } from '@/features/me/pages/ProfilePage'
import { QueryWrapper } from '@/test/queryWrapper'

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
