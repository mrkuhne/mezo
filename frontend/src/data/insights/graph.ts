import type { LifeEventCandidate } from '@/data/types'

/**
 * Mock-mód seed (W2.3): egyetlen, hihető életesemény-jelölt — a demó ugyanazt mutatja, amit egy
 * éles éjszaka hozna, sose többet. A dátum fix, hogy a vizuális goldenek stabilak maradjanak.
 */
export const lifeEventCandidateSeed: LifeEventCandidate[] = [
  {
    id: 'le-1',
    title: 'Új munkahely első hete',
    summary: 'A naplód szerint hétfőn kezdtél az új helyen, és a hét végére kimerültél.',
    occurredOn: '2026-08-21',
    proposedEdgeCount: 1,
  },
]
