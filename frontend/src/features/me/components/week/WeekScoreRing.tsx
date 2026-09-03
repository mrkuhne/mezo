// ============================================================
// Heti/napi pontszám-gyűrű (mezo-d20.6.10)
// Source: en-body.html `.wkring` + `ringTo()`, ×1.18. The sweep and the
// numeral count up together off one `useCountUp`, so they can never drift.
// Honest state: no score renders `tanulom` + a caption, NOT a zero ring.
// ============================================================
import type { CSSProperties } from 'react'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { scoreBandColor } from '@/features/me/logic/scoreBand'

export interface WeekScoreRingProps {
  /** `null` = the Mezo did not score this period (too little data). */
  score: number | null
  /** Caption under the numeral. Defaults to the scored case. */
  unit?: string
  /** Caption shown in place of `unit` when `score` is null. */
  learningLabel?: string
  learningCaption?: string
  className?: string
}

export function WeekScoreRing({
  score,
  unit = '/ 100',
  learningLabel = 'tanulom',
  learningCaption = 'még gyűlik',
  className,
}: WeekScoreRingProps) {
  // Hooks run unconditionally; a null score simply counts up to 0 and is never read.
  const swept = useCountUp(score ?? 0, 900)
  const isLearning = score == null
  const style = {
    '--c': scoreBandColor(score),
    '--v': isLearning ? 0 : swept,
  } as CSSProperties

  return (
    <div
      className={className ? `wk-ring ${className}` : 'wk-ring'}
      style={style}
      role="img"
      aria-label={isLearning ? `Pontszám: ${learningLabel}` : `Pontszám: ${score} / 100`}
    >
      <div className="in">
        {isLearning ? (
          <>
            <b className="is-learning">{learningLabel}</b>
            <small>{learningCaption}</small>
          </>
        ) : (
          <>
            <b>{swept}</b>
            <small>{unit}</small>
          </>
        )}
      </div>
    </div>
  )
}
