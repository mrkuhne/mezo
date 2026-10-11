import { render, screen } from '@testing-library/react'
import { ExerciseImage } from '@/features/train/components/ExerciseImage'

const A = '/exercises/barbell-squat-a.jpg'

test('thumb without an image falls back to the muscle chip so list rows keep a straight edge', () => {
  const { container } = render(
    <ExerciseImage start={null} name="Kettlebell Swing" muscle="glute" />,
  )
  // Folyadék (mezo-n4wf5.3): the fallback is the muscle chip itself, not a lettered tile
  expect(container.querySelector('.ee-thumb.ex-mchp')).not.toBeNull()
  expect(container.querySelector('img')).toBeNull()
})

test('thumb without an image and without a muscle the body map knows falls back to the initial', () => {
  const { container } = render(<ExerciseImage start={null} name="Kettlebell Swing" muscle="ismeretlen" />)
  const tile = container.querySelector('.ee-thumb')!
  expect(tile.tagName).toBe('SPAN')
  expect(tile).toHaveTextContent('K')
})

test('with an image it draws the start frame only, lazily — one <img>, nothing alternates', () => {
  const { container } = render(<ExerciseImage start={A} name="Barbell Squat" muscle="quad" />)
  const img = container.querySelector('img.ee-thumb')!
  expect(img).toHaveAttribute('src', A)
  expect(img).toHaveAttribute('loading', 'lazy')
  expect(container.querySelectorAll('img')).toHaveLength(1)
  expect(container.querySelector('figure, button')).toBeNull()
})

test('thumb image is decorative (next to a visible label) — empty alt, not exposed by name', () => {
  const { container } = render(<ExerciseImage start={A} name="Barbell Squat" muscle="quad" />)
  const img = container.querySelector('img.ee-thumb')!
  expect(img).toHaveAttribute('alt', '')
  expect(screen.queryByAltText('Barbell Squat')).not.toBeInTheDocument()
})
