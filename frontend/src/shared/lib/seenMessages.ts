// ============================================================
// Mezo · seenMessages — a mezo-üzenetek olvasatlan-állapota (mezo-e26w).
// Kliensoldali, DÁTUMRA KULCSOLT: a kulcs másnap magától elavul, így nincs se
// takarítás, se szerveroldali read-state. Minden hozzáférés defenzív: privát
// módban / kvótatúllépéskor a `localStorage` DOB, és egy olvasatlan-pötty
// sosem érhet meg egy összeomlott képernyőt.
// ============================================================
import { userScopedKey } from '@/shared/lib/userScope'

const keyFor = (date: string) => userScopedKey(`msgseen.${date}`)

/** Az adott napon utoljára LÁTOTT üzenet id-je, vagy `null`. */
export function lastSeenMessage(date: string): string | null {
  try {
    return localStorage.getItem(keyFor(date))
  } catch {
    return null
  }
}

/** A nap üzeneteit látottnak jelöli a szál UTOLSÓ elemének id-jével. */
export function markMessagesSeen(date: string, lastId: string): void {
  try {
    localStorage.setItem(keyFor(date), lastId)
  } catch {
    // privát mód / kvóta — az olvasatlan-pötty megmarad, semmi más nem törik
  }
}
