import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DayGroupRow } from '@/features/train/logic/setBudget'
import { DayBreakdownCard } from '@/features/train/components/DayBreakdownCard'

const over: DayGroupRow = { group: 'shoulder', label: 'Váll', colorMuscle: 'shoulder-front', sets: 12, exemptSets: 0, over: true }
const ok: DayGroupRow = { group: 'back', label: 'Hát', colorMuscle: 'back-wide', sets: 8, exemptSets: 0, over: false }
const plyoOnly: DayGroupRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', sets: 0, exemptSets: 4, over: false }

describe('DayBreakdownCard', () => {
  // Folyadék (mezo-n4wf5.3): an over-cap row is its level in the warning colour standing past the cap's
  // waterline; the meaning is spoken by an sr-only name, never a ⚠ glyph.
  it('renders an over-cap row as a warning-coloured level past the waterline, with its spoken meaning', () => {
    const { container } = render(<DayBreakdownCard rows={[over]} warnings={[]} />)
    expect(screen.getByText(/12 \/ 8/)).toBeInTheDocument()
    expect(screen.getByText(/a határ fölött/)).toBeInTheDocument()
    const level = container.querySelector('.fo-wlv') as HTMLElement
    expect(level.style.getPropertyValue('--c')).toBe('var(--fo-warn)')
    expect(level.querySelectorAll('u')).toHaveLength(1) // the cap's waterline
    expect(container.textContent).not.toMatch(/⚠/)
  })

  it('the card opens with the key of the waterline', () => {
    render(<DayBreakdownCard rows={[ok]} warnings={[]} />)
    expect(screen.getByText('max 8 szett/izom')).toBeInTheDocument()
  })

  it('renders an exempt-only row as "n kiegészítő" instead of the set count', () => {
    render(<DayBreakdownCard rows={[plyoOnly]} warnings={[]} />)
    expect(screen.getByText('4 kiegészítő')).toBeInTheDocument()
  })

  it('renders an exempt-only row without a level', () => {
    const { container } = render(<DayBreakdownCard rows={[plyoOnly]} warnings={[]} />)
    expect(container.querySelector('.fo-wlv')).toBeNull()
  })

  it('renders an ok row as "n / 8" in the muscle colour, without the warning meaning', () => {
    const { container } = render(<DayBreakdownCard rows={[ok]} warnings={[]} />)
    expect(screen.getByText('8 / 8')).toBeInTheDocument()
    expect(screen.queryByText(/a határ fölött/)).not.toBeInTheDocument()
    expect((container.querySelector('.fo-wlv') as HTMLElement).style.getPropertyValue('--c')).not.toBe('var(--fo-warn)')
  })

  it('includes the suggestDay clause when given', () => {
    const { container } = render(<DayBreakdownCard rows={[over]} warnings={[{ label: 'Váll', sets: 12, suggestDay: 'Sze' }]} />)
    // the callout: the info glyph, the group and its sets as the title, the explanation under it
    expect(screen.getByText('Váll: ma 12 szett')).toBeInTheDocument()
    expect(container.querySelector('.fo-box use[href="#t-info"]')).not.toBeNull()
    expect(container.textContent).toMatch(/8 fölött nincs kimutatható plusz\./)
    expect(container.textContent).toMatch(/\(pl\. Sze\)/)
  })

  it('omits the suggestDay clause when null', () => {
    const { container } = render(<DayBreakdownCard rows={[over]} warnings={[{ label: 'Váll', sets: 12, suggestDay: null }]} />)
    expect(screen.getByText('Váll: ma 12 szett')).toBeInTheDocument()
    expect(container.textContent).toMatch(/8 fölött nincs kimutatható plusz\./)
    expect(container.textContent).not.toMatch(/pl\./)
  })

  it('renders nothing when rows is empty', () => {
    const { container } = render(<DayBreakdownCard rows={[]} warnings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
