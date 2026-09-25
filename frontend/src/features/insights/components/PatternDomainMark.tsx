import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import type { MetricDomain } from '@/data/types'

/** A domén 3D jele a „Miből látszik?" mélyoldalakon (üveg, mezo-me75u.13 — a prototípus
 *  `DOMI` térképe: uveg-uzenofal.html). A TestPlanTiles és a PatternDetailHero ezt használja. */
export const PATTERN_DOMAIN_ART: Record<MetricDomain, Icon3DName> = {
  sleep: 't-moon',
  train: 't-dumbbell',
  fuel: 't-plate',
  mind: 't-journal',
  body: 't-person',
  other: 't-heart',
}

/** A lista, a döntés-kártya és a szűrő-lap domén-jele (üveg, mezo-me75u.9 — a teljes-Mezo
 *  prototípus minta-csempéi): ugyanaz a 3D készlet, csak az „egyéb" a minta-jelet viseli. */
export const PATTERN_DOMAIN_MARK_ART: Record<MetricDomain, Icon3DName> = {
  ...PATTERN_DOMAIN_ART,
  other: 't-pattern',
}

export function PatternDomainMark({
  domain,
  size = 18,
  showLabel = true,
}: {
  domain: MetricDomain
  size?: number
  showLabel?: boolean
}) {
  return (
    <span className="mnt-domain-mark" data-pattern-domain={domain}>
      <Icon3D name={PATTERN_DOMAIN_MARK_ART[domain]} size={size} />
      {showLabel && <span>{DOMAIN_META[domain].label}</span>}
    </span>
  )
}
