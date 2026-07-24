import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mock goal: bed 23:15 / wake 06:45 (data/me/sleepGoal.ts) ->
// dim 21:45-22:15 · winddown 22:15-23:15 · night 23:15-06:15.
const renderBanner = () =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <WindDownBanner />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

const setClock = (iso: string) => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(iso))
}

describe('WindDownBanner', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('renders nothing during the day', () => {
    setClock('2026-07-24T15:00:00')
    const { container } = renderBanner()
    expect(container.querySelector('.wdb')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })

  test('dim phase: title, three tips, REM stat, countdown pill', () => {
    setClock('2026-07-24T22:00:00')
    renderBanner()
    expect(screen.getByText('Tompítsd a fényeket')).toBeInTheDocument()
    expect(screen.getByText(/30 lux alá/)).toBeInTheDocument()
    expect(screen.getByText(/18 °C felé/)).toBeInTheDocument()
    expect(screen.getByText(/\+18% REM/)).toBeInTheDocument()
    expect(screen.getByText(/még 1 ó 15 p/)).toBeInTheDocument()
  })

  test('winddown phase: Kapcsolj le + the wind_down habit row with Pipa', () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    expect(screen.getByText('Kapcsolj le')).toBeInTheDocument()
    expect(screen.getByText('Wind-down, képernyő le')).toBeInTheDocument()
    expect(screen.getByText('+5 XP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pipálása/ })).toBeInTheDocument()
  })

  test('Pipa checks the habit and flips to the done state', async () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /pipálása/ }))
    expect(await screen.findByText(/Leállás megvolt/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pipálása/ })).toBeNull()
  })

  test('night phase renders the dark entry row linking to /me/sleep/night', () => {
    setClock('2026-07-24T23:30:00')
    renderBanner()
    const link = screen.getByRole('link', { name: /Éjszakai mód/ })
    expect(link).toHaveAttribute('href', '/me/sleep/night')
  })

  test('disappears after wake-30', () => {
    setClock('2026-07-24T06:20:00')
    const { container } = renderBanner()
    expect(container.querySelector('.wdb')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })
})
