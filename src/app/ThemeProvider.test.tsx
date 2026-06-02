import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>theme:{theme}</button>
}

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })

test('defaults to dark and toggles to light, persisting + setting data-theme', async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>)
  expect(screen.getByText('theme:dark')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByText('theme:light')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  expect(localStorage.getItem('mezo-theme')).toBe('light')
})
