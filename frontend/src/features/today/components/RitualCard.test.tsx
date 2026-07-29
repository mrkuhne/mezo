import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RitualCard } from '@/features/today/components/RitualCard'
import { QueryWrapper } from '@/test/queryWrapper'
import type { RitualDay } from '@/data/types'

// useRitualDay is mocked directly (not the dual-mode dance) so every test below is
// deterministic regardless of ambient VITE_USE_MOCK — the ritual data layer already has its
// own hook tests (ritualHooks.test.tsx); this file only exercises RitualCard's own
// waiting/open/done branching + the ?ritual= override precedence.
const hooks = vi.hoisted(() => ({ useRitualDay: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useRitualDay: hooks.useRitualDay,
}))

const WINDOW = { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' }
const OPEN_DAY: RitualDay = { date: '2026-07-25', closed: false, closedAt: null, window: WINDOW }

// The /ritual route is mounted so the CTA's navigate() is observable end-to-end.
function renderCard(path: string, now?: Date) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/today" element={<RitualCard now={now} />} />
          <Route path="/ritual" element={<div>ritual flow</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

const cta = () => screen.queryByRole('button', { name: /Zárjuk le a napot/ })

describe('RitualCard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useRitualDay.mockReturnValue({ data: OPEN_DAY, isPending: false })
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('?ritual= URL override wins over the derived state', () => {
    test('?ritual=done renders the logged card, no CTA', () => {
      const { container } = renderCard('/today?ritual=done')
      expect(screen.getByRole('heading', { name: 'Napzárás kész' })).toBeInTheDocument()
      expect(container.querySelector('.todaycard.logged')).toBeTruthy()
      expect(screen.getByText(/NAPZÁRÁS · MEGVAN/)).toBeInTheDocument()
      expect(cta()).toBeNull()
    })

    test('?ritual=open wins over an early `now` that would derive "waiting"', () => {
      renderCard('/today?ritual=open', new Date(2026, 6, 25, 10, 0))
      expect(screen.getByRole('heading', { name: 'Zárjuk le a napot' })).toBeInTheDocument()
      expect(screen.getByText('MOST')).toBeInTheDocument()
      expect(screen.queryByText('Még vár')).not.toBeInTheDocument()
      expect(cta()).toBeInTheDocument()
    })

    test('?ritual=waiting wins over a late `now` that would derive "open" — muted, no CTA', () => {
      renderCard('/today?ritual=waiting', new Date(2026, 6, 25, 23, 0))
      expect(screen.getByText('Még vár')).toBeInTheDocument()
      expect(screen.queryByText('MOST')).not.toBeInTheDocument()
      expect(cta()).toBeNull()
      // the window facts still tell the whole story
      expect(screen.getByText(WINDOW.opensAt)).toBeInTheDocument()
      expect(screen.getByText(`villanyoltás ${WINDOW.bedTime}`)).toBeInTheDocument()
    })
  })

  describe('derived state (no override) — fixed `now` prop', () => {
    test('before opensAt: waiting card', () => {
      renderCard('/today', new Date(2026, 6, 25, 20, 0))
      expect(screen.getByText('Még vár')).toBeInTheDocument()
      expect(screen.getByText(`villanyoltás ${WINDOW.bedTime}`)).toBeInTheDocument()
      expect(cta()).toBeNull()
    })

    test('after opensAt: open card with the CTA', () => {
      renderCard('/today', new Date(2026, 6, 25, 21, 30))
      expect(screen.getByText('MOST')).toBeInTheDocument()
      expect(cta()).toBeInTheDocument()
    })

    test('the open CTA navigates into the /ritual flow', () => {
      renderCard('/today', new Date(2026, 6, 25, 21, 30))
      fireEvent.click(cta()!)
      expect(screen.getByText('ritual flow')).toBeInTheDocument()
    })

    test('ritualDay.closed wins over the window even at an "open" `now` (closed→done precedence)', () => {
      hooks.useRitualDay.mockReturnValue({ data: { ...OPEN_DAY, closed: true }, isPending: false })
      renderCard('/today', new Date(2026, 6, 25, 21, 30))
      expect(screen.getByRole('heading', { name: 'Napzárás kész' })).toBeInTheDocument()
      expect(cta()).toBeNull()
    })
  })
})
