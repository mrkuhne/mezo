// ============================================================
// Mezo · Regresszió: /nap → /ritual, világos beállítás mellett (mezo-mhum javítóhullám).
//
// A Napzárás rituálé (RitualPage) sötétre tervezett felület, és a `useForceTheme`-mel maga
// kéri a sötét témát — a felhasználó világos beállítása FÖLÖTT is. Eredetileg (mezo-mhum
// javítóhullám) azért kellett ez a regresszió, mert a Titán Nap shell EGYSZERRE tartott egy
// második igényt ugyanazon a kapcsolón, és a két hatás sorrendje kiütötte a rituáléét.
//
// Visszaöltöztetés (mezo-ju4j6.3): a shell igénye MEGSZŰNT (nincs több kényszerített sötét
// útvonal), tehát a rituálé maradt az EGYETLEN igénylő. Ez nem teszi feleslegessé a tesztet,
// sőt: a többigénylős `useForceTheme` így már csak itt van használatban, és pont ez az a
// helyzet, amiben egy „egyszerűsítsük vissza egyszemélyes kapcsolóra" változtatás észrevétlenül
// átmenne. A teszt VALÓDI AppLayout + VALÓDI RitualPage mellett figyeli, hogy a /ritual sötét
// marad, a rajta kívüli útvonalak pedig világosak.
// ============================================================
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Csökkentett mozgás: a belépő-koreográfia ne takarja a tartalmat jsdom alatt, és a Nap élő
// three.js társa se induljon el (a statikus SVG-t adja helyette).
function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
  // A KULCS: kézzel világosra állított beállítás. Enélkül a mód `auto`, és a cirkadián
  // feloldó este magától sötétet adna — a teszt a mechanizmus nélkül is zöld lenne.
  localStorage.setItem('mezo-theme', 'light')
  stubReduced()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

test('a /nap felől érkező Napzárás rituálé sötét marad világos beállítás mellett is', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  // A shellnek már NINCS saját sötét igénye: a Nap a beállított világos témán indul.
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')

  await act(async () => { await router.navigate('/ritual') })

  expect(await screen.findByText('A nap véget ért.')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

// A kontroll-útvonal a /me: a rituáléból kilépve a felhasználó saját beállítása tér vissza.
test('a rituáléból kilépve a világos beállítás visszatér (a /me nem sötét)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await act(async () => { await router.navigate('/ritual') })
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

  await act(async () => { await router.navigate('/me') })
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
})
