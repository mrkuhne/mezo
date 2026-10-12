import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from '@/shared/ui/DatePicker'
import { addDays } from '@/shared/lib/dates'

describe('addDays', () => {
  it('steps forward and back across month boundaries (local, DST-safe)', () => {
    expect(addDays('2026-07-20', 1)).toBe('2026-07-21')
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
    expect(addDays('2026-07-20', 7)).toBe('2026-07-27')
  })
})

describe('DatePicker', () => {
  it('shows the formatted trigger label and opens the calendar on click', () => {
    render(<DatePicker value="2026-07-20" onChange={() => {}} maxDate="2026-07-27" />)
    const trigger = screen.getByRole('button', { name: /dátum kiválasztása/i })
    expect(trigger).toHaveTextContent('Júl 20') // huMonthDayDow default
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fires onChange with the ISO date and closes when a day is picked', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    fireEvent.click(screen.getByRole('button', { name: '2026-07-15' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables days after maxDate (no future selection)', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    const future = screen.getByRole('button', { name: '2026-07-28' })
    expect(future).toBeDisabled()
    fireEvent.click(future)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on Escape without firing onChange', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-07-20" onChange={onChange} maxDate="2026-07-27" />)
    fireEvent.click(screen.getByRole('button', { name: /dátum kiválasztása/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

// Folyadék F5 (mezo-n4wf5.5): the calendar speaks the app language — its words come from the frame catalog, the month
// and the weekday heads from format.ts — and follows a runtime switch.
test('the calendar follows the app language: names, month header, weekday heads', async () => {
  const { act } = await import('@testing-library/react')
  const { setLang } = await import('@/shared/i18n')
  render(<DatePicker value="2026-10-06" maxDate="2026-10-07" onChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dátum kiválasztása' }))
  const cal = screen.getByRole('dialog', { name: 'Naptár' })
  expect(cal.querySelector('.dp-head strong')).toHaveTextContent('2026. október')
  expect([...cal.querySelectorAll('.dp-dow')].map((d) => d.textContent)).toEqual(['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'])
  expect(screen.getByRole('button', { name: 'Előző hónap' })).toBeInTheDocument()
  try {
    act(() => setLang('en', { persist: false }))
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toBe(cal)
    expect(cal.querySelector('.dp-head strong')).toHaveTextContent('October 2026')
    expect([...cal.querySelectorAll('.dp-dow')].map((d) => d.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(screen.getByRole('button', { name: 'Pick a date' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('dp-veil')
  } finally {
    act(() => setLang('hu', { persist: false }))
  }
})
