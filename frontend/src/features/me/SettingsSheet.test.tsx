import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSheet } from './SettingsSheet'
import { ThemeProvider } from '@/app/ThemeProvider'

function renderSheet(onClose = () => {}) {
  return render(<ThemeProvider><SettingsSheet onClose={onClose} /></ThemeProvider>)
}

test('renders the Téma and Értesítések sections', () => {
  renderSheet()
  expect(screen.getByText('Téma')).toBeInTheDocument()
  expect(screen.getByText('Értesítések')).toBeInTheDocument()
  expect(screen.getByText('AnchorMode push')).toBeInTheDocument()
})

test('the theme toggle flips data-theme via useTheme', async () => {
  document.documentElement.removeAttribute('data-theme')
  renderSheet()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})

test('closes on Escape', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
