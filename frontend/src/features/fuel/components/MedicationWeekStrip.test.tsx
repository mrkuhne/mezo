import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MedicationWeekStrip } from '@/features/fuel/components/MedicationWeekStrip'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { medicationFixture } from '@/test/fixtures/medication'

// The strip reads useFuelWeek().medCycleWeek — a composed dual-mode hook since Fuel P4 (needs a
// QueryClient). The app itself seeds no medication in EITHER mode (mezo-lwmq), so the default
// medCycleWeek is empty; these tests drive the POPULATED branch by running in real mode and
// overriding the /api/medication handler with the neutral medicationFixture (real mode derives
// medCycleWeek from the medication cycle via toMedCycleCells), so the composed hook chain is
// genuinely exercised, not stubbed away.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
})
afterEach(() => vi.unstubAllEnvs())

const renderStrip = (currentDay: number) =>
  render(
    <QueryWrapper>
      <MedicationWeekStrip currentDay={currentDay} />
    </QueryWrapper>,
  )

test('renders 7 day cells with phase labels', async () => {
  renderStrip(3)
  expect(await screen.findByText('D1')).toBeInTheDocument()
  expect(screen.getByText('D7')).toBeInTheDocument()
  expect(screen.getAllByText('Stable').length).toBeGreaterThan(0)
})
test('marks the current day active', async () => {
  const { container } = renderStrip(3)
  await screen.findByText('D1')
  expect(container.querySelector('[data-active="true"]')).toHaveTextContent('D3')
})
