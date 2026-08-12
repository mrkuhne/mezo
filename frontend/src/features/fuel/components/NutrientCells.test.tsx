import { render, screen } from '@testing-library/react'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'

test('renders the four nutrients in order with their labels', () => {
  render(<NutrientCells nutrients={{ fiberG: 6, sugarG: 12.5, saltG: 0.4, saturatedFatG: 2.1 }} />)
  expect(screen.getByText('Telített')).toBeInTheDocument()
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
  expect(screen.getByText('2,1')).toBeInTheDocument()
  expect(screen.getByText('0,4')).toBeInTheDocument()
})

test('dashes a single missing fact', () => {
  render(<NutrientCells nutrients={{ fiberG: null, sugarG: 12, saltG: 0.4, saturatedFatG: 2.1 }} />)
  expect(screen.getByText('—')).toBeInTheDocument()
})

test('renders nothing when every fact is missing and empty is hide (the default)', () => {
  const { container } = render(<NutrientCells nutrients={{ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders four dashes when every fact is missing and empty is dashes', () => {
  render(<NutrientCells nutrients={{ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }} empty="dashes" />)
  expect(screen.getAllByText('—')).toHaveLength(4)
})

test('renders cells in the fixed order: Telített · Cukor · Rost · Só', () => {
  const { container } = render(
    <NutrientCells nutrients={{ fiberG: 6, sugarG: 12, saltG: 0.5, saturatedFatG: 2 }} />
  )
  const labels = Array.from(container.querySelectorAll('.label-mono')).map(el => el.textContent)
  expect(labels).toEqual(['Telített', 'Cukor', 'Rost', 'Só'])
})

test('formats sub-0.1 values through the component', () => {
  render(<NutrientCells nutrients={{ fiberG: 0.2, sugarG: 0.3, saltG: 0.04, saturatedFatG: 0.1 }} />)
  expect(screen.getByText('<0,1')).toBeInTheDocument()
})
