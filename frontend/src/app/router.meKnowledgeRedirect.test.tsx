// KnowledgePage retired (mezo-ms9a): `/me/knowledge` is now an honest redirect to the unified
// Tudástár's Kategóriák view (`/mezo/knowledge?view=kategoriak`) — the `/mezo/weekly` redirect
// precedent (router.weeklyRedirect.test.tsx) is the pattern followed here. The incoming `?kind=`
// deep link (old KnowledgePage tile-drill) is forwarded as `&kind=` so bookmarks/notifications
// still land in the same category.
import { render, screen, waitFor } from '@testing-library/react'
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

describe('/me/knowledge redirect (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('(a) /me/knowledge lands on the Kategóriák view of the unified Tudástár, at /mezo/knowledge', async () => {
    const router = renderApp('/me/knowledge')
    expect(await screen.findByRole('button', { name: 'Minták' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preferenciák' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tények' })).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/mezo/knowledge'))
    expect(router.state.location.search).toBe('?view=kategoriak')
  })

  test('(b) /me/knowledge?kind=PATTERN forwards the kind into the category drill on /mezo/knowledge', async () => {
    const router = renderApp('/me/knowledge?kind=PATTERN')
    expect(await screen.findByText('‹ Kategóriák')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Késői evés rontja az alvást/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mezo/knowledge')
    expect(router.state.location.search).toBe('?view=kategoriak&kind=PATTERN')
  })
})
