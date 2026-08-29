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

// Design 2.0 endgame: with the Nap, Edzés, Fuel, Mezo and Én shells all dissolved, NO tab
// root mounts AppHero any more — each hub carries its own header recipe. The component and
// its remaining call sites are dead chrome, queued for removal in F8 (mezo-d20.9.1). Until
// then this file pins the honest inverse: the five tab roots are AppHero-free.
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('no AppHero on the %s tab root', (path) => {
  renderAt(path)
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
})

// Design 2.0 (mezo-d20.3.1): the Train shell dissolved — /train is the Edzés hub Mozaik
// face with the Nap-hub header recipe, and the nine sub-tabs are full-page siblings.
test('the Edzés hub replaces AppHero with its own header', () => {
  renderAt('/train')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
})

// Design 2.0 (mezo-d20.4.1): the same for the Fuel shell.
test('the Fuel hub replaces AppHero with its own header', () => {
  renderAt('/fuel')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
})

// Design 2.0 (mezo-d20.6.1): the Me shell dissolved too — /me is the Én hub Mozaik face
// with the Nap-hub header recipe, and the former sub-tabs are full-page siblings.
test('the Én hub replaces AppHero with its own header', () => {
  renderAt('/me')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
})

// Design 2.0 (mezo-d20.5.1): the Insights shell dissolved — the Mezo hub carries the
// Nap-hub header recipe instead of AppHero, and /insights redirects into it.
test('the Mezo hub replaces AppHero with its own header', () => {
  renderAt('/mezo')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
})

// Design 2.0 (mezo-d20.2.1): the Nap hub carries its own header recipe — no AppHero,
// and the ✨ Insights link is retired (Mezo is a first-class tab, decision B).
test('the Nap hub replaces AppHero with its own header', async () => {
  renderAt('/nap')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
  expect(document.querySelector('.nap-head')).toBeInTheDocument()
  expect(document.querySelector('a[aria-label="Insights"]')).not.toBeInTheDocument()
})
