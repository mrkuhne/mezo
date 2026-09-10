import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'
import { QuickLogFab } from '@/app/QuickLogFab'
import { QueryWrapper } from '@/test/queryWrapper'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

function renderFabAt(path: string) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="*" element={<><QuickLogFab /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

// Design 2.0 decision B (mezo-d20.1.1): five first-class tabs, the quick log moves to a
// floating FAB — the tab bar itself carries no center button any more.

test('renders the five tab labels — Nap · Edzés · Fuel · Mezo · Én', () => {
  renderAt('/nap', <TabBar />)
  for (const label of ['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.queryByText('Ma')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Gyors logolás' })).not.toBeInTheDocument()
})

test('each tab renders its clay icon via a sprite use ref', () => {
  const { container } = renderAt('/nap', <TabBar />)
  for (const sym of ['i-nap', 'i-edzes', 'i-fuel', 'i-mezo', 'i-emberek']) {
    expect(container.querySelector(`use[href="#${sym}"]`)).not.toBeNull()
  }
})

test('marks the current route tab active — /nap and /mezo included', () => {
  renderAt('/mezo', <TabBar />)
  expect(screen.getByText('Mezo').closest('a')!.className).toContain('active')
  expect(screen.getByText('Nap').closest('a')!.className).not.toContain('active')
})

test('the floating FAB opens the quick-log sheet away from /nap', async () => {
  renderFabAt('/train')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.getByText('Gyors logolás', { selector: 'h2' })).toBeInTheDocument()
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
})

// Titanium rebuild (mezo-mhum): from /nap EXACTLY the FAB is the tile→page portal to the
// full-page quick-log picker instead of the modal sheet — every other route (including /nap's
// own subpages, e.g. /nap/checkin) keeps opening the sheet, covered by the test above.
test('the floating FAB navigates to the full-page picker from /nap exactly', async () => {
  renderFabAt('/nap')
  await userEvent.click(screen.getByRole('button', { name: 'Gyors logolás' }))
  expect(screen.queryByText('Gyors logolás', { selector: 'h2' })).not.toBeInTheDocument()
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/gyors')
})
