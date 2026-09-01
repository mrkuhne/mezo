import type { KnowledgeFact, FactCandidate, KnowledgeEdge, FactCategory } from '@/data/types'

/**
 * Hány bekapcsolt tény fér be ténylegesen a system promptba — a backend
 * `mezo.companion.facts.top-n` (application.yml) kézzel szinkronban tartott tükre.
 * A rangsor kulcsa ugyanaz, mint a `KnowledgeFactService.renderPromptBlock()`-é:
 * reinforced DESC, createdAt DESC.
 */
export const PROMPT_TOP_N = 10

/**
 * A backend `mezo.companion.facts.pattern-ack-days` (application.yml) kézzel szinkronban
 * tartott tükre — ennyi napig marad "friss" egy minta-tény. `KnowledgeFactService
 * .renderNewPatternFactsBlock()` a top-N-től FÜGGETLENÜL beleteszi a promptba minden
 * `source: 'pattern'`, bekapcsolt tényt, ami ezen az ablakon belül jött létre — a
 * `bucketFacts()` ezt a második injektálási csatornát tükrözi (factCopy.ts).
 */
export const PATTERN_ACK_DAYS = 3

// Mock seed — categories carry the V1.2 backend taxonomy (train | fuel | health | life).
export const facts: KnowledgeFact[] = [
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'train', active: true, reinforced: 12, source: 'chat', lastReinforcedAt: '2026-08-05T19:20:00Z', createdAt: '2026-03-02T09:00:00Z' },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'fuel', active: true, reinforced: 23, source: 'chat', lastReinforcedAt: '2026-08-11T21:05:00Z', createdAt: '2026-02-14T08:30:00Z' },
  { id: 'f3', text: 'Gyógyszer-beadás: hétfő reggel · 7-day kinetic cycle', category: 'health', active: true, reinforced: 11, source: 'chat', lastReinforcedAt: '2026-08-04T08:10:00Z', createdAt: '2026-04-20T07:15:00Z' },
  { id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true, reinforced: 18, source: 'chat', lastReinforcedAt: '2026-08-09T18:00:00Z', createdAt: '2026-02-28T17:40:00Z' },
  { id: 'f5', text: 'Sleep target: 7.5h, evening kitchen close 21:30', category: 'health', active: true, reinforced: 21, source: 'chat', lastReinforcedAt: '2026-08-10T20:40:00Z', createdAt: '2026-03-11T21:10:00Z' },
  { id: 'f6', text: 'Right shoulder niggle, márc 18 óta intermittent', category: 'health', active: true, reinforced: 9, source: 'chat', lastReinforcedAt: '2026-07-22T09:15:00Z', createdAt: '2026-03-18T09:20:00Z' },
  { id: 'f7', text: 'Identity goal: peak performance every life domain', category: 'life', active: true, reinforced: 7, source: 'manual', lastReinforcedAt: null, createdAt: '2026-01-30T12:00:00Z' },
  { id: 'f8', text: 'Carb timing > 20:00 → sleep quality drop', category: 'fuel', active: true, reinforced: 8, source: 'pattern', lastReinforcedAt: '2026-08-02T07:30:00Z', createdAt: '2026-05-06T06:45:00Z', patternTitle: 'Késői étkezés ↔ rákövetkező alvásminőség' },
  { id: 'f9', text: 'kifli.hu primary food source', category: 'fuel', active: false, reinforced: 14, source: 'chat', lastReinforcedAt: '2026-07-18T10:05:00Z', createdAt: '2026-02-02T11:00:00Z' },
  { id: 'f10', text: 'MyProtein supplement supplier', category: 'fuel', active: true, reinforced: 11, source: 'chat', lastReinforcedAt: '2026-07-25T11:40:00Z', createdAt: '2026-02-09T11:30:00Z' },
  { id: 'f11', text: 'Niggle-aware exercise substitution preferred', category: 'train', active: true, reinforced: 6, source: 'chat', lastReinforcedAt: '2026-07-29T17:20:00Z', createdAt: '2026-04-02T16:00:00Z' },
  { id: 'f12', text: 'PR celebration moments are emotionally meaningful', category: 'life', active: true, reinforced: 5, source: 'chat', lastReinforcedAt: null, createdAt: '2026-05-19T19:30:00Z' },
  { id: 'f13', text: 'Pre-workout fueling: 2-3h előtte protein+carb', category: 'fuel', active: true, reinforced: 13, source: 'chat', lastReinforcedAt: '2026-07-30T14:10:00Z', createdAt: '2026-03-05T14:20:00Z' },
  { id: 'f14', text: "Mentor relational frame ('Mizu Velünk')", category: 'life', active: true, reinforced: 4, source: 'manual', lastReinforcedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'f15', text: 'System-elegance > rewards (rendszer-szerelem)', category: 'life', active: true, reinforced: 6, source: 'chat', lastReinforcedAt: null, createdAt: '2026-01-22T18:50:00Z' },
]

/** V1.2 mock candidates — the pending L2 confirm inbox of the demo. `c3` (mezo-ms9a) carries a
 *  `conflictsWithFactId` against `f4`'s established Tue/Thu/Sat schedule — the demo's one
 *  contradiction, showing what the L2 inbox looks like when a new candidate disagrees with
 *  something already learned. */
export const candidateSeed: FactCandidate[] = [
  { id: 'c1', text: 'Edzés előtt 2-3 órával eszik a legszívesebben', category: 'fuel', conflictsWithFactId: null },
  { id: 'c2', text: 'Vasárnap esténként rendszeresen rövidebb az alvás', category: 'health', conflictsWithFactId: null },
  { id: 'c3', text: 'Esti edzésre váltottál — 18:00 után jársz.', category: 'train', conflictsWithFactId: 'f4' },
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
