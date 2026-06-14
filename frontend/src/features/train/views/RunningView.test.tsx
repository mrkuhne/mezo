import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RunningView } from './RunningView'
import { QueryWrapper } from '@/test/queryWrapper'

// Real-mode tests mock the api module (mirrors trainHooks.test's mocking style):
// blocks/runSessions both resolve to [] so the view exercises its ghost states.
vi.mock('@/lib/runningApi', () => ({
  runningApi: {
    blocks: vi.fn().mockResolvedValue([]),
    runSessions: vi.fn().mockResolvedValue([]),
  },
}))

// RunningView now calls useNavigate (opens the /train/futas/:id builder), so a
// Router context is required around it.
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <RunningView />
      </MemoryRouter>
    </QueryWrapper>,
  )

// ---- MOCK mode: static Phase-1 running data served synchronously ----
describe('RunningView (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('default (E heti edzés) renders the active block hero + this week sessions', () => {
    renderView()
    // active block rb-active-01: currentWeek 3 / 8 weeks
    expect(screen.getByText(/Hét 3 \/ 8/)).toBeInTheDocument()
    // week 3 prescribes both sessions
    expect(screen.getByText('Sprint-intervallum')).toBeInTheDocument()
    expect(screen.getByText('Piramis-intervallum')).toBeInTheDocument()
  })

  test('Napló switcher shows the logged run sessions', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
    // rs-01: rpeActual 9 -> "RPE 9" chip; sessionKey tue-sprint -> "Sprint" label
    expect(screen.getByText('RPE 9')).toBeInTheDocument()
    expect(screen.getByText('Sprint')).toBeInTheDocument()
  })

  test('Tervek switcher renders the full block library (all three titles)', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Tervek' }))
    expect(screen.getByText('Robbanékonyság 01')).toBeInTheDocument()
    expect(screen.getByText('5K-alapozó')).toBeInTheDocument()
    expect(screen.getByText('Téli base 02')).toBeInTheDocument()
  })
})

// ---- REAL mode, empty backend: ghost states, no crash ----
describe('RunningView (real mode, empty)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('week segment shows the GhostState when no active block exists', async () => {
    renderView()
    expect(
      await screen.findByText(/Nincs aktív futóterved/),
    ).toBeInTheDocument()
  })
})
