// ============================================================
// Mezo · MedalToast — replaces PRToast (mezo-wp6n). Fires only for a
// RECORD-tier medal (TARGET_HIT stays quiet, MedalChip.tsx), in the rest
// window right after the achieving set, and carries real values throughout —
// no more scripted 105 kg / baked-in date.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import { huMonthDay } from '@/shared/lib/dates'
import type { Medal } from '@/data/train/medalTypes'
import { MEDAL_UNIT_LABEL, formatMedalNumber as fmt, medalValueLabel } from '@/features/train/logic/medalLabels'

// The toast eyebrow's own uppercase short forms — deliberately NOT the shared
// MEDAL_TYPE_LABEL copy ("Súly-rekord" et al.), which reads as a row label.
const TYPE_LABEL: Record<string, string> = {
  WEIGHT: 'SÚLY',
  REPS_AT_WEIGHT: 'REP',
  E1RM: '1RM',
  SESSION_VOLUME: 'VOLUMEN',
}

export function MedalToast({ medal, extraCount = 0 }: { medal: Medal; extraCount?: number }) {
  const eyebrow = `ÚJ REKORD · ${TYPE_LABEL[medal.type] ?? medal.type}`
  // The achieving set (weightKg × reps) covers WEIGHT/E1RM/REPS_AT_WEIGHT; a medal
  // without a set attached (SESSION_VOLUME never toasts today, but the fallback
  // keeps this component honest if that ever changes) shows its raw value instead.
  const headline = medalValueLabel(medal)
  const unitLabel = MEDAL_UNIT_LABEL[medal.unit] ?? ''

  return (
    <div
      className="toast-solo rad-20"
      role="status"
      style={{
        background: 'linear-gradient(135deg, var(--amber), var(--amber-deep))',
        boxShadow: '0 12px 40px color-mix(in srgb, var(--amber-deep) 35%, transparent)',
      }}
    >
      <div className="row gap-md" style={{ alignItems: 'center' }}>
        <Icon name="sparkle" size={28} color="var(--text-primary)" />
        <div className="col flex-1">
          <span
            className="label-mono"
            style={{ fontSize: 9, color: 'var(--text-primary)', opacity: 0.7 }}
          >
            {eyebrow}
          </span>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 22,
              color: 'var(--text-primary)',
              marginTop: 2,
            }}
          >
            {headline}
          </div>
          {medal.previousValue != null && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                opacity: 0.85,
                marginTop: 4,
                lineHeight: 1.4,
                display: 'block',
              }}
            >
              {`Eddigi legjobbad ${fmt(medal.previousValue)} ${unitLabel} volt`}
              {medal.previousDate ? ` — ${huMonthDay(medal.previousDate)} óta állt.` : '.'}
              {extraCount > 0 && ` +${extraCount} további medál`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
