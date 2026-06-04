import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProfileView } from './ProfileView'

function renderProfile(onOpenSettings = () => {}) {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<ProfileView onOpenSettings={onOpenSettings} />} />
        <Route path="/me/knowledge" element={<div>TUDAS ROUTE</div>} />
        <Route path="/me/people" element={<div>EMBEREK ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
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
