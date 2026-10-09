// A napom (mezo-yjzhw.4): the retired single-day route `/me/week/napok/:date` now forwards
// to `/nap/napom/:date` — the day's new address. The mosaic itself (`/me/week/napok`)
// survives untouched; only the ONE-day deep link (an old bookmark, a push notification)
// needs to keep working. Harness copied from `router.weeklyRedirect.test.tsx`.
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

describe('/me/week/napok/:date redirect (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('lands on the new /nap/napom/:date address, the ?start= param dropped', async () => {
    const router = renderApp('/me/week/napok/2026-09-23?start=2026-09-21')
    // The shell around the page is the observable proof the redirect landed: the title bar's
    // context line names the owning tab (the day page is a sub-page — no tab strip), and the
    // Nap drop is lit on the bottom bar.
    expect(await screen.findByText('Nap · A napom')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nap' })).toHaveAttribute('aria-current', 'true')
    expect(router.state.location.pathname).toBe('/nap/napom/2026-09-23')
  })
})
