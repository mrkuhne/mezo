import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MesoOverviewPage } from '@/features/train/pages/MesoOverviewPage'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso + arc data (meso-hyp-04, W3/6), so pin mock mode
// explicitly — mirrors GymPage.test.tsx's idiom. Needs the real useParams, so
// (unlike GymPage.test.tsx) react-router-dom is NOT mocked here.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (id: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[`/train/mesocycles/${id}/overview`]}>
        <Routes>
          <Route path="train/mesocycles/:id/overview" element={<MesoOverviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('MesoOverviewPage (mock mode)', () => {
  it('shows the progress header — status eyebrow + title', () => {
    renderAt('meso-hyp-04')
    expect(screen.getByText('Aktív · Week 3/6')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hypertrophy 04 · Tavasz' })).toBeInTheDocument()
  })

  it('renders the volume arc chart for the default (first) muscle', () => {
    renderAt('meso-hyp-04')
    expect(screen.getByTestId('volume-arc-chart')).toBeInTheDocument()
  })

  it('the per-muscle switch changes the rendered muscle', () => {
    renderAt('meso-hyp-04')
    const backBtn = screen.getByRole('button', { name: 'Hát' })
    expect(backBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(backBtn)
    expect(backBtn).toHaveAttribute('aria-pressed', 'true')
    // MRV caption re-renders for the newly-active muscle (back mrv=22, chest mrv=20).
    expect(screen.getByText('MRV 22')).toBeInTheDocument()
  })

  it('shows a not-found guard for an unknown mesocycle id', () => {
    renderAt('nope')
    expect(screen.getByText('Ez a mesociklus nem található.')).toBeInTheDocument()
  })
})
