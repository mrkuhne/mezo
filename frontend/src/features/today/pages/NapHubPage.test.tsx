import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Nap hub (mezo-d20.2.1) — the day spine's Mozaik face: header recipe (date eyebrow +
// daypart switch + bell + orb avatar), one hero per daypart panel, then the 2-column
// mosaic. Detail pages are F1.2–F1.6; until they land the tiles open the existing sheets.

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname + useLocation().search}</div>
}

function renderHub(path = '/nap?dp=nap') {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="/nap" element={<><NapHubPage /><LocationProbe /></>} /></Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

test('the header carries the date eyebrow, the daypart switch, the bell and the orb avatar', async () => {
  renderHub()
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Értesítések/ })).toBeInTheDocument()
  expect(document.querySelector('.nap-avatar use[href="#i-mezo"]')).not.toBeNull()
})

test('the daypart switch opens a 3-option menu and switching re-renders the panel + updates ?dp', async () => {
  renderHub('/nap?dp=nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await userEvent.click(screen.getByRole('menuitem', { name: 'Este' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('dp=este')
  expect(await screen.findByText('Villanyoltásig')).toBeInTheDocument()
  expect(menu).not.toBeInTheDocument()
})

test('the Nap panel hero is the keret: remaining kcal + day-bar', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByText(/kcal maradt/)).toBeInTheDocument()
  expect(document.querySelector('.daybar')).not.toBeNull()
})

test('the Reggel panel hero is the night summary with the h:mm duration', async () => {
  renderHub('/nap?dp=reggel')
  expect(await screen.findByText('Éjszakád')).toBeInTheDocument()
  // seed lastNight: duration 7.5 HOURS → 7:30 (a minutes-fed formatter would show 0:07)
  expect(screen.getByText('7:30')).toBeInTheDocument()
})

test('the Este panel offers the Napzárás CTA which navigates to /ritual', async () => {
  render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap?dp=este']}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/ritual" element={<div>ritual-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Zárjuk le a napot' }))
  expect(await screen.findByText('ritual-page')).toBeInTheDocument()
})

test('the mosaic tiles render with clay spots — Mezo, Küldetések, Check-in, Életjel', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByRole('button', { name: 'Mezo üzenetei' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check-in' })).toBeInTheDocument()
  expect(document.querySelector('.nap-bigring')).not.toBeNull()
})

test('the Mezo tile opens the messages sheet in place', async () => {
  renderHub('/nap?dp=nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Mezo üzenetei' }))
  expect(await screen.findByText('Mezo üzenetei')).toBeInTheDocument()
})

test('the water tile logs +2,5 dl in place and the counter moves', async () => {
  renderHub('/nap?dp=nap')
  const tile = await screen.findByRole('button', { name: /Víz/ })
  expect(tile).toHaveTextContent('1,85')
  await userEvent.click(tile)
  expect(tile).toHaveTextContent('2,1')
})
