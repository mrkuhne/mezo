// ============================================================
// Mezo · Észrevételek — Phase-1 seed (Reflexió S5, mezo-eq85.5)
// Source of truth for the copy: docs/design_2.0/prototypes/eszrevetelek.html (#obsScreen).
// Four cards, one per kind: fresh (kérdez) · return (emlékszik) · watching (gyűlik) ·
// confirmed (beépült). The order matches the server's own (fresh → return → watching →
// confirmed) so mock mode renders exactly what real mode does.
// ============================================================
import type { Observation } from '@/data/types'

/**
 * A napi észrevétel-keret, ahogy a felhasználó látja a lábjegyzetben.
 *
 * MIRRORS the backend's `mezo.companion.reflection.notice` config (`max-per-day`,
 * `quiet-from`) — those values are NOT on the wire, so the number and the hour live here as
 * literals. Ha a backend konfigja változik, ezt kézzel kell utána húzni.
 */
export const OBSERVATION_BUDGET = { perDay: 2, quietFrom: '22:00' } as const

export const observations: Observation[] = [
  {
    id: 'obs-fresh-1',
    patternId: 'op-anna-alvas',
    hypothesisKey: 'ref-anna-alvas',
    card: 'fresh',
    occurredAt: '2026-05-22T14:12:00',
    title: 'Anna és az alvásod',
    text: 'Amikor **Anna** szerepel a hála-naplódban, másnap átlag **40 perccel többet** alszol.',
    question: 'Négy ilyen napot látok eddig — ez még kevés ahhoz, hogy biztosat mondjak. **Figyeljem tovább?**',
    evidence: ['4 hála-bejegyzés', '4 éjszaka', '+1 nap eltolás'],
    status: 'proposed',
    evidenceHits: 4,
    evidenceMisses: 0,
    minN: 8,
    belief: 0.38,
    sourceIcon: 'i-naplo',
  },
  {
    id: 'obs-return-1',
    patternId: 'op-nehez-hetfok',
    hypothesisKey: 'ref-nehez-hetfok',
    card: 'return',
    occurredAt: '2026-05-22T09:30:00',
    title: 'A nehéz hétfők',
    text: 'Kedden azt írtad, a hétfők nehezek. Tegnap hétfő volt, és a hangulatod **4 / 5**-re jött ki.',
    question: 'Ez most **ellene szól**. Egy nap még nem dönt — kíváncsi vagyok, te hogy látod.',
    evidence: [],
    status: 'monitoring',
    evidenceHits: 1,
    evidenceMisses: 2,
    minN: 8,
    belief: 0.31,
    sourceIcon: 'i-hold',
  },
  {
    id: 'obs-watching-1',
    patternId: 'op-kesoi-vacsora',
    hypothesisKey: 'pair:dinner_time~sleep_quality',
    card: 'watching',
    occurredAt: '2026-05-22T02:40:00',
    title: 'Késői vacsora → rosszabb alvás',
    // A watching kártyán a szöveg ÜRES — ott a számok beszélnek (wire-szerződés).
    text: '',
    question: 'Eddig **4-szer bejött, 1-szer nem**. Nyolc napnál mondok többet.',
    evidence: [],
    status: 'monitoring',
    evidenceHits: 4,
    evidenceMisses: 1,
    minN: 8,
    belief: 0.57,
    repliedChoice: 'watch',
    sourceIcon: 'i-vacsora',
  },
  {
    id: 'obs-confirmed-1',
    patternId: 'op-edzes-hala',
    hypothesisKey: 'ref-edzes-hala',
    card: 'confirmed',
    occurredAt: '2026-05-22T02:41:00',
    title: 'Edzés után hálásabb vagy',
    text: 'Edzés utáni napokon **kétszer annyi** hála-bejegyzést írsz. Három hete tartja magát.',
    question: 'Beépítettem a tudásba — a reggeli üzenetben és a chatben mostantól számolok vele.',
    evidence: ['21 nap', 'erős kapcsolat', 'te is megerősítetted'],
    status: 'confirmed',
    evidenceHits: 17,
    evidenceMisses: 4,
    minN: 8,
    belief: 0.81,
    repliedChoice: 'watch',
    sourceIcon: 'i-edzes',
  },
]
