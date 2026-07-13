import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}
function renderSheet(onClose = () => {}) {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
    </MemoryRouter>,
  )
}

test('renders all six quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Edzés', 'Víz', 'Súly', 'Stack', 'Check-in'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('a tile closes the sheet and navigates to its target', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Súly'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})
