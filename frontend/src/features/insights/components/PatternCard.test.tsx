import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatternCard } from '@/features/insights/components/PatternCard'
import { patterns } from '@/data/insights/insights'

const p1 = patterns[0] // has `thinking` + critique

test('renders category, confidence, title, mechanism and the 4-factor critique', () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.getByText('Fiziológia')).toBeInTheDocument()
  expect(screen.getByText('conf 85%')).toBeInTheDocument()
  expect(screen.getByText(p1.title)).toBeInTheDocument()
  for (const lbl of ['Statistical', 'Confounders', 'L3 align', 'Actionability']) {
    expect(screen.getByText(lbl)).toBeInTheDocument()
  }
})

test('a statistical row renders "tanulom" and evidence chips instead of critique bars', () => {
  render(
    <PatternCard
      pattern={{
        id: 's1',
        category: 'physiology',
        categoryLabel: 'Fiziológia',
        title: 'Alvásminőség ↔ másnapi edzés-RPE',
        mechanism: 'Erős negatív együttjárás.',
        evidence: ['r=-0.82', 'n=14 nap'],
        kind: 'statistical',
        status: 'proposed',
      }}
    />,
  )
  expect(screen.getByText('tanulom')).toBeInTheDocument()
  expect(screen.getByText('r=-0.82')).toBeInTheDocument()
  expect(screen.queryByText('Statistical')).not.toBeInTheDocument()
})

test('expands the AI reasoning on demand', async () => {
  render(<PatternCard pattern={p1} />)
  expect(screen.queryByText(p1.thinking!)).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('AI gondolatmenete'))
  expect(screen.getByText(p1.thinking!)).toBeInTheDocument()
})

test('the decision buttons call onDecide and the persisted status renders the badge', async () => {
  const onDecide = vi.fn()
  const { rerender } = render(<PatternCard pattern={p1} onDecide={onDecide} />)

  await userEvent.click(screen.getByRole('button', { name: /Confirm/ }))
  expect(onDecide).toHaveBeenCalledWith('confirm')

  // the badge is driven by the PERSISTED status (cache/refetch), not local state
  rerender(<PatternCard pattern={{ ...p1, status: 'confirmed' }} onDecide={onDecide} />)
  expect(screen.getByText('✓ Megerősítve')).toBeInTheDocument()
})
