import { user } from '@/data/today/today'

/**
 * DECIDED (Slice E, mezo-t16y.2): `user` stays a static const — recorded, not wired.
 * No real-mode surface renders the identity statics (name/handle/age/memberDays/streakDays):
 * Today overrides only the meso-derived fields from useTrain() (Slice T), FuelStackPage reads
 * seed consts by decision mezo-4nu, and ProfilePage dropped the identity hero in mezo-lfw.
 * The legacy `user_profiles` table also lacks `name`. Revisit when a Profile identity surface
 * returns — see docs/features/me.md §9.
 */
export function useProfile() {
  return { user }
}
