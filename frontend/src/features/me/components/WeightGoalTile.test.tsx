import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { WeightGoalTile } from './WeightGoalTile'

// Weight goal tile on Célok (mezo-lhqw7). Hooks are stubbed so every honesty state is reachable.
const store = vi.hoisted(() => ({
  goal: { startWeight: 81.4, currentWeight: 78.4, targetWeight: 73 } as object | null,
  goalResponse: { trajectory: 'cut' } as object | null,
  pending: false, isError: false,
  rate: -0.5, weightPending: false, weightError: false,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGoal: () => ({ goal: store.goal, goalResponse: store.goalResponse, pending: store.pending, isError: store.isError }),
    useWeight: () => ({ weightLog: [], weightTrends: { last7d: { avg: 0, weeklyRate: 0 }, last4w: { weeklyRate: store.rate } }, isPending: store.weightPending, isError: store.weightError }),
  }
})

beforeEach(() => Object.assign(store, {
  goal: { startWeight: 81.4, currentWeight: 78.4, targetWeight: 73 }, goalResponse: { trajectory: 'cut' },
  pending: false, isError: false, rate: -0.5, weightPending: false, weightError: false,
}))

const renderTile = (onClick = vi.fn()) => ({
  onClick,
  ...render(<QueryWrapper><MemoryRouter><WeightGoalTile delayMs={130} onClick={onClick} /></MemoryRouter></QueryWrapper>),
})

test('eyebrow, title, percentage, bar and the signed pace line with the ETA', () => {
  renderTile()
  const tile = screen.getByRole('button', { name: 'Súlycél' })
  expect(tile).toHaveTextContent('Súlycél · Egészség')
  expect(tile).toHaveTextContent('Fogyás · 78,4 → 73 kg')
  expect(tile).toHaveTextContent('36%')
  expect(tile.querySelector('.uv-bar')).not.toBeNull()
  expect(tile).toHaveTextContent('−0,5 kg / hét · kb. 11 hét')
})

test('click calls onClick; the tile is one button with no nested control', () => {
  const { onClick } = renderTile()
  const tile = screen.getByRole('button', { name: 'Súlycél' })
  fireEvent.click(tile)
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(tile.querySelector('button')).toBeNull()
})

test('a zero rate omits the whole pace line', () => {
  store.rate = 0
  renderTile()
  expect(screen.getByRole('button', { name: 'Súlycél' })).not.toHaveTextContent('kg / hét')
})

test('a rate that moves AWAY from the target keeps the signed rate but drops the ETA part', () => {
  store.rate = 0.3
  renderTile()
  const tile = screen.getByRole('button', { name: 'Súlycél' })
  expect(tile).toHaveTextContent('+0,3 kg / hét')
  expect(tile).not.toHaveTextContent('kb.')
})

test('no percentage and no bar while the weight log is unresolved or failed — never a fabricated 0%', () => {
  store.weightPending = true
  const { unmount } = renderTile()
  let tile = screen.getByRole('button', { name: 'Súlycél' })
  expect(tile).not.toHaveTextContent('%')
  expect(tile.querySelector('.uv-bar')).toBeNull()
  unmount()
  store.weightPending = false; store.weightError = true
  renderTile()
  tile = screen.getByRole('button', { name: 'Súlycél' })
  expect(tile).not.toHaveTextContent('%')
  expect(tile.querySelector('.uv-bar')).toBeNull()
})

test.each([
  ['pending', { pending: true }],
  ['error', { isError: true }],
  ['no goal', { goal: null, goalResponse: null }],
])('renders nothing while the goal is %s', (_n, patch) => {
  Object.assign(store, patch)
  const { container } = renderTile()
  expect(container).toBeEmptyDOMElement()
})
