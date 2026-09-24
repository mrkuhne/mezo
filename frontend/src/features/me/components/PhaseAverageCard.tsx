import type { SleepEntry } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { averageBreakdown, DEEP_REF, phasePct, REM_REF } from '@/features/me/logic/sleepPhases'

/**
 * Average phase composition over the window (mezo-fk9a). Owns its own heading and returns
 * null under the 3-night floor, so the page never renders a stray eyebrow over nothing.
 */
export function PhaseAverageCard({
  entries,
  windowDays,
}: {
  entries: SleepEntry[]
  windowDays: number
}) {
  const result = averageBreakdown(entries, windowDays)
  if (!result) return null
  const { avg, nights } = result

  return (
    <div className="pac">
      <div className="alv-sec-head">
        <Eyebrow>Átlagos összetétel · {nights} éjszakából</Eyebrow>
      </div>
      <div className="pac-card glass">
        <PhaseRail breakdown={avg} height={16} />
        <div className="alv-refs">
          <PhaseReferenceRow label="Mély" pct={phasePct(avg, 'deep')} range={DEEP_REF} color="var(--ph-deep)" />
          <PhaseReferenceRow label="REM" pct={phasePct(avg, 'rem')} range={REM_REF} color="var(--ph-rem)" />
        </div>
      </div>
    </div>
  )
}
