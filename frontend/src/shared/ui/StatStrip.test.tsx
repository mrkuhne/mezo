import { render, screen } from '@testing-library/react'
import { StatStrip } from '@/shared/ui/StatStrip'

test('renders one cell per entry with value, unit and label', () => {
  const { container } = render(
    <StatStrip
      cells={[
        { label: 'Alvás', value: '7.2', unit: 'h' },
        { label: 'Súly', value: '78.6', unit: 'kg' },
        { label: 'HRV', value: '64', unit: 'ms' },
      ]}
    />,
  )
  expect(container.querySelectorAll('.statstrip-c')).toHaveLength(3)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('7.2')).toBeInTheDocument()
  expect(screen.getByText('kg')).toBeInTheDocument()
})

test('a unitless cell renders no unit span', () => {
  const { container } = render(<StatStrip cells={[{ label: 'ETA', value: '8 hét' }]} />)
  expect(container.querySelectorAll('.statstrip-u')).toHaveLength(0)
})

test('ghosts on an empty cell list', () => {
  const { container } = render(<StatStrip cells={[]} />)
  expect(container.firstChild).toBeNull()
})
