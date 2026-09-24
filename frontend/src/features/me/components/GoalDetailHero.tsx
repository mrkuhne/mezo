import type { ReactNode } from 'react'
import { ClayIcon, Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'

export type GoalDetailHeroTone = 'nutrition' | 'segment' | 'plans' | 'guards' | 'settings'

interface GoalDetailStat {
  label: string
  value: ReactNode
}

export function GoalDetailHero({ tone, icon, art, name, eyebrow, big, description, stats }: {
  tone: GoalDetailHeroTone
  icon: ClayIconName
  /** Üveg variant (mezo-me75u.6): a frameless halo hero with this Titanium 3D art, tinted by the
   *  tone's accent; the three stats become flat cells under it. Without it the old Mozaik card
   *  renders (the goal settings page, not yet re-dressed). */
  art?: Icon3DName
  name: string
  eyebrow: string
  big: ReactNode
  description: string
  stats: [GoalDetailStat, GoalDetailStat, GoalDetailStat]
}) {
  if (art) {
    return (
      <section className={`goal-dhero goal-dhero-${tone} uv-halo rise`} role="region" aria-label={`${name} áttekintése`}>
        <Icon3D name={art} size={78} className="goal-dhero-art uv-float" />
        <span className="goal-dhero-eb">{eyebrow}</span>
        <strong className="goal-dhero-num">{big}</strong>
        <p className="goal-dhero-desc">{description}</p>
        <div className="goal-dhero-pods">
          {stats.map(stat => <span className="goal-detail-pod" key={stat.label}>
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
          </span>)}
        </div>
      </section>
    )
  }
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
