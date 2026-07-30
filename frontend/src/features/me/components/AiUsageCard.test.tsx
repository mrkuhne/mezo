import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { AiUsageCard, formatUsageCost } from '@/features/me/components/AiUsageCard'

afterEach(() => vi.unstubAllEnvs())

function renderCard() {
  return render(<AiUsageCard />, { wrapper: QueryWrapper })
}

/**
 * A tile = the `.bio` cell carrying the period label. The count renders as
 * `{n} <small>hívás</small>` (the BiometricCard stat idiom), so the count+unit
 * is one element's textContent rather than a single text node.
 */
function tile(label: string): HTMLElement {
  const cell = screen.getByText(label).closest('.bio')
  expect(cell).not.toBeNull()
  return cell as HTMLElement
}

describe('formatUsageCost', () => {
  it('formats a cost with two decimals and dashes an unknown (null) cost', () => {
    expect(formatUsageCost(0.04)).toBe('$0.04')
    expect(formatUsageCost(1.2)).toBe('$1.20')
    expect(formatUsageCost(null)).toBe('—')
    expect(formatUsageCost(undefined)).toBe('—')
  })
})

describe('AiUsageCard (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('renders the three period tiles with their call counts and costs', () => {
    renderCard()
    expect(screen.getByText('AI-használat')).toBeInTheDocument()
    // Ma / Ez a hét / Ez a hónap — count + cost per tile (the seeded demo numbers).
    expect(tile('Ma')).toHaveTextContent('12 hívás')
    expect(tile('Ma')).toHaveTextContent('$0.04')
    expect(tile('Ez a hét')).toHaveTextContent('78 hívás')
    expect(tile('Ez a hét')).toHaveTextContent('$0.31')
    expect(tile('Ez a hónap')).toHaveTextContent('305 hívás')
    expect(tile('Ez a hónap')).toHaveTextContent('$1.22')
    // The estimate caveat (placeholder model prices).
    expect(screen.getByText(/~ becslés/)).toBeInTheDocument()
    // Mock seeds synchronously → no loading frame.
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('AiUsageCard (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('shows an em dash for a period whose cost is null (unpriced ≠ zero)', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/summary`, () =>
        HttpResponse.json({
          day: { callCount: 4, costUsd: null, currency: 'USD' },
          week: { callCount: 31, costUsd: 0.12, currency: 'USD' },
          month: { callCount: 118, costUsd: 0.5, currency: 'USD' },
        }),
      ),
    )
    renderCard()
    await waitFor(() => expect(tile('Ma')).toHaveTextContent('4 hívás'))
    expect(screen.getByText('—')).toBeInTheDocument() // Ma has no priced call
    expect(tile('Ma')).toHaveTextContent('—')
    expect(tile('Ez a hét')).toHaveTextContent('$0.12')
    expect(tile('Ez a hónap')).toHaveTextContent('$0.50') // 0.5 → two decimals
  })

  it('ghosts (role="status" skeleton, no seeded numbers) while the query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/llm-usage/summary`, () => new Promise(() => {}))) // never resolves
    renderCard()
    expect(await screen.findByRole('status')).toBeInTheDocument()
    // The tile labels stay (layout-aware skeleton), but never the mock seed's numbers.
    expect(tile('Ez a hónap')).not.toHaveTextContent('305')
    expect(screen.queryByText(/hívás/)).toBeNull()
    expect(screen.queryByText('$1.22')).toBeNull()
  })
})
