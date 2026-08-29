import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MesoOverviewPage } from '@/features/train/pages/MesoOverviewPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { MUSCLE_LABELS } from '@/data/train/train'

// Asserts Phase-1 mock meso data (meso-hyp-04, W3/6), so pin mock mode
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
  it('shows the Mozaik subpage hero — icon + current week + name', () => {
    renderAt('meso-hyp-04')
    expect(screen.getByText('W3')).toBeInTheDocument()
    expect(screen.getByText('Volumen · élő rendszer')).toBeInTheDocument()
  })

  // The provenance anatomy (live banner, intro, per-muscle bars, AI card) is
  // `MesoVolume`'s own contract (see MesoVolume.test.tsx) — reused unchanged
  // here, so this page only pins that it actually renders through the new
  // Mozaik scaffold rather than re-asserting every detail.
  it('renders the reused MesoVolume provenance anatomy', () => {
    renderAt('meso-hyp-04')
    expect(screen.getByText('Honnan jönnek a számok?')).toBeInTheDocument()
    expect(screen.getByText(MUSCLE_LABELS.chest)).toBeInTheDocument()
    expect(screen.getByText('Mezo · javaslat')).toBeInTheDocument()
  })

  it('expanding a muscle bar reveals the 01→02→03 derivation', async () => {
    const user = userEvent.setup()
    renderAt('meso-hyp-04')
    await user.click(screen.getByRole('button', { name: new RegExp(`^${MUSCLE_LABELS.chest} volumen-profil`) }))
    expect(screen.getByText('01 · Baseline')).toBeInTheDocument()
    expect(screen.getByText('03 · Eredő · most')).toBeInTheDocument()
  })

  it('shows a not-found guard for an unknown mesocycle id', () => {
    renderAt('nope')
    expect(screen.getByText('Ez a mesociklus nem található.')).toBeInTheDocument()
  })
})
