import { user } from '@/data/today/today'

/**
 * DECIDED (Slice E, mezo-t16y.2; REVISITED Napiv S7, mezo-8141): `user` stays a static
 * const — the single-user identity source, recorded not wired to any backend profile.
 * Today overrides only the meso-derived fields from useTrain() (Slice T), FuelStackPage
 * reads seed consts by decision mezo-4nu, and ProfilePage dropped the identity hero in
 * mezo-lfw. **Sanctioned exception (S7):** `MeHead` renders `user.name` in BOTH modes on
 * every Me page — the one real-mode surface that does render the identity statics; the
 * biometrics line beside it (age/height/latest weight/body-fat%) is genuine real-hook data
 * (`useBiometricProfile`/`useWeight`), not part of this static. The legacy `user_profiles`
 * table still lacks `name`. Revisit again when a backend profile identity surface exists —
 * see docs/features/me.md §9.
 */
export function useProfile() {
  return { user }
}
