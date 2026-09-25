import { render, screen } from '@testing-library/react'
import {
  PATTERN_DOMAIN_ART,
  PATTERN_DOMAIN_MARK_ART,
  PatternDomainMark,
} from '@/features/insights/components/PatternDomainMark'

// mezo-me75u.9: a lista / döntés-kártya / szűrő-lap domén-jele a Titanium 3D készlet (clay helyett).
test('renders the 3D sprite mark with its label', () => {
  const { container } = render(<PatternDomainMark domain="fuel" />)
  const use = container.querySelector('[data-pattern-domain="fuel"] svg.t-ico use')
  expect(use).toHaveAttribute('href', '#t-plate')
  expect(screen.getByText('Táplálkozás')).toBeInTheDocument()
})

test('showLabel={false} keeps only the mark', () => {
  const { container } = render(<PatternDomainMark domain="sleep" showLabel={false} />)
  expect(container.querySelector('svg.t-ico use')).toHaveAttribute('href', '#t-moon')
  expect(container.textContent).toBe('')
})

test('the list map differs from the detail-page map only in the „egyéb" pattern mark', () => {
  expect(PATTERN_DOMAIN_MARK_ART.other).toBe('t-pattern')
  expect(PATTERN_DOMAIN_ART.other).toBe('t-heart')
  expect({ ...PATTERN_DOMAIN_MARK_ART, other: PATTERN_DOMAIN_ART.other }).toEqual(PATTERN_DOMAIN_ART)
})
