import { isMockMode } from '@/data/_client/mode'
import { useMe } from '@/data/auth/authHooks'
import { user } from '@/data/today/today'

export interface ProfileIdentity { name: string }

/**
 * The signed-in identity for the Én hero (S6, mezo-qw37.6 — closes the me.md §9 "static
 * user" decision). Real mode: GET /api/auth/me via useMe(), `null` until it arrives (ghost-guard,
 * no seed fallback — dual-mode read invariant). Mock mode: the static today.ts seed, which is
 * now the ONLY place that seed's identity fields are read.
 */
export function useProfile(): { user: ProfileIdentity | null } {
  const mock = isMockMode()
  const me = useMe()
  if (mock) return { user: { name: user.name } }
  return { user: me.data ? { name: me.data.name } : null }
}
