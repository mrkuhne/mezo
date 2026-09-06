import type { LifeGoalPillarInput, PillarKind, PillarRule, PillarSource, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'

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
 *  so no pillar added from the catalog sheet can reach a card with an empty rule.
 *
 *  `average` (like `habit` below) has no per-signal numeric default to draw on: the catalog
 *  entry (`SignalCatalogEntry`) carries no threshold/target field, only label/group/unit, and
 *  the ＋Pillér flow saves the pillar immediately on catalog pick with no rule-editing step in
 *  between (see `CelPage.addPillar` / `CelWizardPage`) — so leaving `threshold` unset is not an
 *  option (the backend now 400s a rule missing it, per LifeGoalPillarService.requireRuleShape,
 *  and before that fix it 500'd the scorer). `threshold: 1` is the same honest-placeholder
 *  compromise `habit` already ships (a fixed, unit-agnostic number the user is expected to
 *  retune) rather than a per-signal-meaningful default, which would need either a catalog-level
 *  default value or a rule-editing UI — neither exists yet. */
export function defaultRule(kind: PillarKind): PillarRule {
  switch (kind) {
    case 'average': return { windowDays: 7, comparator: 'gte', threshold: 1 }
    case 'baseline': return { windowDays: 28, minDataDays: 14 }
    case 'habit': return { comparator: 'gte', threshold: 1, daysPerWeek: 5 }
    default: return {}
  }
}

/** Exact-match lookup mirroring the backend's `SignalCatalog.sameSource` (type + key/skillKey+
 *  measure/ring) — used by `PillarCard` to recover a pillar's unit for its value row, since
 *  `LifeGoalPillarResponse.source` carries no unit of its own. */
export function findCatalogEntry(entries: SignalCatalogEntry[], source: PillarSource): SignalCatalogEntry | undefined {
  // Twin of data/lifegoal/lifegoalHooks.ts's mockValidatePillars match — layering forbids
  // data/ from importing features/me/, so this five-field match is duplicated rather than shared.
  return entries.find((e) => e.source.type === source.type
    && e.source.key === source.key
    && e.source.skillKey === source.skillKey
    && e.source.measure === source.measure
    && e.source.ring === source.ring)
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
