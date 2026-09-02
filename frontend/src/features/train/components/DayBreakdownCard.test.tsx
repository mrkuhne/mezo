import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DayGroupRow } from '@/features/train/logic/setBudget'
import { DayBreakdownCard } from '@/features/train/components/DayBreakdownCard'

const over: DayGroupRow = { group: 'shoulder', label: 'Váll', colorMuscle: 'shoulder-front', sets: 12, exemptSets: 0, over: true }
const ok: DayGroupRow = { group: 'back', label: 'Hát', colorMuscle: 'back-wide', sets: 8, exemptSets: 0, over: false }
const plyoOnly: DayGroupRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', sets: 0, exemptSets: 4, over: false }

describe('DayBreakdownCard', () => {
  it('renders an over-cap row with the ⚠ mark', () => {
    render(<DayBreakdownCard rows={[over]} warnings={[]} />)
    expect(screen.getByText(/12 \/ 8/)).toBeInTheDocument()
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
  })

  it('renders an exempt-only row as "n kiegészítő" instead of the set count', () => {
    render(<DayBreakdownCard rows={[plyoOnly]} warnings={[]} />)
    expect(screen.getByText('4 kiegészítő')).toBeInTheDocument()
  })

  it('renders an ok row as "n / 8" without the warning mark', () => {
    render(<DayBreakdownCard rows={[ok]} warnings={[]} />)
    expect(screen.getByText('8 / 8')).toBeInTheDocument()
  })

  it('includes the suggestDay clause when given', () => {
    const { container } = render(<DayBreakdownCard rows={[over]} warnings={[{ label: 'Váll', sets: 12, suggestDay: 'Sze' }]} />)
    expect(screen.getByText(/Váll: ma 12 szett/)).toBeInTheDocument()
    expect(container.textContent).toMatch(/Váll: ma 12 szett — 8 fölött nincs kimutatható plusz\./)
    expect(container.textContent).toMatch(/\(pl\. Sze\)/)
  })

  it('omits the suggestDay clause when null', () => {
    const { container } = render(<DayBreakdownCard rows={[over]} warnings={[{ label: 'Váll', sets: 12, suggestDay: null }]} />)
    expect(screen.getByText(/Váll: ma 12 szett/)).toBeInTheDocument()
    expect(container.textContent).toMatch(/Váll: ma 12 szett — 8 fölött nincs kimutatható plusz\./)
    expect(container.textContent).not.toMatch(/pl\./)
  })

  it('renders nothing when rows is empty', () => {
    const { container } = render(<DayBreakdownCard rows={[]} warnings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
