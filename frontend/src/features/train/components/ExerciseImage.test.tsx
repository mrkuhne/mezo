import { render, screen, act } from '@testing-library/react'
import { ExerciseImage } from '@/features/train/components/ExerciseImage'

const A = '/exercises/barbell-squat-a.jpg'
const B = '/exercises/barbell-squat-b.jpg'

/** jsdom has no matchMedia — install one whose `matches` we control. */
function mockReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => mockReducedMotion(false))

test('hero renders nothing without a start frame — no empty placeholder box', () => {
  const { container } = render(<ExerciseImage start={null} end={null} name="Kettlebell Swing" muscle="glute" />)
  expect(container).toBeEmptyDOMElement()
})

test('hero alternates the two frames on a timer — the pair is what conveys the movement', () => {
  vi.useFakeTimers()
  try {
    const { container } = render(<ExerciseImage start={A} end={B} name="Barbell Squat" muscle="quad" />)
    const [startImg, endImg] = Array.from(container.querySelectorAll('img'))
    expect(startImg).toHaveStyle({ opacity: '1' })
    expect(endImg).toHaveStyle({ opacity: '0' })

    act(() => void vi.advanceTimersByTime(1200))
    expect(startImg).toHaveStyle({ opacity: '0' })
    expect(endImg).toHaveStyle({ opacity: '1' })

    act(() => void vi.advanceTimersByTime(1200))
    expect(startImg).toHaveStyle({ opacity: '1' })
  } finally {
    vi.useRealTimers()
  }
})

test('a lone start frame renders as a plain still — nothing to alternate, no toggle', () => {
  const { container } = render(<ExerciseImage start={A} end={null} name="Barbell Squat" muscle="quad" />)
  expect(container.querySelectorAll('img')).toHaveLength(1)
  expect(screen.getByAltText('Barbell Squat')).toHaveStyle({ opacity: '1' })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('reduced motion drops the auto-crossfade but keeps the frames reachable by tap', () => {
  mockReducedMotion(true)
  vi.useFakeTimers()
  try {
    const { container } = render(<ExerciseImage start={A} end={B} name="Barbell Squat" muscle="quad" />)
    const [startImg] = Array.from(container.querySelectorAll('img'))

    act(() => void vi.advanceTimersByTime(5000))
    expect(startImg).toHaveStyle({ opacity: '1' }) // never auto-advanced

    // Which frame you are looking at is information, so it becomes a manual control
    // instead of being dropped entirely.
    act(() => screen.getByRole('button', { name: 'Végpozíció' }).click())
    expect(startImg).toHaveStyle({ opacity: '0' })
    expect(screen.getByRole('button', { name: 'Kiinduló helyzet' })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('thumb without an image falls back to a muscle tile so list rows keep a straight edge', () => {
  const { container } = render(
    <ExerciseImage start={null} name="Kettlebell Swing" muscle="glute" variant="thumb" />,
  )
  const tile = container.querySelector('.exdemo-thumb')!
  expect(tile.tagName).toBe('DIV')
  expect(tile).toHaveTextContent('K')
})

test('thumb with an image uses the start frame only, lazily', () => {
  const { container } = render(<ExerciseImage start={A} end={B} name="Barbell Squat" muscle="quad" variant="thumb" />)
  const img = container.querySelector('img.exdemo-thumb')!
  expect(img).toHaveAttribute('src', A)
  expect(img).toHaveAttribute('loading', 'lazy')
})

test('thumb image is decorative (next to a visible label) — empty alt, not exposed by name', () => {
  const { container } = render(<ExerciseImage start={A} end={null} name="Barbell Squat" muscle="quad" variant="thumb" />)
  const img = container.querySelector('img.exdemo-thumb')!
  expect(img).toHaveAttribute('alt', '')
  expect(screen.queryByAltText('Barbell Squat')).not.toBeInTheDocument()
})

test('hero image is not decorative — retains the alt text', () => {
  render(<ExerciseImage start={A} end={null} name="Barbell Squat" muscle="quad" />)
  expect(screen.getByAltText('Barbell Squat')).toBeInTheDocument()
})
