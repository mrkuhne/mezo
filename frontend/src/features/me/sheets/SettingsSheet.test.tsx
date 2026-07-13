import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { ThemeProvider } from '@/app/ThemeProvider'

function renderSheet(onClose = () => {}) {
  return render(<ThemeProvider><SettingsSheet onClose={onClose} /></ThemeProvider>)
}

test('renders the Téma section', () => {
  renderSheet()
  expect(screen.getByText('Téma')).toBeInTheDocument()
  expect(screen.getByText(/Light mód|Dark mód/)).toBeInTheDocument()
})

test('the theme toggle flips data-theme via useTheme', async () => {
  localStorage.clear()
  renderSheet()
  // Light is the default (no attribute; light is the CSS base); toggling flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('closes on Escape', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
