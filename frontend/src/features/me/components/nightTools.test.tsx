import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NightBreathing } from '@/features/me/components/NightBreathing'
import { NightBodyScan } from '@/features/me/components/NightBodyScan'
import { NightWalk } from '@/features/me/components/NightWalk'
import { BODY_SCAN_STEP_MS, BODY_SCAN_STEPS, WALK_CARD_MS, WALK_CARDS } from '@/features/me/logic/nightContent'

describe('NightBreathing', () => {
  test('renders the three phase labels and the 5-6-7 eyebrow', () => {
    render(<NightBreathing onStop={() => {}} />)
    expect(screen.getByText('Be…')).toBeInTheDocument()
    expect(screen.getByText('Tartsd…')).toBeInTheDocument()
    expect(screen.getByText('Ki…')).toBeInTheDocument()
    expect(screen.getByText(/5 – 6 – 7/)).toBeInTheDocument()
  })
  test('stop button calls onStop', () => {
    const onStop = vi.fn()
    render(<NightBreathing onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: /megállítom/i }))
    expect(onStop).toHaveBeenCalled()
  })
})

describe('NightBodyScan', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('starts on step 1 and auto-advances after BODY_SCAN_STEP_MS', () => {
    render(<NightBodyScan onStop={() => {}} />)
    expect(screen.getByText(BODY_SCAN_STEPS[0].part)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(BODY_SCAN_STEP_MS))
    expect(screen.getByText(BODY_SCAN_STEPS[1].part)).toBeInTheDocument()
  })
  test('tap advances manually and stops at the last step', () => {
    render(<NightBodyScan onStop={() => {}} />)
    const stage = screen.getByRole('button', { name: /következő lépés/i })
    for (let i = 0; i < BODY_SCAN_STEPS.length + 2; i++) fireEvent.click(stage)
    expect(screen.getByText(BODY_SCAN_STEPS[BODY_SCAN_STEPS.length - 1].part)).toBeInTheDocument()
  })
})

describe('NightWalk', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('starts on the setup card, then advances to reminder cards', () => {
    render(<NightWalk onStop={() => {}} />)
    expect(screen.getByText('Válassz egy jól ismert utat')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(WALK_CARD_MS))
    expect(screen.getByText(WALK_CARDS[0])).toBeInTheDocument()
  })
  test('tap advances and clamps at the last card', () => {
    render(<NightWalk onStop={() => {}} />)
    const stage = screen.getByRole('button', { name: /következő kártya/i })
    for (let i = 0; i < WALK_CARDS.length + 3; i++) fireEvent.click(stage)
    expect(screen.getByText(WALK_CARDS[WALK_CARDS.length - 1])).toBeInTheDocument()
  })
})
