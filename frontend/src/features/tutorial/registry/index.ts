import { matchPath } from 'react-router-dom'
import { FUEL_KALAUZ } from '@/features/tutorial/registry/fuel'
import { NAP_KALAUZ } from '@/features/tutorial/registry/nap'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export type { KalauzCard, KalauzEntry, KalauzTier, OrbState } from '@/features/tutorial/registry/types'

/** Every guide the app knows. Order is irrelevant; ids are the seen-store keys. */
export const KALAUZ_REGISTRY: KalauzEntry[] = [...NAP_KALAUZ, ...FUEL_KALAUZ]

export function findKalauz(pathname: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => matchPath({ path: e.route, end: true }, pathname) !== null) ?? null
}

export function getKalauz(id: string): KalauzEntry | null {
  return KALAUZ_REGISTRY.find((e) => e.id === id) ?? null
}
