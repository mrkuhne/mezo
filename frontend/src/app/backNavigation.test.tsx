import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Back navigation in the REAL shell (mezo-kuwj). The unit tests around `arrival.tsx` prove the
// rule; this one proves the shell actually PUBLISHES it — without the provider mounted above the
// Outlet, `useArrival()` falls back to its 'push' default and every page happily replays its
// entrance on swipe-back, exactly as before, with the whole mechanism sitting there unused.

beforeEach(() => seedAllKalauzSeen())

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  return router
}

/** Every `.rise` tile that is still inside an armed `.mz-play` group. */
function armedTiles(): number {
  return [...document.querySelectorAll('.rise')].filter(r => r.closest('.mz-play')).length
}

test('the entrance choreography is armed on the way IN — a fresh load is an arrival', async () => {
  renderApp('/me')
  expect(await screen.findByRole('button', { name: 'Súly' })).toBeInTheDocument()
  expect(armedTiles()).toBeGreaterThan(0)
})

test('a back navigation returns to a SETTLED page — no entrance replay, no flash', async () => {
  const router = renderApp('/me')
  await userEvent.click(await screen.findByRole('button', { name: 'Súly' }))
  expect(router.state.location.pathname).toBe('/me/weight')

  await act(async () => { await router.navigate(-1) })
  expect(router.state.location.pathname).toBe('/me')

  // The hub is back and its tiles are present — but none of them is inside an armed
  // `.mz-play`, so `.mz-play .rise { opacity: 0 }` never matches and nothing fades in.
  expect(await screen.findByRole('button', { name: 'Súly' })).toBeInTheDocument()
  expect(document.querySelectorAll('.rise').length).toBeGreaterThan(0)
  expect(armedTiles()).toBe(0)
})

test('a forward navigation made AFTER a back one is an arrival again', async () => {
  const router = renderApp('/me')
  await userEvent.click(await screen.findByRole('button', { name: 'Súly' }))
  await act(async () => { await router.navigate(-1) })
  expect(armedTiles()).toBe(0)

  await userEvent.click(await screen.findByRole('button', { name: 'Alvás' }))
  expect(router.state.location.pathname).toBe('/me/sleep')
  expect(armedTiles()).toBeGreaterThan(0)
})
