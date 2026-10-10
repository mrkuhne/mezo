// ============================================================
// Mezo · Regresszió: a kényszerített sötét téma zsebei — /ritual már NEM az, az éjszakai mód igen.
//
// Történet. A Napzárás rituálé (RitualPage) sötétre tervezett felület volt, és a `useForceTheme`-mel
// maga kérte a sötét témát a felhasználó világos beállítása FÖLÖTT is. Ez a fájl eredetileg
// (mezo-mhum javítóhullám) azt a hibát fogta meg, amikor a Titán Nap shell egy második igényt
// tartott ugyanazon a kapcsolón, és a két hatás sorrendje kiütötte a rituáléét; a
// Visszaöltöztetés (mezo-ju4j6.3) óta a shellnek nincs saját igénye.
//
// Folyadék F2 (mezo-n4wf5.2, tulajdonosi döntés 2026-10-10): a Napzárás VILÁGOS. A rituálé a
// Folyadék készletet viseli (`.nrz-*`), és nem kér többé sötét témát. A teszt ezért az ÚJ igazságot
// rögzíti, VALÓDI AppLayout + VALÓDI oldalak mellett:
//   · a /ritual megjelenítése nem kényszerít sötétet — sem feloldott, sem élő alkalmazás-zár mellett;
//   · a megmaradt EGYETLEN sötét zseb, az éjszakai mód (/me/sleep/night, `NightPage`), megtartja a
//     sajátját: az élő világos zár fölött is sötét, és kilépve a világos tér vissza.
// Így a többigénylős `useForceTheme` egyetlen élő igénylője is le van fedve: ha valaki a rituáléba
// visszateszi az igényt, vagy az éjszakai módból kiveszi, ez a fájl szól.
// ============================================================
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Csökkentett mozgás: a belépő-koreográfia ne takarja a tartalmat jsdom alatt.
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

// Folyadék bible §1.1 (mezo-n4wf5.1): the app is light-locked; a live force claim outranks the
// lock. Each test says which side it exercises (`lock={null}` = the lock lifted, the stored
// preference decides; no prop = the app's real lock).
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

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'

function renderApp(lock?: null) {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(
    <QueryWrapper>
      {lock === null
        ? <ThemeProvider lock={null}><RouterProvider router={router} /></ThemeProvider>
        : <ThemeProvider><RouterProvider router={router} /></ThemeProvider>}
    </QueryWrapper>,
  )
  return router
}

async function openRitual(router: ReturnType<typeof createMemoryRouter>) {
  await act(async () => { await router.navigate('/ritual') })
  // The ritual really rendered (its Folyadék root), so "not dark" is not a blank-page pass.
  await waitFor(() => expect(document.querySelector('.nrz')).not.toBeNull())
}

test('a /nap felől érkező Napzárás rituálé világos marad — feloldott zár mellett sem kér sötétet', async () => {
  const router = renderApp(null)
  expect(isDark()).toBe(false)

  await openRitual(router)

  expect(isDark()).toBe(false)
})

test('a Napzárás rituálé az élő alkalmazás-zár mellett is világos', async () => {
  const router = renderApp()
  await openRitual(router)
  expect(isDark()).toBe(false)
})

// A megmaradt sötét zseb: az éjszakai mód a zár FÖLÖTT kéri a sötétet, és kilépve elengedi.
test('az éjszakai mód sötét marad a világos zár fölött is, kilépve pedig visszatér a világos', async () => {
  const router = renderApp()
  expect(isDark()).toBe(false)

  await act(async () => { await router.navigate('/me/sleep/night') })
  expect(await screen.findByText('Felébredtél?')).toBeInTheDocument()
  expect(isDark()).toBe(true)

  await act(async () => { await router.navigate('/me') })
  await waitFor(() => expect(isDark()).toBe(false))
})

// A két felület egymás után: a rituálé nem „örökli" az éjszakai mód igényét, és nem is hagy hátra sajátot.
test('éjszakai mód → Napzárás: a sötét igény a zsebbel együtt megszűnik', async () => {
  const router = renderApp(null)
  await act(async () => { await router.navigate('/me/sleep/night') })
  expect(await screen.findByText('Felébredtél?')).toBeInTheDocument()
  expect(isDark()).toBe(true)

  await openRitual(router)
  expect(isDark()).toBe(false)
})
