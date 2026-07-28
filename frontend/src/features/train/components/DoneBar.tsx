// ============================================================
// Mezo · DoneBar — the shared "this session is done" bar (mezo-9bbc).
// A sage check circle + bold summary + optional quiet detail line.
// Worn by TodaySessionCard's logged state and by the gym hero's Kész
// state, so every modality reports completion the same way.
// ============================================================
import { Icon } from '@/shared/ui/Icon'

export function DoneBar({
  summary,
  detail,
  onClick,
  ariaLabel,
}: {
  /** Bold first line — the logged effort, e.g. `RPE 8 · 60 perc`. */
  summary: string
  /** Quiet second line (when known), e.g. `07:12-kor logolva`. */
  detail?: string | null
  /** When present the whole bar becomes the tap target. */
  onClick?: () => void
  /** Accessible name for the tappable variant. */
  ariaLabel?: string
}) {
  const inner = (
    <>
      <span className="donebar-check" aria-hidden="true"><Icon name="check" size={15} /></span>
      <span className="donebar-txt">
        {summary}
        {detail ? <small className="donebar-detail">{detail}</small> : null}
      </span>
    </>
  )
  if (!onClick) return <div className="donebar">{inner}</div>
  return (
    <button type="button" className="donebar np-press" onClick={onClick} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}
