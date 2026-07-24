import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { ThemeProvider } from '@/app/ThemeProvider'

function renderSheet(onClose = () => {}) {
  return render(<ThemeProvider><SettingsSheet onClose={onClose} /></ThemeProvider>)
}

beforeEach(() => localStorage.clear())
afterEach(() => document.documentElement.removeAttribute('data-theme'))

test('renders the Téma section', () => {
  renderSheet()
  expect(screen.getByText('Téma')).toBeInTheDocument()
})

test('renders the three theme options', () => {
  renderSheet()
  expect(screen.getByRole('button', { name: /Világos/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Sötét/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Cirkadián/ })).toBeInTheDocument()
})

test('Sötét applies dark and persists the manual mode', () => {
  renderSheet()
  fireEvent.click(screen.getByRole('button', { name: /Sötét/ }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(localStorage.getItem('mezo-theme')).toBe('dark')
})

test('Cirkadián persists auto mode and marks the option selected', () => {
  renderSheet()
  fireEvent.click(screen.getByRole('button', { name: /Cirkadián/ }))
  expect(localStorage.getItem('mezo-theme')).toBe('auto')
  expect(screen.getByRole('button', { name: /Cirkadián/ })).toHaveAttribute('aria-pressed', 'true')
})

test('closes on Escape', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
