import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from '@/app/TabBar'
import { QuickLogFab } from '@/app/QuickLogFab'
import { resetNavMemory } from '@/app/navModel'
import { QueryWrapper } from '@/test/queryWrapper'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'

beforeEach(() => resetNavMemory())

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

// Titanium navigation (mezo-jkh4): the bottom bar is a domain-switch mark + the CURRENT
// domain's four contextual tabs — not the always-flat five-domain bar. The switch mark
// carries the Mezo companion mark, the current domain's name and a ⌃ caret; tapping it
// opens the domain-switcher dialog.

test('the bar shows the switch mark + the current domain (Nap) and its four tabs', () => {
  renderAt('/nap', <TabBar />)
  expect(screen.getByRole('button', { name: 'Területváltó: Nap' })).toBeInTheDocument()
  for (const label of ['Mai', 'Beszélgetés', 'Rutin', 'Napzárás']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  // The other domains' tabs are NOT on the bar — this is a contextual bar, not a flat one.
  expect(screen.queryByText('Receptek')).not.toBeInTheDocument()
  expect(screen.queryByText('Súly')).not.toBeInTheDocument()
})

test("each tab renders its clay icon via a sprite use ref (Nap's four + the switch mark)", () => {
  const { container } = renderAt('/nap', <TabBar />)
  for (const sym of ['i-mezo', 'i-nap', 'i-rend', 'i-hold']) {
    expect(container.querySelector(`use[href="#${sym}"]`)).not.toBeNull()
  }
})

test('marks the active tab via longest-matching-prefix — /nap/rutin lights Rutin, not Mai', () => {
  renderAt('/nap/rutin', <TabBar />)
  expect(screen.getByText('Rutin').closest('a')!.className).toContain('active')
  expect(screen.getByText('Mai').closest('a')!.className).not.toContain('active')
})

test('the active domain is derived from the first path segment — /train/week shows Edzés', () => {
  renderAt('/train/week', <TabBar />)
  expect(screen.getByRole('button', { name: 'Területváltó: Edzés' })).toBeInTheDocument()
  for (const label of ['Mai', 'Terhelés', 'Napló', 'Tervek']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.getByText('Terhelés').closest('a')!.className).toContain('active')
})

test('a domain sub-page that is not one of the four keeps the bar with no tab highlighted', () => {
  const { container } = renderAt('/train/sport', <TabBar />)
  expect(container.querySelector('a.tab-item.active')).toBeNull()
  // The domain bar itself still resolves to Edzés.
  expect(screen.getByRole('button', { name: 'Területváltó: Edzés' })).toBeInTheDocument()
})

test('the switch mark opens the domain-switcher dialog listing the five domains', async () => {
  renderAt('/nap', <TabBar />)
  await userEvent.click(screen.getByRole('button', { name: 'Területváltó: Nap' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Egy társ. Öt világ.')).toBeInTheDocument()
  for (const name of ['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én']) {
    expect(within(dialog).getByText(name)).toBeInTheDocument()
  }
  // Each domain lists its four tab labels joined by " · ".
  expect(within(dialog).getByText('Mai · Beszélgetés · Rutin · Napzárás')).toBeInTheDocument()
  expect(within(dialog).getByText('Felfedezések · Előrejelzések · Karakter · Tudástár')).toBeInTheDocument()
})

// --- The floating FAB (unchanged by the Titanium rebuild — kept from mezo-mhum) ---

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
