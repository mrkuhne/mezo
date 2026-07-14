import { act, fireEvent, render, screen } from '@testing-library/react'
import { DynamicIsland } from '@/app/DynamicIsland'
import { LiveActivityProvider, useLiveActivity } from '@/app/providers/LiveActivityProvider'

function Starter({ seconds, next }: { seconds: number; next: string | null }) {
  const { startRest } = useLiveActivity()
  return <button type="button" onClick={() => startRest({ seconds, next })}>go</button>
}

const setup = (seconds = 150, next: string | null = 'Lat Pulldown') => {
  vi.useFakeTimers()
  const utils = render(
    <LiveActivityProvider>
      <DynamicIsland />
      <Starter seconds={seconds} next={next} />
    </LiveActivityProvider>,
  )
  fireEvent.click(screen.getByText('go'))
  return utils
}

afterEach(() => vi.useRealTimers())

test('renders the static island without a rest, expands with ring + countdown + next when one starts', () => {
  vi.useFakeTimers()
  const { container } = render(<LiveActivityProvider><DynamicIsland /></LiveActivityProvider>)
  expect(container.querySelector('.dynamic-island')).not.toBeNull()
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('counts down and self-collapses at zero', () => {
  const { container } = setup(150, 'Lat Pulldown')
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  expect(screen.getByText('2:30')).toBeInTheDocument()
  expect(screen.getByText('Lat Pulldown')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByText('1:30')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(91_000))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('tap skips the rest', () => {
  const { container } = setup(90, null)
  fireEvent.click(screen.getByRole('button', { name: 'Pihenő átugrása' }))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
  expect(screen.queryByText('Következő')).not.toBeInTheDocument()
})
