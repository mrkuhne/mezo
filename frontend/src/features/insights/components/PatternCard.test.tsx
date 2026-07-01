import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatternCard } from '@/features/insights/components/PatternCard'
import { patterns } from '@/data/insights'

const p1 = patterns[0] // has `thinking`

test('renders category, confidence, title, mechanism and the 4-factor critique', () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.getByText('Fiziológia')).toBeInTheDocument()
  expect(screen.getByText('conf 85%')).toBeInTheDocument()
  expect(screen.getByText(p1.title)).toBeInTheDocument()
  for (const lbl of ['Statistical', 'Confounders', 'L3 align', 'Actionability']) {
    expect(screen.getByText(lbl)).toBeInTheDocument()
  }
})

test('expands the AI reasoning on demand', async () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.queryByText(p1.thinking!)).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('AI gondolatmenete'))
  expect(screen.getByText(p1.thinking!)).toBeInTheDocument()
})

test('Confirm marks the card status', async () => {
  render(<PatternCard pattern={p1} />)
  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }))
  expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
})
