import type { KnowledgeFact, FactCandidate, KnowledgeEdge, FactCategory } from '@/data/types'

// Mock seed — categories carry the V1.2 backend taxonomy (train | fuel | health | life).
export const facts: KnowledgeFact[] = [
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'train', active: true, reinforced: 12 },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'fuel', active: true, reinforced: 23 },
  { id: 'f3', text: 'Reta beadás: hétfő reggel · 7-day kinetic cycle', category: 'health', active: true, reinforced: 11 },
  { id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true, reinforced: 18 },
  { id: 'f5', text: 'Sleep target: 7.5h, evening kitchen close 21:30', category: 'health', active: true, reinforced: 21 },
  { id: 'f6', text: 'Right shoulder niggle, márc 18 óta intermittent', category: 'health', active: true, reinforced: 9 },
  { id: 'f7', text: 'Identity goal: peak performance every life domain', category: 'life', active: true, reinforced: 7 },
  { id: 'f8', text: 'Carb timing > 20:00 → sleep quality drop', category: 'fuel', active: true, reinforced: 8 },
  { id: 'f9', text: 'kifli.hu primary food source', category: 'fuel', active: false, reinforced: 14 },
  { id: 'f10', text: 'MyProtein supplement supplier', category: 'fuel', active: true, reinforced: 11 },
  { id: 'f11', text: 'Niggle-aware exercise substitution preferred', category: 'train', active: true, reinforced: 6 },
  { id: 'f12', text: 'PR celebration moments are emotionally meaningful', category: 'life', active: true, reinforced: 5 },
  { id: 'f13', text: 'Pre-workout fueling: 2-3h előtte protein+carb', category: 'fuel', active: true, reinforced: 13 },
  { id: 'f14', text: "Mentor relational frame ('Mizu Velünk')", category: 'life', active: true, reinforced: 4 },
  { id: 'f15', text: 'System-elegance > rewards (rendszer-szerelem)', category: 'life', active: true, reinforced: 6 },
]

/** V1.2 mock candidates — the pending L2 confirm inbox of the demo. */
export const candidateSeed: FactCandidate[] = [
  { id: 'c1', text: 'Edzés előtt 2-3 órával eszik a legszívesebben', category: 'fuel' },
  { id: 'c2', text: 'Vasárnap esténként rendszeresen rövidebb az alvás', category: 'health' },
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
