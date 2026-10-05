import type { KnowledgeFact, FactCandidate, KnowledgeEdge, FactCategory } from '@/data/types'

// Mock seed — categories carry the V1.2 backend taxonomy (train | fuel | health | life).
export const facts: KnowledgeFact[] = [
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'train', active: true, reinforced: 12, source: 'chat', owner: 'mocor', lastReinforcedAt: '2026-08-05T19:20:00Z', createdAt: '2026-03-02T09:00:00Z' },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'fuel', active: true, reinforced: 23, source: 'chat', owner: 'falat', lastReinforcedAt: '2026-08-11T21:05:00Z', createdAt: '2026-02-14T08:30:00Z' },
  { id: 'f3', text: 'Gyógyszer-beadás: hétfő reggel · 7-day kinetic cycle', category: 'health', active: true, reinforced: 11, source: 'chat', owner: 'deru', lastReinforcedAt: '2026-08-04T08:10:00Z', createdAt: '2026-04-20T07:15:00Z' },
  { id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true, reinforced: 18, source: 'chat', owner: 'mocor', lastReinforcedAt: '2026-08-09T18:00:00Z', createdAt: '2026-02-28T17:40:00Z' },
  { id: 'f5', text: 'Sleep target: 7.5h, evening kitchen close 21:30', category: 'health', active: true, reinforced: 21, source: 'chat', owner: 'szunya', lastReinforcedAt: '2026-08-10T20:40:00Z', createdAt: '2026-03-11T21:10:00Z' },
  { id: 'f6', text: 'Right shoulder niggle, márc 18 óta intermittent', category: 'health', active: true, reinforced: 9, source: 'chat', owner: 'deru', lastReinforcedAt: '2026-07-22T09:15:00Z', createdAt: '2026-03-18T09:20:00Z' },
  { id: 'f7', text: 'Identity goal: peak performance every life domain', category: 'life', active: true, reinforced: 7, source: 'manual', owner: 'mezo', lastReinforcedAt: null, createdAt: '2026-01-30T12:00:00Z' },
  { id: 'f8', text: 'Carb timing > 20:00 → sleep quality drop', category: 'fuel', active: true, reinforced: 8, source: 'pattern', owner: 'falat', lastReinforcedAt: '2026-08-02T07:30:00Z', createdAt: '2026-05-06T06:45:00Z', patternTitle: 'Késői étkezés ↔ rákövetkező alvásminőség', patternId: 'o1' },
  // S6 (mezo-d6ivw.6): a demó egyetlen felhasználó-elhallgattatott ténye — a Tudástár hub
  // "Elhallgattatott" állapotát mutatja be (active már korábban is false volt ezen a soron).
  { id: 'f9', text: 'kifli.hu primary food source', category: 'fuel', active: false, reinforced: 14, source: 'chat', owner: 'falat', lastReinforcedAt: '2026-07-18T10:05:00Z', createdAt: '2026-02-02T11:00:00Z', mutedReason: 'user', mutedAt: '2026-09-12T08:00:00Z' },
  { id: 'f10', text: 'MyProtein supplement supplier', category: 'fuel', active: true, reinforced: 11, source: 'chat', owner: 'falat', lastReinforcedAt: '2026-07-25T11:40:00Z', createdAt: '2026-02-09T11:30:00Z' },
  { id: 'f11', text: 'Niggle-aware exercise substitution preferred', category: 'train', active: true, reinforced: 6, source: 'chat', owner: 'mocor', lastReinforcedAt: '2026-07-29T17:20:00Z', createdAt: '2026-04-02T16:00:00Z' },
  { id: 'f12', text: 'PR celebration moments are emotionally meaningful', category: 'life', active: true, reinforced: 5, source: 'chat', owner: 'mezo', lastReinforcedAt: null, createdAt: '2026-05-19T19:30:00Z' },
  { id: 'f13', text: 'Pre-workout fueling: 2-3h előtte protein+carb', category: 'fuel', active: true, reinforced: 13, source: 'chat', owner: 'falat', lastReinforcedAt: '2026-07-30T14:10:00Z', createdAt: '2026-03-05T14:20:00Z' },
  { id: 'f14', text: "Mentor relational frame ('Mizu Velünk')", category: 'life', active: true, reinforced: 4, source: 'manual', owner: 'mezo', lastReinforcedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'f15', text: 'System-elegance > rewards (rendszer-szerelem)', category: 'life', active: true, reinforced: 6, source: 'chat', owner: 'mezo', lastReinforcedAt: null, createdAt: '2026-01-22T18:50:00Z' },
  // S6 (mezo-d6ivw.6) fix round 1 — a `o4` (refuted) észrevétel tanult ténye: a negyedéves
  // recheck cáfolta, ezért `mutedReason: 'refuted'` (nem felhasználói döntés) néma a hub-on.
  { id: 'f16', text: 'Edzés után mindig kevesebb a stresszed', category: 'health', active: false, reinforced: 2, source: 'pattern', owner: 'deru', lastReinforcedAt: null, createdAt: '2026-08-22T06:00:00Z', patternTitle: 'Edzés után mindig kevesebb a stresszed.', patternId: 'o4', mutedReason: 'refuted', mutedAt: '2026-09-16T03:40:00Z' },
  // S9 (mezo-d6ivw.10): a hétfői rendrakás beolvasztotta a f13-mal azonos mondatot — az
  // „Összevontam" fiókot és a „Hétfői rendrakás" sávot mutatja (mutedAt: a múlt napokban, mindig frissen).
  { id: 'f17', text: 'Az edzés előtti étkezés 2-3 órával előtte esik neked a legjobban.', category: 'fuel', active: false, reinforced: 3, source: 'chat', owner: 'falat', lastReinforcedAt: null, createdAt: '2026-06-10T11:00:00Z', mutedReason: 'merged', mutedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), supersededBy: 'f13' },
]

