// frontend/src/app/CircadianTheme.test.tsx
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CircadianTheme } from '@/app/CircadianTheme'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mock goal bed 23:15 / wake 06:45 -> dark window 21:45-06:15.
const renderIt = () =>
  render(
    <QueryWrapper>
      <ThemeProvider>
        <CircadianTheme />
      </ThemeProvider>
    </QueryWrapper>,
  )

describe('CircadianTheme', () => {
  beforeEach(() => {
    localStorage.clear() // default mode: auto
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('applies dark inside the evening window', () => {
    vi.setSystemTime(new Date('2026-07-24T22:30:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
  test('applies light during the day', () => {
    vi.setSystemTime(new Date('2026-07-24T11:00:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
  test('manual mode wins: stored dark stays dark at noon', () => {
    localStorage.setItem('mezo-theme', 'dark')
    vi.setSystemTime(new Date('2026-07-24T11:00:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
