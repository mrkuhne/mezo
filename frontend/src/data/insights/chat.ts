import type { ChatMessage } from '@/data/types'

/** The Phase-1 demo reply — kept for mock mode; the MSW stream handler reuses it so
 *  both test modes assert the same strings. */
export function cannedReply(text: string): string {
  return (
    'Értem — és köszönöm hogy megosztottad. ' +
    (text.toLowerCase().includes('fáradt')
      ? 'A Reta D3-on ez gyakori; ne erőltessük a Pull Day-t ma. Egy könnyű walk és egy fehérje-snack többet adhat mint egy fél-erővel csinált edzés.'
      : 'Nézzük meg az adatokat: az elmúlt 3 napban a kalória-pacing 80%+ volt, és a Reta D3 ablakban ez stabil — innen indulhatunk.')
  )
}

export const initialChat: ChatMessage[] = [
  {
    role: 'assistant',
    ts: '06:32',
    text: 'Jó reggelt. Tegnap a Push Day jól ment — a Lat Pulldown 105 × 9 @ RIR 1 volt, és ez a sorozat az egyik legtisztább március óta. Ma Pull Day, a Chest Row PR-attempt logikus, ha az első melegítő szet könnyű.',
    tools: [
      { type: 'read', name: 'get_recent_workouts(days=3)' },
      { type: 'compute', name: "recallSharedMemory(theme='pull-day pr')" },
    ],
    refs: [
      { kind: 'Workout', id: 'w-2026-05-21' },
      { kind: 'PR', id: 'pr-2026-03-04' },
    ],
  },
  {
    role: 'user',
    ts: '06:34',
    text: 'Aludtam 7h-t. Érzem hogy ma jobb mint tegnap.',
  },
  {
    role: 'assistant',
    ts: '06:34',
    text: 'Jó jel. 7h a héten az átlag fölött van — vasárnap óta négy nap volt 7+. A Reta D3-ot ne felejtsük: az étvágy ma délután fog leesni, és ha PR-t akarunk, a 13:30 pre-workout meal nem opcionális. Ha 30g whey + banán + földimogyoróvaj akkor is megy, ha nem éhezünk, az ma fontos.',
    tools: [
      { type: 'read', name: 'get_sleep(days=7)' },
      { type: 'read', name: 'get_reta_phase()' },
      { type: 'compute', name: 'predictAppetiteCurve()' },
    ],
    refs: [
      { kind: 'Pattern', id: 'p-reta-appetite' },
      { kind: 'SleepLog', id: 'sleep-2026-05-21' },
    ],
  },
]
