import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'

// The two faces mock mode cannot reach (its fixture answers every id at once): the workout still
// loading, and a workout that does not exist. Only the detail read is replaced.
const detailState = vi.hoisted(() => ({ value: { detail: null as unknown, pending: false, error: null as unknown } }))
vi.mock('@/data/hooks', async (original) => ({
  ...(await original<typeof import('@/data/hooks')>()),
  useWorkoutDetail: () => detailState.value,
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function FrameProbe() {
  const { title, eyebrow } = useFrame()
  return <div data-testid="frame-title" data-eyebrow={eyebrow}>{title}</div>
}

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/review/nincs-ilyen']}>
        <FrameProvider>
          <FrameProbe />
          <Routes>
            <Route path="/train/review/:workoutId" element={<WorkoutReviewPage />} />
            <Route path="/train" element={<p>edzések</p>} />
          </Routes>
        </FrameProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('while the workout loads the page is a skeleton under its own title', () => {
  detailState.value = { detail: null, pending: true, error: null }
  setup()
  expect(screen.getByRole('status', { name: 'Összegzés betöltése…' })).toBeInTheDocument()
  expect(screen.getByTestId('frame-title')).toHaveTextContent('Összegzés')
  expect(document.querySelector('.eo-hero')).toBeNull()
})

test('a workout that does not exist is an empty vessel with the way back to the workouts', async () => {
  detailState.value = { detail: null, pending: false, error: null }
  setup()
  expect(screen.getByText('Ez az edzés nem található.')).toBeInTheDocument()
  expect(screen.getByTestId('frame-title')).toHaveAttribute('data-eyebrow', 'Edzés')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza az edzésekhez' }))
  expect(screen.getByText('edzések')).toBeInTheDocument()
})

test('a failed read says the same — never a half-drawn report', () => {
  detailState.value = { detail: null, pending: false, error: new Error('500') }
  setup()
  expect(screen.getByText('Ez az edzés nem található.')).toBeInTheDocument()
})
