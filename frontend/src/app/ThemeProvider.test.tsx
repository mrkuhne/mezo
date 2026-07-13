import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/app/ThemeProvider'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>theme:{theme}</button>
}

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })

test('defaults to light and toggles to dark, persisting + setting data-theme', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:light')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(localStorage.getItem('mezo-theme')).toBe('dark')
})

test('a stored dark preference overrides the light default', () => {
  localStorage.setItem('mezo-theme', 'dark')
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
})
