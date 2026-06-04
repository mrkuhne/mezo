import type { KnowledgeFact, KnowledgeEdge, FactCategory } from './types'

export const facts: KnowledgeFact[] = [
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'tendency', active: true, reinforced: 12 },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'preference', active: true, reinforced: 23 },
  { id: 'f3', text: 'Reta beadás: hétfő reggel · 7-day kinetic cycle', category: 'physiology', active: true, reinforced: 11 },
  { id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'preference', active: true, reinforced: 18 },
  { id: 'f5', text: 'Sleep target: 7.5h, evening kitchen close 21:30', category: 'preference', active: true, reinforced: 21 },
  { id: 'f6', text: 'Right shoulder niggle, márc 18 óta intermittent', category: 'physiology', active: true, reinforced: 9 },
  { id: 'f7', text: 'Identity goal: peak performance every life domain', category: 'goal_state', active: true, reinforced: 7 },
  { id: 'f8', text: 'Carb timing > 20:00 → sleep quality drop', category: 'trigger', active: true, reinforced: 8 },
  { id: 'f9', text: 'kifli.hu primary food source', category: 'preference', active: false, reinforced: 14 },
  { id: 'f10', text: 'MyProtein supplement supplier', category: 'preference', active: true, reinforced: 11 },
  { id: 'f11', text: 'Niggle-aware exercise substitution preferred', category: 'tendency', active: true, reinforced: 6 },
  { id: 'f12', text: 'PR celebration moments are emotionally meaningful', category: 'tendency', active: true, reinforced: 5 },
  { id: 'f13', text: 'Pre-workout fueling: 2-3h előtte protein+carb', category: 'preference', active: true, reinforced: 13 },
  { id: 'f14', text: "Mentor relational frame ('Mizu Velünk')", category: 'goal_state', active: true, reinforced: 4 },
  { id: 'f15', text: 'System-elegance > rewards (rendszer-szerelem)', category: 'tendency', active: true, reinforced: 6 },
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

// Ordered category list as the prototype iterates it (id → Hungarian label):
export const FACT_CATEGORIES: Array<[FactCategory, string]> = [
  ['physiology', 'Fiziológia'],
  ['preference', 'Preferencia'],
  ['trigger', 'Trigger'],
  ['tendency', 'Tendencia'],
  ['goal_state', 'Goal state'],
]

export function factCategoryColor(cat: FactCategory): string {
  switch (cat) {
    case 'physiology': return 'var(--cat-physiology)'
    case 'preference': return 'var(--cat-preference)'
    case 'trigger': return 'var(--cat-trigger)'
    case 'tendency': return 'var(--cat-tendency)'
    case 'goal_state': return 'var(--cat-goal-state)'
  }
}
