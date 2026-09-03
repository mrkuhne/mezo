// ============================================================
// Mezo · nudgeSeen — az "Életjel-ringek" küszöb-nudge-jainak DÁTUMRA KULCSOLT
// megjelenés-naplója (mezo-dhzk). Mirrors `shared/lib/seenMessages.ts`'s idiómáját
// pontosan: a localStorage-kulcs másnap magától elavul, nincs takarítás, nincs
// szerveroldali állapot. Minden hozzáférés defenzív: privát módban / kvótatúllépéskor
// a `localStorage` DOB, és egy nudge halk elmaradása sosem érhet meg egy összeomlott
// képernyőt.
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-5-brief.md
// A Design 2.0 takarítás (mezo-d20.9.1) a TodayPage-dzsel együtt vitte el; a nudge-oknak
// a hűség-audit (mezo-d20.11) adott új kézbesítési utat (NapMezoPage), és a napló ezzel
// a Today feature saját logic-rétegébe költözött — `shared/lib` alatt nem volt más olvasója.
// ============================================================
import type { NeedKey } from '@/features/today/logic/needs'
import { userScopedKey } from '@/shared/lib/userScope'

export interface NudgeSeenEntry {
  key: NeedKey
  at: string
}

const keyFor = (date: string) => userScopedKey(`needsnudge.${date}`)

/** Az adott napon eddig megjelent nudge-ok, ring-kulcs + ISO időbélyeg párokként. */
export function shownNudges(date: string): NudgeSeenEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(date))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as NudgeSeenEntry[]) : []
  } catch {
    return []
  }
}

/** Egy nudge-ot megjelentnek jelöl — append-only ír a nap `localStorage` listájához. */
export function markNudgeShown(date: string, key: NeedKey, at: string): void {
  try {
    const next = [...shownNudges(date), { key, at }]
    localStorage.setItem(keyFor(date), JSON.stringify(next))
  } catch {
    // privát mód / kvóta — a nudge megmarad "friss"-nek a következő rendernél, semmi más nem törik
  }
}
