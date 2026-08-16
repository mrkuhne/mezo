import { afterEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const checkinsMock = vi.hoisted(() => ({ useCheckins: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCheckins: () => checkinsMock.useCheckins() ?? actual.useCheckins() }
})

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

test('the Alvás tile swaps the menu for the sleep log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Alvás'))
  expect(await screen.findByText('Hogyan aludtunk?')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('the Check-in tile swaps the menu for the check-in sheet on the next fillable slot', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Check-in'))
  expect(await screen.findByText(/Heartbeat ·/)).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('with every slot done the Check-in tile falls back to navigating to Today', async () => {
  checkinsMock.useCheckins.mockReturnValue({
    checkins: ['06:30', '10:00', '14:00', '20:00'].map(time => ({
      time, state: 'done' as const, values: null, note: null,
    })),
    saveCheckIn: vi.fn(),
  })
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('mára mind megvan')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Check-in'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/today')
})

afterEach(() => checkinsMock.useCheckins.mockReset())
