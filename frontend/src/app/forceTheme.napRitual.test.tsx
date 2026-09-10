// ============================================================
// Mezo · Regresszió: /nap → /ritual, világos beállítás mellett (mezo-mhum javítóhullám).
//
// A Titán Nap shell (AppLayout) és a Napzárás rituálé (RitualPage) EGYSZERRE tartja a sötét
// témát. A régi, egyszemélyes `setForceTheme` kapcsolóval a hatások gyerek-először futottak: a
// rituálé sötétre váltott, majd az AppLayout hatásának újrafutása (titan-dark igaz→hamis) UTOLSÓ
// lépésként törölte a kapcsolót — így a sötétre tervezett rituálé VILÁGOS tokenekkel rajzolódott
// annál, aki világos témát állított be. Ez a teszt VALÓDI AppLayout + VALÓDI RitualPage mellett,
// kipeckelt `light` beállítással figyeli, hogy a /ritual sötét marad.
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
  // A Titán Nap maga is sötétet kényszerít — ez az igény marad „alul".
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

  await act(async () => { await router.navigate('/ritual') })

  expect(await screen.findByText('A nap véget ért.')).toBeInTheDocument()
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('a rituáléból kilépve a világos beállítás visszatér (a /train nem sötét)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nap'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await act(async () => { await router.navigate('/ritual') })
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

  await act(async () => { await router.navigate('/train') })
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')
})
