import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DaypartHero, DaypartPanel } from '@/features/today/components/DaypartPanel'

describe('DaypartPanel', () => {
  test('carries the daypart tone and NO card shell', () => {
    const { container } = render(<DaypartPanel tone="nap"><div>tartalom</div></DaypartPanel>)
    const view = container.querySelector('.dayview')!
    expect(view).toHaveAttribute('data-tone', 'nap')
    // the retired island shell must not come back
    expect(container.querySelector('.isl, .isl-big, .isl-blob, .isl-bigview')).toBeNull()
    expect(screen.getByText('tartalom')).toBeInTheDocument()
  })

  test('the night phase darkens the view itself', () => {
    const { container } = render(<DaypartPanel tone="este" night><div /></DaypartPanel>)
    expect(container.querySelector('.dayview.is-night')).toBeInTheDocument()
  })
})

describe('DaypartHero', () => {
  test('value, unit and sub all render', () => {
    render(<DaypartHero value="13:00" unit="· Pull A" sub="~55 perc · 3. mezóhét" />)
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.getByText('· Pull A')).toBeInTheDocument()
    expect(screen.getByText('~55 perc · 3. mezóhét')).toBeInTheDocument()
  })

  test('a missing unit or sub simply does not render', () => {
    const { container } = render(<DaypartHero value="Pihenő" />)
    expect(container.querySelector('.td-hero-u')).toBeNull()
    expect(container.querySelector('.td-hero-s')).toBeNull()
  })
})
