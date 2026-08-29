import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

// Design 2.0 endgame (mezo-d20.9.1): every one of the five tab shells is dissolved and the
// old `AppHero` identity header has been DELETED from the tree — so this file no longer pins
// its absence (a guard against a component that does not exist is vacuous). What it pins now
// is the positive contract that replaced it: each of the five tab roots renders its OWN
// `.nap-head` header recipe. Renamed from `appHeroMount.test.tsx` when AppHero went away.
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('the %s tab root carries its own .nap-head header', (path) => {
  renderAt(path)
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
})

// Per-tab provenance for the same contract, and the one extra Nap-only retirement: the
// ✨ Insights link is gone from the Nap header (Mezo is a first-class tab, decision B).
//   /nap   — mezo-d20.2.1  /train — mezo-d20.3.1  /fuel — mezo-d20.4.1
//   /mezo  — mezo-d20.5.1 (the /insights route redirects into it)   /me — mezo-d20.6.1
test('the Nap hub header no longer carries the ✨ Insights link', () => {
  renderAt('/nap')
  expect(document.querySelector('a[aria-label="Insights"]')).not.toBeInTheDocument()
})
