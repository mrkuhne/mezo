// A „Mutasd meg a képernyőn" gomb CSAK akkor renderel, ha az anchor épp a DOM-ban van
// (KalauzSheet.tsx:64) — némán degradál. Ez a teszt fogja el, ha egy hős-variánsról
// lemarad az attribútum: arc-variánsonként külön renderel.
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>,
  )
}

const hasAnchor = (name: string) => document.querySelector(`[data-kalauz-anchor="${name}"]`)

// A `?dp=` CSAK a /nap-on jelent napszak-választást (useDayFace.ts:20-27), a `?day=rough`
// pedig az anchor-mód (NapHubPage.tsx:216). Mind a négy felület saját JSX-node.
test.each(['/nap?dp=reggel', '/nap?dp=nap', '/nap?dp=este', '/nap?day=rough'])(
  '%s — a nap-hero anchor jelen van', (path) => {
    renderAt(path)
    expect(hasAnchor('nap-hero')).not.toBeNull()
  },
)

// A /train hőse hat SZÁMÍTOTT variáns (EdzesHubPage.tsx:109,129,163,185,215,235), egyszer
// renderelve (:302). Mock-módban a mai nap edzés-variánst ad; a többi variánst a
// registry-lint nem látja, ezért az attribútum mind a hatra kikerül — a code review
// feladata, hogy egyik se maradjon le.
test('/train — a train-hero anchor jelen van', () => {
  renderAt('/train')
  expect(hasAnchor('train-hero')).not.toBeNull()
})

// A /mezo döntéskártyája (:174) és a /me cél-kártyája (:108) adat-feltételes, ezért NEM
// anchor: a „Mutasd meg" gomb némán eltűnne. A chat-nyitó és az identitás-hős
// feltétel nélkül renderel.
test('/mezo — a mezo-chat anchor jelen van', () => {
  renderAt('/mezo')
  expect(hasAnchor('mezo-chat')).not.toBeNull()
})

test('/me — a me-idhero anchor jelen van', () => {
  renderAt('/me')
  expect(hasAnchor('me-idhero')).not.toBeNull()
})
