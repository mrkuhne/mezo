// frontend/src/app/ThemeProvider.test.tsx
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ThemeProvider, useForceTheme, useTheme } from '@/app/ThemeProvider'

/** One independent force-theme owner, mountable/unmountable from the test. */
function Owner({ theme }: { theme: 'dark' | 'light' | null }) {
  useForceTheme(theme)
  return null
}

function Probe() {
  const { theme, mode, setMode, setAutoTheme } = useTheme()
  const [forced, setForced] = useState<'dark' | null>(null)
  return (
    <div>
      <span data-testid="state">{mode}/{theme}</span>
      <button onClick={() => setMode('dark')}>mode-dark</button>
      <button onClick={() => setMode('light')}>mode-light</button>
      <button onClick={() => setMode('auto')}>mode-auto</button>
      <button onClick={() => setAutoTheme('dark')}>auto-dark</button>
      <button onClick={() => setForced('dark')}>force-dark</button>
      <button onClick={() => setForced(null)}>force-clear</button>
      <Owner theme={forced} />
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

  // mezo-tr5v: the ritual forces dark for the duration of its flow, then clears it on exit.
  test('useForceTheme(dark) wins over the mode and does NOT persist; null reverts', () => {
    localStorage.setItem('mezo-theme', 'light')
    renderProbe()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull() // manual light

    fireEvent.click(screen.getByText('force-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark') // override wins
    expect(localStorage.getItem('mezo-theme')).toBe('light') // preference untouched

    fireEvent.click(screen.getByText('force-clear'))
    expect(document.documentElement.getAttribute('data-theme')).toBeNull() // back to light
  })

  // mezo-mhum fix-wave: two owners can hold the override at once (the Titán Nap shell and the
  // Napzárás ritual on /nap → /ritual). Releasing the FIRST one must not drop the second's.
  test('claims stack: one owner releasing does not clear another owner\'s override', () => {
    localStorage.setItem('mezo-theme', 'light')
    function Two({ a, b }: { a: 'dark' | null, b: 'dark' | null }) {
      return <><Owner theme={a} /><Owner theme={b} /></>
    }
    const { rerender } = render(
      <ThemeProvider><Two a="dark" b={null} /></ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // The second owner claims, then the first releases — the override must survive.
    rerender(<ThemeProvider><Two a="dark" b="dark" /></ThemeProvider>)
    rerender(<ThemeProvider><Two a={null} b="dark" /></ThemeProvider>)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Only when the LAST claim goes does the user's real preference come back.
    rerender(<ThemeProvider><Two a={null} b={null} /></ThemeProvider>)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
