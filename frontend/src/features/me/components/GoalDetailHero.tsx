import type { ReactNode } from 'react'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'

export type GoalDetailHeroTone = 'nutrition' | 'segment' | 'plans' | 'guards' | 'settings'

interface GoalDetailStat {
  label: string
  value: ReactNode
}

export function GoalDetailHero({ tone, icon, name, eyebrow, big, description, stats }: {
  tone: GoalDetailHeroTone
  icon: ClayIconName
  name: string
  eyebrow: string
  big: ReactNode
  description: string
  stats: [GoalDetailStat, GoalDetailStat, GoalDetailStat]
}) {
  return (
    <section className={`goal-detail-hero goal-detail-hero-${tone} rise`} role="region" aria-label={`${name} áttekintése`}>
      <div className="goal-detail-hero-copy">
        <span>{eyebrow}</span>
        <strong>{big}</strong>
        <p>{description}</p>
      </div>
      <span className={`goal-detail-emblem goal-detail-emblem-${tone}`} aria-hidden="true">
        <ClayIcon name={icon} size={50} />
      </span>
      <div className="goal-detail-pods">
        {stats.map(stat => <span className="goal-detail-pod" key={stat.label}>
          <small>{stat.label}</small>
          <strong>{stat.value}</strong>
        </span>)}
      </div>
    </section>
  )
}
