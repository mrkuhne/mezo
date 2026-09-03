import { matchRoutes } from 'react-router-dom'
import { FUEL_KALAUZ } from '@/features/tutorial/registry/fuel'
import { ME_KALAUZ } from '@/features/tutorial/registry/me'
import { MEZO_KALAUZ } from '@/features/tutorial/registry/mezo'
import { NAP_KALAUZ } from '@/features/tutorial/registry/nap'
import { TRAIN_KALAUZ } from '@/features/tutorial/registry/train'
import type { KalauzEntry } from '@/features/tutorial/registry/types'
import { WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'

export type { KalauzCard, KalauzEntry, KalauzTier, OrbState } from '@/features/tutorial/registry/types'

/** Every guide the app knows. Order is irrelevant (lásd `resolveKalauz`); ids a seen-store kulcsai. */
export const KALAUZ_REGISTRY: KalauzEntry[] = [
  ...NAP_KALAUZ, ...TRAIN_KALAUZ, ...FUEL_KALAUZ, ...MEZO_KALAUZ, ...ME_KALAUZ,
]

/**
 * A pathname-hez tartozó kalauz — a router SAJÁT specifikusság-rangsorával (`matchRoutes`),
 * nem az első találattal. Az átfedés nem tiltható: a T3 detail-route-ok mellett ott ülnek a
 * literál testvéreik (`/me/people/:id` vs `/me/people/heti`, `/me/goals/:id` vs `/me/goals/new`),
 * és egy első-találat-feloldásban a registry tömbsorrendje döntene némán arról, melyik nyer.
 * Így a literál mindig veri a paraméterest — ugyanúgy, ahogy a router választotta az oldalt.
 * A `KALAUZ_REGISTRY` sorrend-függetlenségét és a minta-egyediséget a `registry.test.ts` linteli.
 */
export function resolveKalauz(entries: KalauzEntry[], pathname: string): KalauzEntry | null {
  const matches = matchRoutes(entries.map((e) => ({ path: e.route, id: e.id })), pathname)
  const id = matches?.[matches.length - 1]?.route.id
  return entries.find((e) => e.id === id) ?? null
}

export function findKalauz(pathname: string): KalauzEntry | null {
  return resolveKalauz(KALAUZ_REGISTRY, pathname)
}

export function getKalauz(id: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => e.id === id) ?? null
}

/**
 * Egy kalauz-id verziója — a `findKalauz`/`getKalauz` route-alapú útjától FÜGGETLENÜL.
 * A T0 welcome szándékosan nincs a KALAUZ_REGISTRY-ben (lásd welcome.ts), de a seen-állapota
 * ugyanabban a mapben él, tehát a verzió-összehasonlításnak őt is ismernie kell.
 * `null` = ismeretlen id (a hívó ilyenkor nem tekinti „nem látottnak").
 */
export function versionOf(id: string): number | null {
  if (id === WELCOME_ID) return WELCOME_VERSION
  return getKalauz(id)?.version ?? null
}
