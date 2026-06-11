import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock workout data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <ActiveWorkoutScreen />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('prep screen shows the workout title, challenges carousel and the start CTA', () => {
  setup()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText('Mai kihívások · proposál')).toBeInTheDocument()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
})

test('prep screen flags the active niggle pre-flight', () => {
  setup()
  expect(screen.getByText('Jobb váll · aktív niggle')).toBeInTheDocument()
  expect(screen.getByText('Értem · jó így')).toBeInTheDocument()
})

test('clicking the start CTA reveals the first active exercise', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('Set kész')).toBeInTheDocument()
})

test('completing a set advances the set counter', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText(/Set 1\//)).toBeInTheDocument()
  await user.click(screen.getByText('Set kész'))
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument()
})

test('logging a PR-weight third set on the first exercise fires the PR toast', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // 4 sets on ex0; bump weight to 105 then complete sets 1, 2, 3.
  const plus = screen.getByLabelText('kg növelése')
  await user.click(plus) // 102.5 -> 105
  await user.click(screen.getByText('Set kész')) // set 1
  await user.click(screen.getByText('Set kész')) // set 2
  await user.click(screen.getByText('Set kész')) // set 3 -> PR
  expect(screen.getByText('Personal Record')).toBeInTheDocument()
  expect(screen.getByText('+2.5 kg')).toBeInTheDocument()
})
