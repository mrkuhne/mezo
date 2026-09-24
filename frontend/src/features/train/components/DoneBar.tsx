// ============================================================
// Mezo · DoneBar — the shared "this session is done" bar (mezo-9bbc).
// A done mark + bold summary + optional quiet detail line.
// Worn by TodaySessionCard's logged state, so every modality reports
// completion the same way.
// ÜVEG (mezo-me75u.4, prototypes/uveg-edzes.html `.sess .donebar`): a flat cell inside the
// glass card (never glass in glass); the done mark is the 3D t-tick, its meaning („kész”)
// spoken through the mark's accessible name.
// ============================================================
import { Icon3D } from '@/shared/ui/clay'

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
      <span className="donebar-check" role="img" aria-label="kész"><Icon3D name="t-tick" size={22} /></span>
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
