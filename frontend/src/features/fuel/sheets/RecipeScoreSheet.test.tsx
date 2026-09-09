import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, vi } from 'vitest'
import { RecipeScoreSheet } from '@/features/fuel/sheets/RecipeScoreSheet'
import { recipes } from '@/data/fuel/pantry'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { QueryWrapper } from '@/test/queryWrapper'

// rec-1's templateBreakdown mirrors the mock meal m1's breakdown (pantry.ts) — it carries a
// real coach summary, so it is the "prose present" fixture; every other test overrides
// `summary` explicitly for the "no prose" case rather than hunting for a summary-less seed.
const RECIPE = recipes.find((r) => r.id === 'rec-1')!
const BREAKDOWN = RECIPE.templateBreakdown!

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the recipe name and dimension cards', () => {
  render(<RecipeScoreSheet recipe={RECIPE} breakdown={BREAKDOWN} onClose={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText(RECIPE.name)).toBeInTheDocument()
  expect(screen.getByLabelText('Bezárás')).toBeInTheDocument()
})

test('close button dismisses', async () => {
  const onClose = vi.fn()
  render(<RecipeScoreSheet recipe={RECIPE} breakdown={BREAKDOWN} onClose={onClose} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByLabelText('Bezárás'))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// 👍/👎 on the recipe's coach prose (mezo-76f6) — mounted only when `breakdown.summary` is
// actually present; a purely deterministic breakdown has nothing to vote on.
describe('recipe_breakdown feedback chips', () => {
  test('prose present: chips render, and a vote round-trips (mock mode)', async () => {
    expect(BREAKDOWN.summary).toBeTruthy() // the fixture must actually exercise this path
    render(<RecipeScoreSheet recipe={RECIPE} breakdown={BREAKDOWN} onClose={() => {}} />, { wrapper: QueryWrapper })
    const up = screen.getByRole('button', { name: /Segített/ })
    await userEvent.click(up)
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'))
  })

  test('no prose: no feedback chips render', () => {
    const noProse = { ...BREAKDOWN, summary: null }
    render(<RecipeScoreSheet recipe={RECIPE} breakdown={noProse} onClose={() => {}} />, { wrapper: QueryWrapper })
    expect(screen.queryByRole('button', { name: /Segített/ })).not.toBeInTheDocument()
  })

  test('real mode: a stored verdict hydrates the chip, and a vote PUTs recipe_breakdown/{recipe.id}', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const puts: unknown[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('kind')).toBe('recipe_breakdown')
        return HttpResponse.json([
          { artifactKind: 'recipe_breakdown', artifactId: RECIPE.id, verdict: 'down', reason: 'inaccurate', updatedAt: '2026-09-08T10:00:00Z' },
        ])
      }),
      http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
        const body = await request.json()
        puts.push(body)
        return HttpResponse.json({ ...(body as Record<string, unknown>), updatedAt: '2026-09-08T10:01:00Z' })
      }),
    )
    render(<RecipeScoreSheet recipe={RECIPE} breakdown={BREAKDOWN} onClose={() => {}} />, { wrapper: QueryWrapper })
    const down = await screen.findByRole('button', { name: /Nem talált/ })
    await waitFor(() => expect(down).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(screen.getByRole('button', { name: /Segített/ }))
    await waitFor(() => expect(puts).toEqual([{ artifactKind: 'recipe_breakdown', artifactId: RECIPE.id, verdict: 'up' }]))
  })
})
