import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NightPage } from '@/features/me/pages/NightPage'
import { NIGHT_WATCHDOG_MIN, WATCHDOG_TICK_MS } from '@/features/me/logic/nightFlow'

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
  })

  test('Ébren vagyok -> waiting with the three tools, and records the night trace', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Légzés/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Testpásztázás/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4K-séta/ })).toBeInTheDocument()
    expect(localStorage.getItem('mezo-night-wake:2026-07-24')).not.toBeNull()
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
