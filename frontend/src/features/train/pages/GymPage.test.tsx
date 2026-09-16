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
// chip, the live group cards + the over-planned flag, the group glass).
//
// The parity anchor is the Titanium hero's own eyebrow (mezo-88iwa.13, T12 Task 3) —
// the „Heti edzések" h1 retired with the old Mozaik page head, so the anchor moved
// with the face rather than the test being dropped.
test('renders the same content as Terhelés (mezo-d20.3.2)', () => {
  const a = render(<QueryWrapper><MemoryRouter><GymPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByText(/Terhelés · \d+\. hét/)).toBeInTheDocument()
  a.unmount()
  const b = render(<QueryWrapper><MemoryRouter><TrainWeekPage /></MemoryRouter></QueryWrapper>)
  expect(screen.getByText(/Terhelés · \d+\. hét/)).toBeInTheDocument()
  b.unmount()
})
