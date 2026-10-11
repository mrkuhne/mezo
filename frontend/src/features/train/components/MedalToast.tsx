// ============================================================
// Mezo · MedalToast — the record celebration of the active workout (mezo-wp6n; Folyadék look: mezo-n4wf5.4).
// Fires only for a RECORD-tier medal (TARGET_HIT stays quiet), in the rest window right after the achieving set, and
// carries real values throughout. The look is the shared `RecordToast` (prototype `mtoast`); this file is the medal →
// copy mapping. Mount it as the FIRST child of the page: it is sticky and takes no room.
// ============================================================
import { huMonthDay } from '@/shared/lib/dates'
import type { Medal } from '@/data/train/medalTypes'
import { formatMedalNumber as fmt, medalValueLabel } from '@/features/train/logic/medalLabels'
import { RecordToast } from '@/features/train/components/folyadek'

// The eyebrow's own short forms — deliberately NOT the shared MEDAL_TYPE_LABEL copy („Súly-rekord" et al.), which
// reads as a row label.
const TYPE_LABEL: Record<string, string> = {
  WEIGHT: 'súly',
  REPS_AT_WEIGHT: 'ismétlés',
  E1RM: '1RM',
  SESSION_VOLUME: 'volumen',
}
const UNIT: Record<string, string> = { KG: 'kg', REPS: 'ism.' }

export function MedalToast({ medal, extraCount = 0 }: { medal: Medal; extraCount?: number }) {
  // The achieving set (weightKg × reps) covers WEIGHT / REPS_AT_WEIGHT; a derived record (1RM, volume) shows its value.
  const note = medal.previousValue != null
    ? `Eddigi legjobbad ${fmt(medal.previousValue)} ${UNIT[medal.unit] ?? ''} volt`
      + (medal.previousDate ? ` — ${huMonthDay(medal.previousDate)} óta állt.` : '.')
      + (extraCount > 0 ? ` +${extraCount} további medál` : '')
    : undefined
  return <RecordToast eyebrow={`Új rekord · ${TYPE_LABEL[medal.type] ?? medal.type}`} value={medalValueLabel(medal)} note={note} />
}
