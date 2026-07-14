import { render, screen } from '@testing-library/react'
import { LoadTiles } from '@/features/train/components/LoadTiles'

const TILES = [
  { kind: 'gym' as const, label: 'Gym', icon: '🏋️', value: '5× · 75p' },
  { kind: 'sport' as const, label: 'Röplabda', icon: '🏐', value: '4× · 6,5h' },
]

test('renders one tile per modality with label and value', () => {
  const { container } = render(<LoadTiles tiles={TILES} />)
  expect(container.querySelectorAll('.loadtile')).toHaveLength(2)
  expect(screen.getByText('5× · 75p')).toBeInTheDocument()
  expect(screen.getByText('Röplabda')).toBeInTheDocument()
  expect(container.querySelector('.lic-gym')).not.toBeNull()
})

test('renders nothing when the week is empty', () => {
  const { container } = render(<LoadTiles tiles={[]} />)
  expect(container.firstChild).toBeNull()
})
