import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'

describe('MemoirPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the memoir card, anchors, anniversary card and archive footer', () => {
    render(<MemoirPage />)
    expect(screen.getByText('Heti memoir · Hét 20 · 2026 · Máj 11-17')).toBeInTheDocument()
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
    // RefTag renders "[PR] Chest Row 102.5 × 9"; RTL normalizes &nbsp; to a space, so this matches.
    // If it ever doesn't, fall back to: screen.getByText(/Chest Row 102\.5 × 9/)
    expect(screen.getByText(/Chest Row 102\.5 × 9/)).toBeInTheDocument()
    expect(screen.getByText('Évforduló · 1 hónap')).toBeInTheDocument()
    expect(screen.getByText('Memoir archive · 17 darab')).toBeInTheDocument()
  })

  test('reaction chips toggle the brand state', async () => {
    render(<MemoirPage />)
    const like = screen.getByRole('button', { name: /Like/ })
    expect(like.className).not.toMatch(/brand/)
    await userEvent.click(like)
    expect(like.className).toMatch(/brand/)
  })
})

describe('MemoirPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the honest hamarosan ghost instead of the demo memoir', () => {
    render(<MemoirPage />)
    expect(screen.getByText('hamarosan')).toBeInTheDocument()
    expect(screen.getByText('A heti memoirt a társ írja majd — a proaktív réteggel érkezik.')).toBeInTheDocument()
    expect(screen.queryByText('Egy hét amikor a tested megtanult várni')).not.toBeInTheDocument()
  })
})
