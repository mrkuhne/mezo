import { describe, expect, test } from 'vitest'
import routerSource from '@/app/router.tsx?raw'
import { PAGE_INDEX, NOT_INDEXED } from '@/app/pageIndex'

/**
 * The guard that makes the leltár (`pageIndex.ts`) an inventory rather than a wish.
 *
 * WHY THIS EXISTS — the leltár's whole job is to be the safety net while the four tabs
 * per domain get restructured (mezo-ju4j6.17): "félek, hogy elveszítem a funkciókat
 * fejben útközben". A hand-written list that silently falls behind `router.tsx` is worse
 * than no list, because it is trusted. So the list is not trusted: this test parses the
 * router and fails the build the moment a page exists that is neither listed nor given a
 * written reason for being absent.
 *
 * It reads `router.tsx` as TEXT on purpose. Importing the module would pull in ~100 lazy
 * page chunks and their data layers; the route table is a flat literal, and the text is
 * the same source of truth without the blast radius.
 */

/** Components that are redirects, not pages — a retired URL forwarding to its new home. */
const REDIRECT_ELEMENTS =
  /^(Navigate|RetiredRouteRedirect|OwnerOnlyRedirect|LegacyPathRedirect|TrainIndex|MeKnowledgeRedirect|RedirectToWeek)$/

interface RouterRoute { route: string; element: string }

/** Every `{ path: '…', element: <X … }` pair in the router's route table. */
function routerRoutes(): RouterRoute[] {
  const found = new Map<string, string>()
  const patterns = [
    /\{\s*path:\s*'([^']+)'\s*,\s*element:\s*<(\w+)/g,
    /path:\s*'([^']+)',\n\s*element:\s*\(?\s*<?(\w+)/g,
  ]
  for (const pattern of patterns) {
    for (const match of routerSource.matchAll(pattern)) {
      if (!found.has(match[1])) found.set(match[1], match[2])
    }
  }
  // Child paths are declared relative ('nap/rutin'); the layout root declares an absolute '/'.
  // Without this the root becomes '//' — a ghost route that makes the coverage list lie.
  return [...found].map(([path, element]) => ({
    route: path.startsWith('/') ? path : '/' + path,
    element,
  }))
}

/** A real, standable surface: not a redirect, not a splat, not one INSTANCE of something. */
function listableRoutes(): RouterRoute[] {
  return routerRoutes().filter(
    (r) =>
      r.route !== '/' &&
      !r.route.includes('*') &&
      !r.route.includes(':') &&
      !REDIRECT_ELEMENTS.test(r.element),
  )
}

describe('oldal-leltár lefedettség', () => {
  test('the router parse itself is sane — it finds the whole app, not a handful of routes', () => {
    // Guards the guard: a regex that silently stops matching would make every assertion
    // below vacuously pass, which is the one failure mode this test cannot afford.
    expect(routerRoutes().length).toBeGreaterThan(100)
    expect(listableRoutes().length).toBeGreaterThan(90)
  })

  test('every listable route is either in the leltár or has a written reason not to be', () => {
    const listed = new Set(PAGE_INDEX.map((p) => p.route))
    const missing = listableRoutes()
      .map((r) => r.route)
      .filter((route) => !listed.has(route) && !(route in NOT_INDEXED))

    expect(
      missing,
      `Ezek az oldalak nincsenek benne a leltárban (frontend/src/app/pageIndex.ts). ` +
        `Vedd fel őket PAGE_INDEX-be egy névvel és egy mondattal, vagy — ha szándékosan ` +
        `maradnak ki — írd be az okot a NOT_INDEXED-be:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  test('the leltár has no entry for a route the router does not serve', () => {
    const real = new Set(routerRoutes().map((r) => r.route))
    const ghosts = PAGE_INDEX.map((p) => p.route).filter((route) => !real.has(route))
    expect(ghosts, `A leltárban olyan útvonal szerepel, ami nem létezik: ${ghosts.join(', ')}`).toEqual([])
  })

  test('every NOT_INDEXED reason names a route that actually exists', () => {
    const real = new Set(routerRoutes().map((r) => r.route))
    const stale = Object.keys(NOT_INDEXED).filter((route) => !real.has(route))
    expect(stale, `NOT_INDEXED elavult sorai: ${stale.join(', ')}`).toEqual([])
  })

  test('no route is listed twice, and every entry carries a name and a hint', () => {
    const routes = PAGE_INDEX.map((p) => p.route)
    expect(new Set(routes).size).toBe(routes.length)
    for (const page of PAGE_INDEX) {
      expect(page.label.trim(), `üres név: ${page.route}`).not.toBe('')
      expect(page.hint.trim(), `üres magyarázat: ${page.route}`).not.toBe('')
    }
  })
})
