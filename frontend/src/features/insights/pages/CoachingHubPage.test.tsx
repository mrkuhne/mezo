import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { CoachingHubPage } from '@/features/insights/pages/CoachingHubPage'

const renderPage = () =>
  render(<MemoryRouter><CoachingHubPage /></MemoryRouter>, { wrapper: QueryWrapper })

describe('CoachingHubPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('leads with the winner and its rank, then the split and the two doors', async () => {
    renderPage()
    expect(screen.getByText('Proaktív coaching')).toBeInTheDocument()
    // The winner is named from day.winner — the demo day's rank-2 rule.
    // The propcard above shows it as a bare label; the tile line restores specificity.
    expect(await screen.findByText('Terhelés–táplálás')).toBeInTheDocument()
    expect(screen.getByText('Terhelés–táplálás nyerte a napot')).toBeInTheDocument()
    expect(screen.getByText('2/14')).toBeInTheDocument()
    // The split, as cells: 2 jelzett + 1 pihenőn + 8 rendben + 3 nem mérhető in the demo day.
    expect(screen.getByText('Jelzett')).toBeInTheDocument()
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Megfigyelő' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A napi kártya' })).toBeInTheDocument()
  })

  test('the arc draws one segment per rule', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(14)
  })
})

describe('CoachingHubPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved day fabricates nothing — no zero split, no winner', () => {
    const { container } = renderPage()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.mzo-arcseg')).toHaveLength(0)
    expect(screen.queryByText('Terhelés–táplálás')).not.toBeInTheDocument()
  })

  test('a genuinely empty day says so instead of showing a blank', async () => {
    // The shared default handler already answers an empty day for today's date; overriding here
    // pins a specific (non-today) date so this test's intent — a genuinely empty day is the
    // server answering 200 with no rules yet, not an unresolved/erroring fetch — is explicit.
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () =>
      HttpResponse.json({ date: '2026-09-06', rules: [], transitions: [] })))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Még nem futott kiértékelés — az első után itt látod a döntést.'))
        .toBeInTheDocument())
  })
})
