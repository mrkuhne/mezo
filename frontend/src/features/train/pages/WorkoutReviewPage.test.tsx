import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/review/wd-mock-1']}>
        <Routes>
          <Route path="/train/review/:workoutId" element={<WorkoutReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the closed summary from the workout detail (mock fixture)', () => {
  setup()
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
  // per-set lines render in review mode, with RIR (user fix 1 shows here too)
  expect(screen.getByText(/85.*×.*8.*@RIR 1/)).toBeInTheDocument()
  // the abandoned exercise is struck "kihagyva"
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  // no finish CTA in review
  expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
})
