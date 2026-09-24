import { ClayIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import type { MetricDomain } from '@/data/types'

export const PATTERN_DOMAIN_ICONS: Record<MetricDomain, ClayIconName> = {
  sleep: 'i-alvas',
  train: 'i-edzes',
  fuel: 'i-fuel',
  mind: 'i-checkin',
  body: 'i-suly',
  other: 'i-minta',
}

/** A domén 3D jele a „Miből látszik?" mélyoldalakon (üveg, mezo-me75u.13 — a prototípus
 *  `DOMI` térképe: uveg-uzenofal.html). A lista és a szűrő-lap a clay jelet tartja (U8b). */
export const PATTERN_DOMAIN_ART: Record<MetricDomain, Icon3DName> = {
  sleep: 't-moon',
  train: 't-dumbbell',
  fuel: 't-plate',
  mind: 't-journal',
  body: 't-person',
  other: 't-heart',
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
      <ClayIcon name={PATTERN_DOMAIN_ICONS[domain]} size={size} />
      {showLabel && <span>{DOMAIN_META[domain].label}</span>}
    </span>
  )
}
