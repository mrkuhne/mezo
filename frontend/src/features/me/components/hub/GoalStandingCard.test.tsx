import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoalStandingCard } from './GoalStandingCard'
import { renderUnit } from './hubTestKit'

// Célok állása (mezo-lhqw7): the weight goal's row first, then one row per active life goal.
type Arrow = 'up' | 'flat' | 'down' | 'insufficient'
const store = vi.hoisted(() => ({
  goal: { startWeight: 81.4, currentWeight: 78.4, targetWeight: 73 } as object | null,
  goalPending: false, goalError: false,
  lifeGoals: [] as object[], lifePending: false,
  today: [] as object[], todayPending: false, todayError: false,
}))

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useGoal: () => ({ goal: store.goal, pending: store.goalPending, isError: store.goalError }),
    useLifeGoals: () => ({ goals: store.lifeGoals, isPending: store.lifePending, isError: false }),
    useLifeGoalToday: () => ({ today: { goals: store.today }, isPending: store.todayPending, isError: store.todayError }),
  }
})

const lg = (id: string, title: string, dimension: string, status = 'active') => ({ id, title, dimension, status })
const sum = (goalId: string, arrow: Arrow, hit = 2, total = 3) => ({ goalId, arrow, pillarsHitToday: hit, pillarsTotal: total })

beforeEach(() => {
  Object.assign(store, {
    goal: { startWeight: 81.4, currentWeight: 78.4, targetWeight: 73 }, goalPending: false, goalError: false,
    lifeGoals: [lg('a', 'Side hustle', 'accomplishment'), lg('b', 'Kockahas', 'health'), lg('c', 'Régi terv', 'meaning', 'parked')],
    lifePending: false,
    today: [sum('a', 'up'), sum('b', 'insufficient')], todayPending: false, todayError: false,
  })
})

const rows = () => [...document.querySelectorAll('.enh-grow')]

test('one coral glass button to Célok: the weight goal first with its percentage, then the active life goals', async () => {
  renderUnit(<GoalStandingCard />)
  const card = screen.getByRole('button', { name: 'Célok állása' })
  expect(card).toHaveClass('enh-goalcard', 'glass')
  expect(card.querySelectorAll('.glass')).toHaveLength(0)
  expect(card.querySelector('button')).toBeNull()
  expect(card.querySelector('.enh-stch')).toHaveTextContent('3 aktív')
  expect(rows()).toHaveLength(3) // the parked goal has no row
  expect(rows()[0]).toHaveTextContent('Súlycél · 78,4 → 73 kg')
  expect(rows()[0]).toHaveTextContent('36%') // (81.4 − 78.4) / (81.4 − 73)
  expect(rows()[0].querySelector('use')?.getAttribute('href')).toBe('#t-weight')
  expect(rows()[0].querySelector<HTMLElement>('.uv-bar')!.style.getPropertyValue('--w')).toBe('36%')
  expect(rows()[1]).toHaveTextContent('Side hustle')
  expect(rows()[1]).toHaveTextContent('↗')
  expect(rows()[1]).toHaveTextContent('emelkedik')
  await userEvent.click(card)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/goals')
})

test('direction words: tartja and figyelmet kér — and a slipping goal is never red', () => {
  store.today = [sum('a', 'flat'), sum('b', 'down')]
  renderUnit(<GoalStandingCard />)
  expect(rows()[1]).toHaveTextContent('tartja')
  expect(rows()[2]).toHaveTextContent('figyelmet kér')
  expect(document.querySelector('.is-down, .is-red, .danger')).toBeNull()
})

test('`insufficient` is never a direction', () => {
  renderUnit(<GoalStandingCard />)
  const row = rows()[2]
  expect(row).toHaveTextContent('Kockahas')
  expect(row).not.toHaveTextContent(/emelkedik|tartja|figyelmet kér/)
  expect(row.querySelector('.enh-garr')).toBeNull()
})

test('an unresolved or failed today-read leaves the titles and drops every direction', () => {
  store.todayPending = true
  const { unmount } = renderUnit(<GoalStandingCard />)
  expect(rows()[1]).toHaveTextContent('Side hustle')
  expect(document.querySelector('.enh-garr')).toBeNull()
  expect(document.body).not.toHaveTextContent(/emelkedik|ma$/)
  unmount()
  store.todayPending = false
  store.todayError = true
  renderUnit(<GoalStandingCard />)
  expect(document.querySelector('.enh-garr')).toBeNull()
})

test('the weight row is absent while its goal is pending, failed or missing', () => {
  store.goalError = true
  const { unmount } = renderUnit(<GoalStandingCard />)
  expect(rows()).toHaveLength(2)
  expect(document.body).not.toHaveTextContent('Súlycél')
  expect(document.querySelector('.enh-stch')).toHaveTextContent('2 aktív')
  unmount()
  store.goalError = false
  store.goal = null
  renderUnit(<GoalStandingCard />)
  expect(rows()).toHaveLength(2)
})

test('a goal with no computable progress (start = target) shows no percentage and no bar', () => {
  store.goal = { startWeight: 78, currentWeight: 78.2, targetWeight: 78 }
  renderUnit(<GoalStandingCard />)
  expect(rows()[0]).toHaveTextContent('Súlycél')
  expect(rows()[0]).not.toHaveTextContent('%')
  expect(rows()[0].querySelector('.uv-bar')).toBeNull()
})

test('while the life goals load the card is absent — no flash of the empty door', () => {
  store.lifePending = true
  renderUnit(<GoalStandingCard />)
  expect(screen.queryByRole('button')).toBeNull()
})

test('no row at all → the dashed „＋ Első cél" door to the wizard', async () => {
  store.goal = null
  store.lifeGoals = [lg('c', 'Régi terv', 'meaning', 'parked')]
  renderUnit(<GoalStandingCard />)
  expect(screen.queryByRole('button', { name: 'Célok állása' })).toBeNull()
  const door = screen.getByRole('button', { name: /＋ Első cél/ })
  expect(door).toHaveClass('enh-newgoal', 'uv-empty')
  expect(door).not.toHaveClass('glass')
  await userEvent.click(door)
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/goals/new')
})

test('no life goal and the weight goal still loading → nothing yet, not the empty door', () => {
  store.goal = null
  store.goalPending = true
  store.lifeGoals = []
  renderUnit(<GoalStandingCard />)
  expect(screen.queryByRole('button')).toBeNull()
})
