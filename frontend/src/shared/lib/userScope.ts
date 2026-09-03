// ============================================================
// Mezo · userScope — per-user névtér a böngésző-tárolóhoz (mezo-qw37.6, S6).
// Egy böngészőben több fiók is beléphet egymás után; a localStorage/sessionStorage
// kulcsok ezért `mezo.<userId>.<alap>` alakúak. Egyetlen író van: az AuthGate (mint a
// tokenStore-nál) — a logic-rétegbeli tiszta függvények innen olvasnak, React nélkül.
// A téma (`mezo-theme`) SZÁNDÉKOSAN eszköz-szintű marad, nem megy ezen át.
// ============================================================
let userId: string | null = null

export function setCurrentUserId(id: string | null): void {
  userId = id
}

export function currentUserId(): string | null {
  return userId
}

/** `mezo.<userId>.` — a kulcs-előtag; kulcsokat végigpásztázó törléshez (nightTrace prune). */
export function userScopedPrefix(): string {
  return `mezo.${userId ?? 'anon'}.`
}

/** `mezo.<userId>.<base>` — MINDEN per-user tároló-kulcs ezen keresztül készül. */
export function userScopedKey(base: string): string {
  return userScopedPrefix() + base
}
