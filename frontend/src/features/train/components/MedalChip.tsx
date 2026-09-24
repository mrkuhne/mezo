// ============================================================
// Mezo · MedalChip — the set-row medal mark (mezo-wp6n). RECORD tier gets the clay
// medal; TARGET tier renders nothing — a TARGET_HIT is carried by the row's own
// done-tick turning sage instead (the double-tick fix, see ActiveWorkoutPage.tsx's
// prescribed-set rows).
//
// Visszaöltöztetés (mezo-ju4j6.11): a jel eddig egy 18px-es sárga KORONG volt, benne egy
// 14px-es érme-ikon — a korong a saját ikonját nyomta el, és a cellában alig látszott. Most
// maga az agyag érem áll ott, 24px-en, korong nélkül (owner 2026-09-19: „a medalnak is új
// ikon, és lehetnek picit nagyobbak").
// Üvegesítés U4 (mezo-me75u.4): the medal is the Titanium 3D record symbol now — `i-erem` maps to
// `t-record` through CLAY_TO_3D, so the chip goes through ContentIcon and says the meaning once.
// ============================================================
import type { Medal } from '@/data/train/medalTypes'
import { ContentIcon } from '@/shared/ui/clay'
import { MEDAL_TYPE_LABEL } from '@/features/train/logic/medalLabels'

export function MedalChip({ medal }: { medal: Medal }) {
  if (medal.tier !== 'RECORD') return null
  const label = MEDAL_TYPE_LABEL[medal.type] ?? 'Rekord'
  return (
    <span className="wo-verdict-mark" role="img" aria-label={label}>
      <ContentIcon name="i-erem" size={24} />
    </span>
  )
}
