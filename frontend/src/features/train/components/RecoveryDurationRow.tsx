import { cn } from '@/shared/lib/cn'
import { ESTIMATE_CHIPS, type RecoveryEstimate } from '@/features/train/logic/recovery'
import { KIMELO } from '@/features/train/logic/skipCopy'

/**
 * „Meddig tarthat?" (Kímélő mód S2, mezo-q4xt2.2 — prototype vilagos/edzes.js `whySheet()`
 * `lab('Meddig tarthat?') + chips(KDUR)`): the four estimate chips under a serious reason. A tap
 * opens kímélő mód; the lit chip is the picked estimate. Presentational: the sheet owns the write.
 * Shared with the Fuel and Nap sheets (MealSkipSheet, NemVagyokJolSheet), which dress it themselves
 * — so the markup and the `trm-kmdur` / `trm-kmdc` hooks stay (their styles and the layout specs key
 * on them); on the Edzés sheet `folyadek-edzes-mai.css` (`.em-why .trm-kmdur`) gives it the
 * Folyadék pills.
 */
export function RecoveryDurationRow({ value, disabled, onPick }: {
  value: RecoveryEstimate | null
  disabled?: boolean
  onPick(estimate: RecoveryEstimate): void
}) {
  return (
    <div className="trm-kmdur">
      <span className="trm-kmdur-eb" id="skip-km-dur">{KIMELO.durationEyebrow}</span>
      <div className="trm-kmdc" role="group" aria-labelledby="skip-km-dur">
        {ESTIMATE_CHIPS.map((c) => (
          <button key={c.value} type="button" className={cn(value === c.value && 'on')} aria-pressed={value === c.value}
            disabled={disabled} onClick={() => onPick(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}
