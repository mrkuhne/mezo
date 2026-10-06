// ============================================================
// Én IA (mezo-lhqw7): routine BUILDING moved from /me/rutin/* to Nap's Rutin tab (/nap/rutin/*) —
// „egy téma, egy hely". Old URLs (bookmarks, stored notifications with /me/rutin/szokas/…)
// must never 404 and must keep the query string.
// ============================================================
import { render, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { ThemeProvider } from '@/app/ThemeProvider'
import { routes } from '@/app/router'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

function renderRouterAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  // ThemeProvider must wrap the router (AppLayout mounts CircadianTheme before the redirect resolves).
  render(
    <QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>,
  )
  return router
}

test.each([
  ['/me/rutin', '/nap/rutin/epites'],
  ['/me/rutin/uj', '/nap/rutin/uj'],
  ['/me/rutin/szokasok', '/nap/rutin/szokasok'],
  ['/me/rutin/szokas/morning_weigh_in', '/nap/rutin/szokas/morning_weigh_in'],
  ['/me/rutin/szokas/morning_weigh_in/szerkesztes', '/nap/rutin/szokas/morning_weigh_in/szerkesztes'],
  ['/me/rutin/lanc/MORNING', '/nap/rutin/lanc/MORNING'],
  ['/me/growth/rutin', '/nap/rutin/epites'],
  ['/me/routines/edit', '/nap/rutin/epites'],
])('%s lands on %s', async (from, to) => {
  const router = renderRouterAt(from + '?x=1')
  await waitFor(() => expect(router.state.location.pathname).toBe(to))
  expect(router.state.location.search).toBe('?x=1')
})

// final review: an unknown sub-path is forwarded like the known ones (/me/rutin/xyz →
// /nap/rutin/xyz); nothing matches there, so the app's catch-all takes it — no throw, no 404.
test('/me/rutin/xyz (unknown sub-path) ends on the catch-all destination without throwing', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const router = renderRouterAt('/me/rutin/xyz')
  await waitFor(() => expect(router.state.location.pathname).toBe('/nap'))
  expect(router.state.errors).toBeNull()
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})
