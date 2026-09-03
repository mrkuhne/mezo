// ============================================================
// Mezo · teszt-helper a kalauz seen-store-hoz (mezo-gb1s.3).
// Minden T1/T2 kalauz 600 ms után magától felugrik (TutorialProvider AUTO_DELAY_MS),
// tehát BÁRMELY teszt, ami kalauzos route-ot rendel AppLayouttal, sheetet kapna a
// képernyőre az asszertjei közben. A seed a KALAUZ_REGISTRY-ből GENERÁL — nem
// duplikálja a tartalmat, így egy új kalauz hozzáadása nem söpri végig a teszteket
// — plusz a registryn kívül élő T0 welcome, explicit sorral.
// A dedikált TutorialProvider.test.tsx SZÁNDÉKOSAN nem ezt használja: az a valódi
// auto-open utat gyakorolja.
// ============================================================
import type { TutorialProgress } from '@/data/types'
import { KALAUZ_REGISTRY } from '@/features/tutorial/registry'
import { WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
import { writeLocalProgress } from '@/shared/lib/tutorialSeen'

/** Determinisztikus időbélyeg — a goldenek és a merge-szabály miatt sose `Date.now()`. */
const SEEN_AT = '2026-08-30T10:00:00.000Z'

/** Minden ismert kalauz „látva, végigolvasva" állapotban. Tiszta adat, nem ír sehova. */
export function buildAllSeenProgress(): TutorialProgress {
  const out: TutorialProgress = {}
  for (const e of KALAUZ_REGISTRY) {
    out[e.id] = { version: e.version, seenAt: SEEN_AT, completedAt: SEEN_AT, dismissedAtStep: null }
  }
  // A T0 welcome szándékosan nincs a KALAUZ_REGISTRY-ben (registry/welcome.ts), tehát a fenti
  // ciklus nem fedi — enélkül MINDEN /nap-ot rendelő shell-teszt welcome-képernyőt kapna.
  out[WELCOME_ID] = { version: WELCOME_VERSION, seenAt: SEEN_AT, completedAt: SEEN_AT, dismissedAtStep: null }
  return out
}

/** Vitest-oldali kényelem: a fenti mapet a localStorage-tükörbe írja. */
export function seedAllKalauzSeen(): void {
  writeLocalProgress(buildAllSeenProgress())
}
