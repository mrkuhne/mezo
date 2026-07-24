import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'

describe('SleepStatCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-24T10:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test("renders today's deterministic stat with source label", () => {
    render(<SleepStatCard onOpen={() => {}} />)
    const stat = STAT_DECK[dailyStatIndex('2026-07-24')]
    expect(screen.getByText(stat.title)).toBeInTheDocument()
    expect(screen.getByText(stat.text)).toBeInTheDocument()
    expect(screen.getByText(stat.source)).toBeInTheDocument()
    expect(screen.getByText('Miért számít?')).toBeInTheDocument()
  })
  test('tapping the card calls onOpen', () => {
    const onOpen = vi.fn()
    render(<SleepStatCard onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })
})
