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

const pipa = () => screen.queryByRole('button', { name: /Pipa/ })

describe('WindDownBanner', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('renders nothing during the day', () => {
    setClock('2026-07-24T15:00:00')
    const { container } = renderBanner()
    expect(container.querySelector('.todaycard')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })

  test('dim phase: title, three tips, countdown pill — and no habit CTA yet', () => {
    setClock('2026-07-24T22:00:00')
    const { container } = renderBanner()
    expect(screen.getByRole('heading', { name: 'Tompítsd a fényeket' })).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(3)
    expect(screen.getByText(/30 lux alá/)).toBeInTheDocument()
    expect(screen.getByText(/18 °C/)).toBeInTheDocument()
    expect(screen.getByText(/még 1 ó 15 p/)).toBeInTheDocument()
    // the wind_down habit's own window has not opened yet — nothing to tick here
    expect(pipa()).toBeNull()
  })

  test('winddown phase: Kapcsolj le + the wind_down habit CTA', () => {
    setClock('2026-07-24T22:30:00')
    const { container } = renderBanner()
    expect(screen.getByRole('heading', { name: 'Kapcsolj le' })).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(2)
    expect(screen.getByText(/Képernyők le/)).toBeInTheDocument()
    expect(screen.getByText(/még 45 p/)).toBeInTheDocument()
    expect(pipa()).toBeInTheDocument()
  })

  test('Pipa checks the habit and flips to the done state', async () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    fireEvent.click(pipa()!)
    expect(await screen.findByText(/Leállás megvolt/)).toBeInTheDocument()
    expect(pipa()).toBeNull()
  })

  test('night phase renders the dark entry row linking to /me/sleep/night', () => {
    setClock('2026-07-24T23:30:00')
    const { container } = renderBanner()
    const link = screen.getByRole('link', { name: /Éjszakai mód/ })
    expect(link).toHaveAttribute('href', '/me/sleep/night')
    // the night layer keeps its own literal-dark surface, NOT the light card language
    expect(container.querySelector('.todaycard')).toBeNull()
  })

  test('disappears after wake-30', () => {
    setClock('2026-07-24T06:20:00')
    const { container } = renderBanner()
    expect(container.querySelector('.todaycard')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })
})
