import { matchPath } from 'react-router-dom'
import { FUEL_KALAUZ } from '@/features/tutorial/registry/fuel'
import { ME_KALAUZ } from '@/features/tutorial/registry/me'
import { MEZO_KALAUZ } from '@/features/tutorial/registry/mezo'
import { NAP_KALAUZ } from '@/features/tutorial/registry/nap'
import { TRAIN_KALAUZ } from '@/features/tutorial/registry/train'
import type { KalauzEntry } from '@/features/tutorial/registry/types'
import { WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'

export type { KalauzCard, KalauzEntry, KalauzTier, OrbState } from '@/features/tutorial/registry/types'

/** Every guide the app knows. Order is irrelevant; ids are the seen-store keys. */
export const KALAUZ_REGISTRY: KalauzEntry[] = [
  ...NAP_KALAUZ, ...TRAIN_KALAUZ, ...FUEL_KALAUZ, ...MEZO_KALAUZ, ...ME_KALAUZ,
]

export function findKalauz(pathname: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => matchPath({ path: e.route, end: true }, pathname) !== null) ?? null
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
