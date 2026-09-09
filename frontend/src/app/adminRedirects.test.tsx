import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'

// Task 13 (mezo-d5iy.13): BetaAdminPage and AiUsagePage/AiCallDetailPage moved under /admin as
// AdminAccountsPage/AdminCostPage/AdminCostDetailPage. Their old `/me/*` routes are now pure
// redirects (`me/beallitasok/admin` → `/admin/accounts`, `me/ai-usage(/…)` → `/admin/cost(/…)`)
// for bookmarks and any in-app navigate() call not yet migrated. Assertions below target what
// the moved pages actually render — AdminAccountsPage's PageHero name (unchanged: "Beta admin",
// this is a move not a rewrite) and AdminCostDetailPage's h1, which prints the mock call's
// feature/operation — not the AdminRail link labels, which are always on screen once AdminLayout
// mounts regardless of which admin route matched.

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  // AppLayout (the `/` parent route these `me/*` legacy paths live under) mounts CircadianTheme
  // on the FIRST render pass — before the <Navigate>/<LegacyPathRedirect> child even resolves
  // the actual destination — so ThemeProvider must wrap the router regardless of which admin
  // page the redirect eventually lands on (router.weeklyRedirect.test.tsx's precedent).
  const result = render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return { ...result, router }
}

describe('legacy owner routes (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('redirects me/beallitasok/admin to /admin/accounts (AdminAccountsPage)', async () => {
    const { router } = renderAt('/me/beallitasok/admin')
    expect(await screen.findByText('Beta admin')).toBeInTheDocument()
    expect(screen.getByText('Meghívók és fiókok')).toBeInTheDocument() // AdminRail, confirms /admin/accounts is active
    expect(router.state.location.pathname).toBe('/admin/accounts')
  })

  it('redirects me/ai-usage to /admin/cost (AdminCostPage)', async () => {
    const { router } = renderAt('/me/ai-usage')
    // mezo-pfdv Task 2 rebuilt AdminCostPage: the old "AI-napló" header is gone, replaced by
    // the section template — its PageHero is now named "Költés" too (same as the AdminRail
    // link), so the rail confirmation below is scoped to the `link` role to stay unambiguous.
    // The KPI strip's "<HÓNAP> · NAPTÁRI HÓNAP" eyebrow is a stable marker unique to the new page.
    expect(await screen.findByText(/NAPTÁRI HÓNAP/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Költés' })).toBeInTheDocument() // AdminRail, confirms /admin/cost is active
    expect(router.state.location.pathname).toBe('/admin/cost')
  })

  it('preserves the id when redirecting me/ai-usage/:id to /admin/cost/:id (AdminCostDetailPage)', async () => {
    const { router } = renderAt('/me/ai-usage/abc-123')
    // AdminCostDetailPage always renders the mock call's own id-independent detail (mock mode
    // answers the same fixed LLM_CALL_DETAIL_MOCK regardless of :id) — the h1 below proves the
    // detail page, not the list, mounted; the URL assertion is what actually proves the :id
    // survived the redirect (LegacyPathRedirect's `location.pathname.replace` mechanics).
    expect(await screen.findByText(/companion_chat/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/cost/abc-123')
  })
})
