// Heti retired (mezo-p2tr): /insights/weekly is now an honest redirect to /me/week (WeekHubPage) —
// the motor redirect precedent (router.tsx `motor` -> `/mezo`) is untested at this layer per
// insights.nav.test.tsx's own comment, but /me/week fully replaces WeeklyPage's content (score
// hero, growth card, weekly tervjavaslat prose) so this one earns a router-level assertion.
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

describe('/mezo/weekly redirect (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('lands on the /me/week Heti hub, not the retired Insights Heti tab', async () => {
    renderApp('/mezo/weekly')
    // The hub's own furniture (mezo-d20.6.10) — the four-view section label.
    expect(await screen.findByText('A hét négy nézete')).toBeInTheDocument()
  })
})
