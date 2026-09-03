import type { LifeGoalPillarInput, PillarKind, PillarRule, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'

// Kind preference for a catalog pick (mezo-iizd.1 final review, item 5). `e.kinds[0]` picked
// whatever the catalog happened to list first — for the 13 of 28 entries whose first kind is
// `habit` (and every `target`/`linked` one) the caller then built NO rule, so the saved pillar
// carried `rule: {}` and PillarCard printed a literal `?`; such a pillar is also unscorable by
// slice 2. The order below prefers the kinds this slice can actually parameterise.
const KIND_PREFERENCE: PillarKind[] = ['average', 'baseline', 'habit', 'target', 'linked']

/** The kind a catalog pick should default to: the most-preferred kind the entry allows. */
export function preferredKind(entry: SignalCatalogEntry): PillarKind {
  return KIND_PREFERENCE.find((k) => entry.kinds.includes(k)) ?? entry.kinds[0]
}

/** The default rule for a kind — every kind this slice can parameterise gets real numbers,
 *  so no pillar added from the catalog sheet can reach a card with an empty rule. */
export function defaultRule(kind: PillarKind): PillarRule {
  switch (kind) {
    case 'average': return { windowDays: 7, comparator: 'gte' }
    case 'baseline': return { windowDays: 28, minDataDays: 14 }
    case 'habit': return { comparator: 'gte', threshold: 1, daysPerWeek: 5 }
    default: return {}
  }
}

/** One catalog entry → the pillar input both the Cél-oldal `＋ Pillér` sheet and the wizard's
 *  catalog sheet send, so the two call sites cannot drift apart. */
export function pillarFromCatalog(entry: SignalCatalogEntry): LifeGoalPillarInput {
  const kind = preferredKind(entry)
  return {
    label: entry.label,
    skillKey: entry.defaultSkillKey ?? 'mindset',
    kind,
    weight: 1,
    active: true,
    source: entry.source,
    rule: defaultRule(kind),
  }
}
