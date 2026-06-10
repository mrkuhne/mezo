import { render, screen } from '@testing-library/react'
import { ConfidenceBar } from './ConfidenceBar'
import { FactorCard } from './FactorCard'
import { InsightCard } from './InsightCard'

test('ConfidenceBar shows the rounded percentage', () => {
  render(<ConfidenceBar confidence={0.84} />)
  expect(screen.getByText('84%')).toBeInTheDocument()
  expect(screen.getByText('confidence')).toBeInTheDocument()
})

test('FactorCard renders title, evidence, impact and confidence', () => {
  render(
    <FactorCard factor={{ kind: 'positive', title: 'Magnézium 21:00 stack megtartva', impact: '+0.6 quality', evidence: '8/10 nap megerősítve · P2 pattern', confidence: 0.84 }} />,
  )
  expect(screen.getByText('Magnézium 21:00 stack megtartva')).toBeInTheDocument()
  expect(screen.getByText(/8\/10 nap megerősítve/)).toBeInTheDocument()
  expect(screen.getByText('+0.6 quality')).toBeInTheDocument()
  expect(screen.getByText('84%')).toBeInTheDocument()
})

test('InsightCard renders bold spans via SafeMarkdown (no innerHTML)', () => {
  const { container } = render(
    <InsightCard insight={{ type: 'milestone', text: 'Heti átlag **7.46h, quality 7.7** — tartja.' }} />,
  )
  expect(container.querySelector('strong')).toHaveTextContent('7.46h, quality 7.7')
})
