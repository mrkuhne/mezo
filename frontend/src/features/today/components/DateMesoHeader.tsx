import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Chip } from '@/shared/ui/Chip'
import type { TodayMeta, UserMeta } from '@/data/types'

// Real mode fills these fields from live reads and leaves them empty ('' / 0) when the
// source is absent (no active meso, rest day) — every empty field hides its chip/suffix
// instead of rendering a blank (honest-surface rule). Mock data always has all fields.
export function DateMesoHeader({ today, user }: { today: TodayMeta; user: UserMeta }) {
  return (
    <div style={{ padding: '16px 24px 6px' }}>
      <Eyebrow brand>{today.dayLabel} · {today.dateLabel}</Eyebrow>
      <PageTitle style={{ marginTop: 6 }}>
        Ma{today.workoutType ? <> · <span style={{ color: 'var(--brand-glow)' }}>{today.workoutType}</span></> : null}
      </PageTitle>
      <div className="row gap-sm mt-sm flex-wrap">
        {user.weekInMeso > 0 && <Chip variant="brand">Week {user.weekInMeso} · Day {user.dayInWeek}</Chip>}
        {today.mesoPhase && <Chip>{today.mesoPhase}</Chip>}
        {user.mesoLabel && <Chip>{user.mesoLabel}</Chip>}
      </div>
    </div>
  )
}
