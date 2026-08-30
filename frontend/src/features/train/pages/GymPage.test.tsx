import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { GymPage } from '@/features/train/pages/GymPage'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import { QueryWrapper } from '@/test/queryWrapper'

// Content-parity check only — TrainWeekPage.test.tsx (both modes) owns the
// real behavioral coverage. Pin mock mode so the hero text is synchronous.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// GymPage retired into a thin TrainWeekPage alias (mezo-d20.3.2) — its whole
// surface (meta card, schedule sheet, muscle-zone grid, day list) folded into
// Heti. Renders the same component directly (no client navigate), so
// `/train/gym` keeps working for its three live navigation targets
// (MesoStartSheet + MesocyclePlannerPage post-start redirects,
// CustomWorkoutBuilderPage's useBackNav fallback) and for PWA bookmarks — all
// of them live in the pathname, not in the page's own concern. Kept
// deliberately in the F8 cleanup (mezo-d20.9.1) for exactly that reason.
//
// The behavioral coverage that used to live here now lives on
// TrainWeekPage.test.tsx (schedule sheet save/override, Mezociklus áttekintő
// chip, live zone grid + over-budget styling, direct-start day navigation).
test('renders the same content as Heti (mezo-d20.3.2)', () => {
  const a = render(<QueryWrapper><MemoryRouter><GymPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByText('Heti edzések')).toBeInTheDocument()
  a.unmount()
  const b = render(<QueryWrapper><MemoryRouter><TrainWeekPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByText('Heti edzések')).toBeInTheDocument()
  b.unmount()
})
