// frontend/src/app/ThemeProvider.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ThemeProvider, useTheme } from '@/app/ThemeProvider'

function Probe() {
  const { theme, mode, setMode, setAutoTheme } = useTheme()
  return (
    <div>
      <span data-testid="state">{mode}/{theme}</span>
      <button onClick={() => setMode('dark')}>mode-dark</button>
      <button onClick={() => setMode('light')}>mode-light</button>
      <button onClick={() => setMode('auto')}>mode-auto</button>
      <button onClick={() => setAutoTheme('dark')}>auto-dark</button>
    </div>
  )
}
const renderProbe = () => render(<ThemeProvider><Probe /></ThemeProvider>)

describe('ThemeProvider (mode API, mezo-d71m)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => document.documentElement.removeAttribute('data-theme'))

  test('defaults to auto mode with light applied', () => {
    renderProbe()
    expect(screen.getByTestId('state')).toHaveTextContent('auto/light')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  test('setMode(dark) applies + persists the manual mode', () => {
    renderProbe()
    fireEvent.click(screen.getByText('mode-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('mezo-theme')).toBe('dark')
  })

  test('legacy stored light boots as manual light', () => {
    localStorage.setItem('mezo-theme', 'light')
    renderProbe()
    expect(screen.getByTestId('state')).toHaveTextContent('light/light')
  })

  test('setAutoTheme drives the applied theme only in auto mode', () => {
    renderProbe()
    fireEvent.click(screen.getByText('auto-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    fireEvent.click(screen.getByText('mode-light'))
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    fireEvent.click(screen.getByText('auto-dark')) // ignored while manual
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