/** V1.2 mock candidates — the pending L2 confirm inbox of the demo. `c3` (mezo-ms9a) carries a
 *  `conflictsWithFactId` against `f4`'s established Tue/Thu/Sat schedule — the demo's one
 *  contradiction, showing what the L2 inbox looks like when a new candidate disagrees with
 *  something already learned. The candidate text names the SAME schedule axis f4 does (weekly
 *  volleyball cadence), just a different value — that's what makes it a genuine contradiction
 *  rather than two unrelated facts. */
export const candidateSeed: FactCandidate[] = [
  {
    id: 'c1', text: 'Edzés előtt 2-3 órával eszik a legszívesebben', category: 'fuel',
    owner: 'falat', source: 'chat', createdAt: '2026-08-24T07:00:00Z', evidence: null, weekStart: null,
    conflictsWithFactId: null,
  },
  {
    id: 'c2', text: 'Vasárnap esténként rendszeresen rövidebb az alvás', category: 'health',
    owner: 'szunya', source: 'chat', createdAt: '2026-08-23T07:00:00Z', evidence: null, weekStart: null,
    conflictsWithFactId: null,
  },
  {
    id: 'c3', text: 'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.', category: 'train',
    owner: 'mocor', source: 'chat', createdAt: '2026-08-22T07:00:00Z', evidence: null, weekStart: null,
    conflictsWithFactId: 'f4',
  },
  // S9 (mezo-d6ivw.10): the demo's one weekly merge proposal — two sentences about the same thing.
  {
    id: 'c4', text: 'Késő esti evés után nálad gyakran nehezebb az elalvás.', category: 'fuel',
    owner: 'mezo', source: 'merge', createdAt: '2026-08-21T07:00:00Z', evidence: null, weekStart: null,
    conflictsWithFactId: null,
    mergeSources: ['Késő esti evés után nehezebben alszol el.', 'Ha 21 óra után vacsorázol, rosszabbul alszol.'],
  },
]

export const edges: KnowledgeEdge[] = [
  { from: 'f3', to: 'f8', type: 'reinforces' },
  { from: 'f3', to: 'f1', type: 'context' },
  { from: 'f8', to: 'f5', type: 'causes' },
  { from: 'f5', to: 'f2', type: 'context' },
  { from: 'f4', to: 'f6', type: 'context' },
  { from: 'f1', to: 'f6', type: 'context' },
  { from: 'f6', to: 'f11', type: 'causes' },
  { from: 'f13', to: 'f1', type: 'context' },
  { from: 'f7', to: 'f15', type: 'reinforces' },
  { from: 'f7', to: 'f14', type: 'context' },
  { from: 'f12', to: 'f7', type: 'reinforces' },
  { from: 'f10', to: 'f13', type: 'context' },
  { from: 'f9', to: 'f13', type: 'context' },
]

// Ordered category list (id → Hungarian label) — mirrors the backend enum + the
// KnowledgeFactService prompt-block labels.
export const FACT_CATEGORIES: Array<[FactCategory, string]> = [
  ['train', 'Edzés'],
  ['fuel', 'Étkezés'],
  ['health', 'Egészség'],
  ['life', 'Élet'],
]

export function factCategoryLabel(cat: FactCategory): string {
  return FACT_CATEGORIES.find(([c]) => c === cat)?.[1] ?? cat
}

// The 4 backend categories reuse the prototype's --cat-* palette (no CSS change).
export function factCategoryColor(cat: FactCategory): string {
  switch (cat) {
    case 'train': return 'var(--cat-physiology)'
    case 'fuel': return 'var(--cat-trigger)'
    case 'health': return 'var(--cat-goal-state)'
    case 'life': return 'var(--cat-preference)'
  }
}
