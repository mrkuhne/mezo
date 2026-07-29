import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { gymLevelUpMock } from '@/data/progression/progressionMock'

// `useHabitActions` is a spy that DELEGATES to the real hook by default (so the Pipa flow keeps
// exercising the shared ['habitDay', date] cache write), and is overridden in the level-up test
// to hand back a LevelUpResult the mock XP curve would not reach on its own.
const hooks = vi.hoisted(() => ({
  useHabitActions: vi.fn(),
  real: { fn: null as unknown as (typeof import('@/data/hooks'))['useHabitActions'] },
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  hooks.real.fn = orig.useHabitActions
  return { ...orig, useHabitActions: hooks.useHabitActions }
})

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
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useHabitActions.mockImplementation((d: string) => hooks.real.fn(d))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('renders nothing during the day', () => {
    setClock('2026-07-24T15:00:00')
    const { container } = renderBanner()
    expect(container.querySelector('.todaycard')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })

  test('dim phase: title, three FULL tips, the Walker evidence line, countdown — and no habit CTA yet', () => {
    setClock('2026-07-24T22:00:00')
    const { container } = renderBanner()
    expect(screen.getByRole('heading', { name: 'Tompítsd a fényeket' })).toBeInTheDocument()
    expect(container.querySelectorAll('.todaycard-tip')).toHaveLength(3)
    // each tip keeps BOTH halves: the number/instruction AND what it means
    expect(screen.getByText(/30 lux alá/)).toBeInTheDocument()
    expect(screen.getByText(/félhomály, nem sötét/)).toBeInTheDocument()
    expect(screen.getByText(/Meleg, sárga fény/)).toBeInTheDocument()
    expect(screen.getByText(/hideg-fehér le/)).toBeInTheDocument()
    expect(screen.getByText(/Hűtsd a szobát/)).toBeInTheDocument()
    expect(screen.getByText(/18 °C felé/)).toBeInTheDocument()
    // the provenance that justifies the advice (mezo-j7u4 fix round 1)
    expect(screen.getByText(/\+18% REM/)).toBeInTheDocument()
    expect(screen.getByText(/Walker mérése/)).toBeInTheDocument()
    expect(screen.getByText(/még 1 ó 15 p/)).toBeInTheDocument()
    // the wind_down habit's own window has not opened yet — nothing to tick here
    expect(pipa()).toBeNull()
  })

  test('winddown phase: Kapcsolj le, both FULL tips, and the habit row with its title, anchor cue and XP', () => {
    setClock('2026-07-24T22:30:00')
    const { container } = renderBanner()
    expect(screen.getByRole('heading', { name: 'Kapcsolj le' })).toBeInTheDocument()
    expect(container.querySelectorAll('.todaycard-tip')).toHaveLength(2)
    expect(screen.getByText(/Képernyők le/)).toBeInTheDocument()
    expect(screen.getByText(/az agy hadd unatkozzon/)).toBeInTheDocument()
    expect(screen.getByText(/Fények tompítva/)).toBeInTheDocument()
    expect(screen.getByText(/maradnak/)).toBeInTheDocument()
    // the habit keeps its identity, its anchor cue and its reward (mezo-j7u4 fix round 1)
    expect(screen.getByText('Wind-down, képernyő le')).toBeInTheDocument()
    expect(screen.getByText(/napzárás után/)).toBeInTheDocument()
    expect(screen.getByText(/\+5 XP/)).toBeInTheDocument()
    expect(screen.getByText(/még 45 p/)).toBeInTheDocument()
    expect(pipa()).toBeInTheDocument()
    // the dim-only evidence line does not leak into the winddown phase
    expect(screen.queryByText(/Walker mérése/)).toBeNull()
  })

  test('Pipa checks the habit and flips to the full done line', async () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    fireEvent.click(pipa()!)
    expect(await screen.findByText(/Leállás megvolt/)).toBeInTheDocument()
    expect(screen.getByText(/már csak az ágy van hátra/)).toBeInTheDocument()
    expect(pipa()).toBeNull()
    // the habit row retires once ticked — the done line speaks for it
    expect(screen.queryByText('Wind-down, képernyő le')).toBeNull()
  })

  test('a level-up from the wind_down check reaches the LevelUp overlay', async () => {
    // reduced motion, so the overlay settles without animation timers under fake timers
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    setClock('2026-07-24T22:30:00')
    hooks.useHabitActions.mockReturnValue({
      check: vi.fn().mockResolvedValue([gymLevelUpMock]), uncheck: vi.fn(),
      pending: false, consumeLevelUps: vi.fn(),
    })
    renderBanner()
    fireEvent.click(pipa()!)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  test('the 30 s self-tick re-derives the phase in place (no remount)', async () => {
    setClock('2026-07-24T22:14:50') // dim, 10 s short of the winddown boundary
    renderBanner()
    expect(screen.getByRole('heading', { name: 'Tompítsd a fényeket' })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(screen.getByRole('heading', { name: 'Kapcsolj le' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tompítsd a fényeket' })).toBeNull()
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
