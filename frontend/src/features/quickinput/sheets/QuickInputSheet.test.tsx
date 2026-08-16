import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}
function renderSheet(onClose = () => {}) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

test('renders all eight quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Edzés', 'Víz', 'Súly', 'Stack', 'Check-in', 'Alvás', 'Napló'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
test('a tile closes the sheet and navigates to its target', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Súly'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})
test('the chat row closes the sheet and navigates to the companion chat', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Beszélgetés a társsal'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/insights/chat')
})

test('the Napló tile swaps the menu for the activity log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  expect(await screen.findByText('Tevékenységnapló')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})
