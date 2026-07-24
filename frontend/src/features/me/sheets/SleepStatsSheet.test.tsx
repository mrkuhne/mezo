import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { STAT_DECK } from '@/features/me/logic/sleepEducation'

describe('SleepStatsSheet', () => {
  test('renders every deck card with title and source', () => {
    render(<SleepStatsSheet escalation={null} onClose={() => {}} />)
    for (const s of STAT_DECK) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
      expect(screen.getAllByText(s.source).length).toBeGreaterThan(0) // sources repeat (3x 'M. Walker')
    }
    expect(screen.queryByText(/öngyilkossági/)).toBeNull() // heavy stats only with escalation
  })
  test('escalation section renders the heavy stats + CBT-I copy when triggered', () => {
    render(<SleepStatsSheet escalation="short" onClose={() => {}} />)
    expect(screen.getByText(/öngyilkossági rizikót/)).toBeInTheDocument()
    expect(screen.getByText(/CBT-I/)).toBeInTheDocument()
    expect(screen.getByText(/tartósan kevés az alvásod/i)).toBeInTheDocument()
  })
  test('quality reason gets the quality lead-in', () => {
    render(<SleepStatsSheet escalation="quality" onClose={() => {}} />)
    expect(screen.getByText(/tartósan rossz minőségű az alvásod/i)).toBeInTheDocument()
  })
})
