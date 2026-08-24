import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotificationBell } from '@/features/notification/components/NotificationBell'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderBell = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<NotificationBell />} />
          <Route path="/insights/knowledge" element={<div>TUDÁSTÁR OLDAL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

test('badge shows the seed unread count', () => {
  renderBell()
  expect(screen.getByLabelText('Értesítések, 3 olvasatlan')).toBeInTheDocument()
})

test('opening shows Ma/Tegnap groups and clears the badge', async () => {
  renderBell()
  await userEvent.click(screen.getByLabelText('Értesítések, 3 olvasatlan'))
  expect(screen.getByText('Ma')).toBeInTheDocument()
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText('Új minta vár döntésre')).toBeInTheDocument()
  // Read-all fired on open — the accessible name drops the unread count. Scoped to the
  // button role: the panel (role="dialog") shares the same "Értesítések" aria-label once
  // the badge clears, so a plain findByLabelText would match both and throw ambiguous.
  expect(await screen.findByRole('button', { name: 'Értesítések' })).toBeInTheDocument()
})

test('tapping an item deeplinks and closes the panel', async () => {
  renderBell()
  await userEvent.click(screen.getByLabelText('Értesítések, 3 olvasatlan'))
  await userEvent.click(screen.getByText('Új tény vár jóváhagyásra'))
  expect(await screen.findByText('TUDÁSTÁR OLDAL')).toBeInTheDocument()
  expect(screen.queryByText('Értesítések')).not.toBeInTheDocument()
})
