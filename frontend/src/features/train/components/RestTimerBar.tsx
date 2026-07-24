import { cn } from '@/shared/lib/cn'
import { fmtMMSS } from '@/features/train/logic/restTimer'

/** CTA-morph rest countdown (mezo-xt65): swaps in for the excard's .donebtn while
    a rest is active — same pill radius + rendered height, so the morph causes zero
    layout shift. The bar body is deliberately NOT tappable (the old island's
    tap-to-skip was an accidental-skip hazard); only the explicit buttons act. */
export function RestTimerBar({
  remaining,
  total,
  paused,
  onPause,
  onResume,
  onSkip,
}: {
  remaining: number
  total: number
  paused: boolean
  onPause: () => void
  onResume: () => void
  onSkip: () => void
}) {
  const frac = total > 0 ? remaining / total : 0
  return (
    <div className={cn('restbar', paused && 'paused')} role="timer" aria-label={`Pihenő: ${fmtMMSS(remaining)}`}>
      <div className="fill" style={{ width: `${frac * 100}%` }} aria-hidden="true" />
      <div className="lay">
        <span className="t">
          <small>{paused ? 'Szünetel' : 'Pihenő'}</small>
          {fmtMMSS(remaining)}
        </span>
        <span className="btns">
          {paused ? (
            <button type="button" aria-label="Pihenő folytatása" onClick={onResume}>▶</button>
          ) : (
            <button type="button" aria-label="Pihenő szüneteltetése" onClick={onPause}>⏸</button>
          )}
          <button type="button" aria-label="Pihenő kihagyása" onClick={onSkip}>⏭</button>
        </span>
      </div>
    </div>
  )
}
