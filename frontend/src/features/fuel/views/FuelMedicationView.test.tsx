import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FuelMedicationView } from './FuelMedicationView'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelMedicationView reads useMedication (a dual-mode TanStack query, Task 11).
// Render under a router + QueryClientProvider; the assertions below are mode-agnostic
// (the seed and the real-mode handler fixture both resolve Retatrutide · retaDay 3 · 3 doses),
// so the same suite runs green in BOTH modes (mock pin in the outer beforeEach is overridden
// in the real-mode describe).
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/gyogyszer']}>
        <FuelMedicationView />
      </MemoryRouter>
    </QueryWrapper>,
  )

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('FuelMedicationView (mock mode)', () => {
  it('renders the medication name + route/cadence/dose card', () => {
    renderView()
    expect(screen.getByText('Retatrutide')).toBeInTheDocument()
    // route + cadence subtitle on the card (mockup: "subQ injekció · heti · hétfő")
    expect(screen.getByText(/subQ injekció · heti · hétfő/)).toBeInTheDocument()
    // the current dose (defaultDose + unit) appears on the card AND the log rows — at least one
    expect(screen.getAllByText('6 mg').length).toBeGreaterThan(0)
  })

  it('shows the cycle bar with the current day (retaDay 3) outlined in the Stabil phase', () => {
    renderView()
    const bar = screen.getByRole('list', { name: /ciklus/i })
    // 7 cells, one per cycle day
    const cells = within(bar).getAllByRole('listitem')
    expect(cells).toHaveLength(7)
    // the current cell is day 3 (aria-current) and labelled as the stable phase
    const current = cells.find(c => c.getAttribute('aria-current') === 'true')!
    expect(current).toBeTruthy()
    expect(within(current).getByText('3')).toBeInTheDocument()
  })

  it('shows the phase note naming the day + Stabil phase', () => {
    renderView()
    const note = screen.getByTestId('medication-phase-note')
    expect(note.textContent).toMatch(/3\.\s*nap/)
    expect(note.textContent).toMatch(/Stabil/)
  })

  it('lists the 3 seeded doses in the Beadások log, newest first', () => {
    renderView()
    const log = screen.getByRole('list', { name: /beadások/i })
    const rows = within(log).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    // newest dose (2026-06-22) is the first row
    expect(rows[0].textContent).toMatch(/Jún 22/)
    // oldest dose (2026-06-08) is the last row
    expect(rows[2].textContent).toMatch(/Jún 8/)
  })

  it('has a "＋ Beadás" button that opens the LogDoseSheet on click', () => {
    renderView()
    const btn = screen.getByRole('button', { name: /Beadás/ })
    expect(btn).toBeInTheDocument()
    // the sheet is closed until tapped
    expect(screen.queryByLabelText(/dózis/i)).not.toBeInTheDocument()
    fireEvent.click(btn)
    // tapping flips logOpen → the LogDoseSheet mounts (its dose field is now present)
    expect(screen.getByLabelText(/dózis/i)).toBeInTheDocument()
  })
})

describe('FuelMedicationView (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the medication + cycle + 3 doses from the API handler fixture', async () => {
    renderView()
    expect(await screen.findByText('Retatrutide')).toBeInTheDocument()
    const note = await screen.findByTestId('medication-phase-note')
    expect(note.textContent).toMatch(/Stabil/)
    const log = screen.getByRole('list', { name: /beadások/i })
    expect(within(log).getAllByRole('listitem')).toHaveLength(3)
  })
})
