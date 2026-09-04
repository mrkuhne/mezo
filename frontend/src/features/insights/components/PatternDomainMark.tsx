import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
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
