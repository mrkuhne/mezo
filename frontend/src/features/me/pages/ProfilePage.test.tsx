import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePage } from '@/features/me/pages/ProfilePage'
import { QueryWrapper } from '@/test/queryWrapper'

function renderProfile(onOpenSettings = () => {}) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me']}>
        <ProfilePage onOpenSettings={onOpenSettings} />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the Profil header', () => {
  renderProfile()
  expect(screen.getByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument()
})

test('gear chip calls onOpenSettings', async () => {
  const onOpenSettings = vi.fn()
  renderProfile(onOpenSettings)
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  expect(onOpenSettings).toHaveBeenCalledTimes(1)
})

test('renders the Biometria card with the derived base-TDEE line', async () => {
  renderProfile()
  // Card resolves from useBiometricProfile (mock static / MSW default profile).
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  expect(screen.getByText(/≈2960/)).toBeInTheDocument()
})

test('renders the athletic radar + muscle cards below biometrics', async () => {
  renderProfile()
  // Both cards read useProgressionProfile (mock seed / MSW default — both have a profile).
  expect(await screen.findByText('ERŐ')).toBeInTheDocument() // radar axis label (after the fetch resolves in real mode)
  expect(screen.getByText('Atlétikai profil')).toBeInTheDocument()
  expect(screen.getByText('Izom-szintek')).toBeInTheDocument()
})

test('Szerkesztés opens the BiometricSheet', async () => {
  renderProfile()
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  // The sheet's title appears once open.
  expect(screen.getByText('A motor ebből számol')).toBeInTheDocument()
})
