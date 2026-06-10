import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Chip } from '@/components/ui/Chip'
import type { TodayMeta, UserMeta } from '@/data/types'

export function DateMesoHeader({ today, user }: { today: TodayMeta; user: UserMeta }) {
  return (
    <div style={{ padding: '16px 24px 6px' }}>
      <Eyebrow brand>{today.dayLabel} · {today.dateLabel}</Eyebrow>
      <PageTitle style={{ marginTop: 6 }}>
        Ma · <span style={{ color: 'var(--brand-glow)' }}>{today.workoutType}</span>
      </PageTitle>
      <div className="row gap-sm mt-sm flex-wrap">
        <Chip variant="brand">Week {user.weekInMeso} · Day {user.dayInWeek}</Chip>
        <Chip>{today.mesoPhase}</Chip>
        <Chip>{user.mesoLabel}</Chip>
      </div>
    </div>
  )
}
