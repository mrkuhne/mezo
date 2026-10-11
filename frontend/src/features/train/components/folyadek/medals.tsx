// Edzés · a medal as a row, a rating as five stars (mezo-n4wf5.3; prototype vilagos/edzes.js `medalRow`, `stars5`).
// Shared by the medal cabinet, an exercise's own page and the closed run's report. CSS: `.ex-medal`, `.ex-prev`,
// `.ex-stars` in folyadek-edzes-kozos.css.
import type { Medal } from '@/data/train/medalTypes'
import {
  MEDAL_TIER_COPY, MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel,
} from '@/features/train/logic/medalLabels'
import { huMonthDay } from '@/shared/lib/dates'
import { Icon3D } from '@/shared/ui/clay'
import { Row, St } from '@/shared/ui/folyadek'
import { Rcap } from './rows'

/** Where the old record stood inside the new one, in % — the capsule's dashed line. Only when
 *  both numbers are real and comparable (a RECORD with a positive previous value). */
function previousShare(medal: Medal): number | null {
  if (medal.tier !== 'RECORD' || medal.previousValue == null || !(medal.value > 0) || medal.previousValue <= 0) return null
  return (medal.previousValue / medal.value) * 100
}

/** One medal as a row (prototype `medalRow`). `titled="exercise"` names the exercise and puts the
 *  medal's kind under it (the cabinet); `titled="type"` names the kind and puts the date under it
 *  (the exercise's own page, where the name would only repeat the title). */
export function MedalRow({ medal, titled = 'exercise', date }: { medal: Medal; titled?: 'exercise' | 'type'; date?: string }) {
  const tier = MEDAL_TIER_COPY[medal.tier]
  const typeLabel = MEDAL_TYPE_LABEL[medal.type] ?? medal.type
  const target = medal.tier === 'TARGET'
  return (
    <Row
      className="ex-medal"
      data-tier={medal.tier}
      left={target ? <Rcap color="var(--fo-ok)" /> : <Rcap prev={previousShare(medal)} />}
      title={<>{titled === 'exercise' ? medal.exerciseName : typeLabel} <St tone={target ? 'ok' : 'warn'}>{tier.tag}</St></>}
      sub={(
        <>
          <span>{titled === 'exercise' ? typeLabel : date}</span>
          {/* RECORD only — TARGET_HIT never carries a previousValue (nothing beaten).
              previousDate can be null (mock-mode medalEvaluator shape) — drop the
              "…óta állt" clause cleanly rather than render a dangling date. */}
          {medal.tier === 'RECORD' && medal.previousValue != null && (
            <span className="ex-prev">
              {`Előző: ${formatMedalNumber(medal.previousValue)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trim()}
              {medal.previousDate ? ` · ${huMonthDay(medal.previousDate)} óta állt` : ''}
            </span>
          )}
        </>
      )}
      value={medalValueLabel(medal)}
    />
  )
}

/** Hungarian decimal comma for the stars' screen-reader label (the ceremony's own idiom). */
const huStars = (stars: number): string => String(stars).replace('.', ',')

/**
 * Five stars, halves included — the full, half and empty star glyphs of the sprite
 * (prototype `stars5`), the same halves the workout ceremony's row draws.
 */
export function StarRow({ stars }: { stars: number }) {
  return (
    <span className="ex-stars" role="img" aria-label={`${huStars(stars)} csillag az ötből`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon3D key={i} name={stars >= i + 1 ? 't-star' : stars >= i + 0.5 ? 't-star-half' : 't-star-empty'} size={18} />
      ))}
    </span>
  )
}
