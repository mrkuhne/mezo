import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ExercisesView } from './ExercisesView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Real-mode view: records + catalog come from the MSW fixtures.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(<QueryWrapper><MemoryRouter><ExercisesView /></MemoryRouter></QueryWrapper>)

test('default state ranks top exercises with best set and e1RM chip', async () => {
  renderView()
  expect(await screen.findByText('Top gyakorlatok · rekordjaid')).toBeInTheDocument()
  const row = await screen.findByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('01')).toBeInTheDocument()
  expect(within(row).getByText('102.5×9')).toBeInTheDocument()
  expect(within(row).getByText('e1RM 133.3')).toBeInTheDocument()
  // bodyweight record rows surface the rep counter instead
  const plyoRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(within(plyoRow).getByText('186 rep')).toBeInTheDocument()
})

test('search merges record rows with catalog ghost rows', async () => {
  renderView()
  await screen.findByRole('button', { name: /Chest Supported Row/ })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'r')
  expect(screen.getByText('Találatok · teljes katalógus')).toBeInTheDocument()
  // record match still a button; catalog-only match renders as a ghost row
  expect(screen.getByRole('button', { name: /Chest Supported Row/ })).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
  expect(screen.getAllByText(/MÉG NINCS REKORD/i).length).toBeGreaterThan(0)
})

test('plyo chip filters records and ghosts by type', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(await screen.findByRole('button', { name: /Box Jump/ })).toBeInTheDocument()
  expect(screen.queryByText('Chest Supported Row')).not.toBeInTheDocument()
})

test('tapping a record row opens the record sheet', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(await screen.findByRole('button', { name: /Chest Supported Row/ }))
  expect(await screen.findByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(screen.getByText('102.5 kg × 9')).toBeInTheDocument()
})

test('empty records show the ghost state while the catalog search stays usable', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () => HttpResponse.json([])),
  )
  renderView()
  expect(await screen.findByText(/Az első logolt edzés után itt nőnek a rekordjaid/)).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'calf')
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
})

// Loading skeleton (mezo-f2z) — real mode shows the ExercisesSkeleton (role="status")
// while the catalog/records queries are unresolved (exercisesPending); mock seeds → none.
describe('ExercisesView (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the catalog + records queries are unresolved', async () => {
    // exercisesPending = catalogPending || recordsPending — never-resolve both.
    server.use(
      http.get(`${API_BASE}/api/train/exercises`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/exercise-records`, () => new Promise(() => {})),
    )
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('ExercisesView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
