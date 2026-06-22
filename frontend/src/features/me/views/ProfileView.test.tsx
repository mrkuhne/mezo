import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProfileView } from './ProfileView'
import { QueryWrapper } from '@/test/queryWrapper'

function renderProfile(onOpenSettings = () => {}) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me']}>
        <Routes>
          <Route path="/me" element={<ProfileView onOpenSettings={onOpenSettings} />} />
          <Route path="/me/knowledge" element={<div>TUDAS ROUTE</div>} />
          <Route path="/me/people" element={<div>EMBEREK ROUTE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the user header, streak and version footer', () => {
  renderProfile()
  expect(screen.getByRole('heading', { level: 1, name: 'Daniel' })).toBeInTheDocument()
  expect(screen.getByText('@daniel.kuhne')).toBeInTheDocument()
  expect(screen.getByText('27d')).toBeInTheDocument()
  expect(screen.getByText(/v2\.0\.1/)).toBeInTheDocument()
})

test('gear chip calls onOpenSettings', async () => {
  const onOpenSettings = vi.fn()
  renderProfile(onOpenSettings)
  await userEvent.click(screen.getByRole('button', { name: 'Beállítások' }))
  expect(onOpenSettings).toHaveBeenCalledTimes(1)
})

test('Tudás entry card navigates to /me/knowledge', async () => {
  renderProfile()
  await userEvent.click(screen.getByText(/Knowledge graph · Tudás/))
  expect(screen.getByText('TUDAS ROUTE')).toBeInTheDocument()
})

test('renders the Biometria card with the derived base-TDEE line', async () => {
  renderProfile()
  // Card resolves from useBiometricProfile (mock static / MSW default profile).
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  expect(screen.getByText(/≈2960/)).toBeInTheDocument()
})

test('Szerkesztés opens the BiometricSheet', async () => {
  renderProfile()
  await waitFor(() => expect(screen.getByText('Biometria')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  // The sheet's title appears once open.
  expect(screen.getByText('A motor ebből számol')).toBeInTheDocument()
})
