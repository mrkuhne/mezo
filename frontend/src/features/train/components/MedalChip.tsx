// ============================================================
// Mezo · MedalChip — a RECORD medal as a small named mark (mezo-wp6n; Folyadék look: mezo-n4wf5.4). TARGET tier renders
// nothing: a hit target is carried by the row's own verdict. The mark is the family's gold record bubble; the medal's
// name („Súly-rekord") is its accessible name. The set grid of the active workout shows ONE mark per row (the record
// mark wins), so it no longer lists a chip per medal — this piece names a single medal wherever one is listed.
// ============================================================
import type { Medal } from '@/data/train/medalTypes'
import { Bub } from '@/shared/ui/folyadek'
import { MEDAL_TYPE_LABEL } from '@/features/train/logic/medalLabels'

export function MedalChip({ medal, size = 24 }: { medal: Medal; size?: number }) {
  if (medal.tier !== 'RECORD') return null
  return (
    <span className="ek-medal" role="img" aria-label={MEDAL_TYPE_LABEL[medal.type] ?? 'Rekord'}>
      <Bub icon="t-record" size={size} color="var(--fo-gold)" />
    </span>
  )
}
