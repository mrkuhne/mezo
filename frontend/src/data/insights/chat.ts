import type { ChatMessage } from '@/data/types'

/** The Phase-1 demo reply — kept for mock mode; the MSW stream handler reuses it so
 *  both test modes assert the same strings. */
export function cannedReply(text: string): string {
  return (
    'Értem — és köszönöm hogy megosztottad. ' +
    (text.toLowerCase().includes('fáradt')
      ? 'A gyógyszer-ciklus D3-án ez gyakori; ne erőltessük a Pull Day-t ma. Egy könnyű walk és egy fehérje-snack többet adhat mint egy fél-erővel csinált edzés.'
      : 'Nézzük meg az adatokat: az elmúlt 3 napban a kalória-pacing 80%+ volt, és a gyógyszer-ciklus D3 ablakban ez stabil — innen indulhatunk.')
  )
}

/** The demo answers carry stable ids so the 👍/👎 chips are votable in mock mode too — the
 *  demo surface must show the same affordance the live one does (mezo-b3pp.15). The user
 *  bubble deliberately has none: only assistant answers are votable artifacts. */
export const initialChat: ChatMessage[] = [
  {
    id: 'c1a70000-0000-4000-8000-000000000001',
    role: 'assistant',
    ts: '06:32',
    text: 'Jó reggelt. Tegnap a Push Day jól ment — a Lat Pulldown 105 × 9 @ RIR 1 volt, és ez a sorozat az egyik legtisztább március óta. Ma Pull Day, a Chest Row PR-attempt logikus, ha az első melegítő szet könnyű.',
    tools: [
      { type: 'read', name: 'get_training_log(days=3)' },
      { type: 'compute', name: "find_similar_past_days(theme='pull-day pr')" },
    ],
    refs: [
      { kind: 'Workout', id: 'w-2026-05-21' },
      { kind: 'PR', id: 'pr-2026-03-04' },
    ],
    // W3.1b (mezo-b3pp.28): the ambient-recall block behind this answer — the demo surface
    // shows the same provenance the live one does.
    recalled: [
      { occurredOn: '2026-05-18', kind: 'journal_entry', label: 'napló', gist: 'futás után jobban aludtam', similarity: 0.92 },
      { occurredOn: '2026-05-12', kind: 'daily_summary', label: 'napi összefoglaló', gist: 'Kemény Pull Day, este korán ágyba.', similarity: 0.71 },
    ],
  },
  {
    role: 'user',
    ts: '06:34',
    text: 'Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.',
  },
  {
    id: 'c1a70000-0000-4000-8000-000000000003',
    role: 'assistant',
    ts: '06:34',
    text: 'Jó jel. 7h a héten az átlag fölött van — vasárnap óta négy nap volt 7+. A gyógyszer-ciklus D3-át ne felejtsük: az étvágy ma délután fog leesni, és ha PR-t akarunk, a 13:30 pre-workout meal nem opcionális. Ha 30g whey + banán + földimogyoróvaj akkor is megy, ha nem éhezünk, az ma fontos.',
    tools: [
      { type: 'read', name: 'get_recovery(days=7)' },
      { type: 'read', name: 'get_medication()' },
      { type: 'compute', name: 'get_insights()' },
    ],
    refs: [
      { kind: 'Pattern', id: 'p-medication-appetite' },
      { kind: 'SleepLog', id: 'sleep-2026-05-21' },
    ],
  },
]
