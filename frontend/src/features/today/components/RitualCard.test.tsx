import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

function renderCard(path: string, now?: Date) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <RitualCard now={now} />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('RitualCard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useRitualDay.mockReturnValue({ data: OPEN_DAY, isPending: false })
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('?ritual= URL override wins over the derived state', () => {
    test('?ritual=done renders the quiet closed row, no link/CTA', () => {
      renderCard('/today?ritual=done')
      expect(screen.getByText('Napzárás kész')).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    test('?ritual=open wins over an early `now` that would derive "waiting"', () => {
      renderCard('/today?ritual=open', new Date(2026, 6, 25, 10, 0))
      expect(screen.getByText('Napzárás')).toBeInTheDocument()
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/ritual')
      expect(link.className).not.toContain('waiting')
      expect(screen.getByText('Zárjuk le a napot ✨')).toBeInTheDocument()
      expect(
        screen.getByText(`A nap kész. Zárd le, mielőtt az alvás-előkészítés indul (${WINDOW.prepStartsAt}).`),
      ).toBeInTheDocument()
    })

    test('?ritual=waiting wins over a late `now` that would derive "open" — muted, still a real Link (soft gate)', () => {
      renderCard('/today?ritual=waiting', new Date(2026, 6, 25, 23, 0))
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/ritual')
      expect(link.className).toContain('waiting')
      expect(
        screen.getByText(`${WINDOW.opensAt}-kor nyílik — villanyoltás ${WINDOW.bedTime}.`),
      ).toBeInTheDocument()
    })
  })

  describe('derived state (no override) — fixed `now` prop', () => {
    test('before opensAt: waiting card', () => {
      renderCard('/today', new Date(2026, 6, 25, 20, 0))
      expect(
        screen.getByText(`${WINDOW.opensAt}-kor nyílik — villanyoltás ${WINDOW.bedTime}.`),
      ).toBeInTheDocument()
      expect(screen.getByRole('link').className).toContain('waiting')
    })

    test('after opensAt: open card (glow CTA)', () => {
      renderCard('/today', new Date(2026, 6, 25, 21, 30))
      expect(screen.getByText('Zárjuk le a napot ✨')).toBeInTheDocument()
      expect(screen.getByRole('link').className).not.toContain('waiting')
    })

    test('ritualDay.closed wins over the window even at an "open" `now` (closed→done precedence)', () => {
      hooks.useRitualDay.mockReturnValue({ data: { ...OPEN_DAY, closed: true }, isPending: false })
      renderCard('/today', new Date(2026, 6, 25, 21, 30))
      expect(screen.getByText('Napzárás kész')).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })
})
