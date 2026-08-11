import { render, screen, within } from '@testing-library/react'
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
  expect(screen.getByText('Lezárva ·', { exact: false })).toBeInTheDocument()
  // per-set chips render in review mode, with RIR (new pill format: "{n} × {m} @{rir}")
  expect(screen.getByText(/85.*×.*8/)).toBeInTheDocument()
  expect(screen.getByText('@1')).toBeInTheDocument()
  // the abandoned exercise is struck "kihagyva"
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  // no finish CTA in review
  expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
})

// Finding 2 (mezo-w943 final review): the mock medal fixture now carries one entry
// scoped to `workoutDetailMock.id` ('wd-mock-1') — the review page's medal filter
// (`m.workoutSessionId === detail.id`) must actually match something in mock mode.
test('renders the Medálok section with the seeded medal in mock mode', () => {
  setup()
  const section = screen.getByText('Medálok').closest('.wsum-sec') as HTMLElement
  expect(within(section).getByText('Súly-rekord')).toBeInTheDocument()
  expect(within(section).getByText('Chest Supported Row')).toBeInTheDocument()
  // setIndex 2 lands on the logged "85 × 8" set — its chip carries the record marker.
  const chip = screen.getByText(/85\s*×\s*8/).closest('.wsum-chip') as HTMLElement
  expect(chip.className).toContain('rec')
})
