import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NightPage } from '@/features/me/pages/NightPage'
import { NIGHT_WATCHDOG_MIN, WATCHDOG_TICK_MS } from '@/features/me/logic/nightFlow'
import { userScopedKey } from '@/shared/lib/userScope'

const renderPage = () =>
  render(<MemoryRouter initialEntries={['/me/sleep/night']}><NightPage /></MemoryRouter>)

describe('NightPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T03:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test('idle: intro copy + Ébren vagyok CTA, no clock anywhere', () => {
    renderPage()
    expect(screen.getByText('Felébredtél?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ébren vagyok' })).toBeInTheDocument()
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull() // never render a clock
    // Üveg (mezo-me75u.6): the moon is the t-moon sprite, never the 🌙 emoji
    expect(document.querySelector('.night-moon use')).toHaveAttribute('href', '#t-moon')
    expect(document.body.textContent).not.toMatch(/🌙|🫁|🧘|🚶|🕯️/u)
  })

  test('Ébren vagyok -> waiting with the three tools, and records the night trace', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Légzés/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Testpásztázás/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4K-séta/ })).toBeInTheDocument()
    // Üveg (mezo-me75u.6): the tool rows wear the 3D sprite, not 🫁 🧘 🚶
    const art = (name: RegExp) =>
      screen.getByRole('button', { name }).querySelector('use')?.getAttribute('href')
    expect(art(/Légzés/)).toBe('#t-breath')
    expect(art(/Testpásztázás/)).toBe('#t-person')
    expect(art(/4K-séta/)).toBe('#t-steps')
    expect(localStorage.getItem(userScopedKey('night-wake:2026-07-24'))).not.toBeNull() // same value today (anon scope, no AuthGate here); derived so it self-corrects if that ever changes
  })

  test('a tool opens from waiting and megállítom returns to waiting', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    fireEvent.click(screen.getByRole('button', { name: /Légzés/ }))
    expect(screen.getByText('Be…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /megállítom/ }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
  })

  test('after ~20 minutes waiting flips to the getUp prompt (even while a tool is open)', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    fireEvent.click(screen.getByRole('button', { name: /Testpásztázás/ }))
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    expect(screen.getByText(/Kelj fel/)).toBeInTheDocument()
    expect(document.querySelector('.night-glow use')).toHaveAttribute('href', '#t-candle') // 🕯️ → t-candle
  })

  test('Visszafeküdtem starts a fresh waiting round', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    fireEvent.click(screen.getByRole('button', { name: 'Visszafeküdtem' }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    expect(screen.getByText(/Kelj fel/)).toBeInTheDocument() // the fresh round also completes
  })
})
