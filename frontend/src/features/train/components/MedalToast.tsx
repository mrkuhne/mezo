// ============================================================
// Mezo · MedalToast — replaces PRToast (mezo-wp6n). Fires only for a
// RECORD-tier medal (TARGET_HIT stays quiet, MedalChip.tsx), in the rest
// window right after the achieving set, and carries real values throughout —
// no more scripted 105 kg / baked-in date.
// ============================================================
import { Icon3D } from '@/shared/ui/clay'
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
    // Üvegesítés U4 (mezo-me75u.4): ONE amber glass with the 3D record medal — the old
    // amber-gradient slab + sparkle glyph retired. Skin: `uveg edzes session` block.
    <div className="toast-solo glass wos-medal-toast" role="status">
      <span className="wos-medal-art"><Icon3D name="t-record" size={44} /></span>
      <div className="wos-medal-copy">
        <span className="wos-medal-eb">{eyebrow}</span>
        <strong>{headline}</strong>
        {medal.previousValue != null && (
          <small>
            {`Eddigi legjobbad ${fmt(medal.previousValue)} ${unitLabel} volt`}
            {medal.previousDate ? ` — ${huMonthDay(medal.previousDate)} óta állt.` : '.'}
            {extraCount > 0 && ` +${extraCount} további medál`}
          </small>
        )}
      </div>
    </div>
  )
}
