// ============================================================
// Mezo · DoneBar — the „this session is done" line under a session's row (mezo-9bbc).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `doneIn()`): an indented line under the step —
// the small green tick bubble, the bold summary, the quiet detail after a middle dot, and
// „Megnézem" as a text link when the logged session can be opened.
// ============================================================
import { Bub, Lk } from '@/shared/ui/folyadek'

export function DoneBar({
  summary,
  detail,
  onClick,
  ariaLabel,
}: {
  /** Bold first part — the logged effort, e.g. `RPE 8 · 60 perc`. */
  summary: string
  /** Quiet second part (when known), e.g. `07:12-kor logolva`. */
  detail?: string | null
  /** When present the line carries the „Megnézem" link. */
  onClick?: () => void
  /** Accessible name of the link. */
  ariaLabel?: string
}) {
  return (
    <div className="em-in em-done">
      <span>
        <span className="em-in-ic" role="img" aria-label="kész"><Bub icon="t-tick" size={24} color="var(--fo-ok)" /></span>
        <b>{summary}</b>
        {detail ? <> · <small className="em-done-detail">{detail}</small></> : null}
      </span>
      {onClick && <Lk onClick={onClick} aria-label={ariaLabel}>Megnézem</Lk>}
    </div>
  )
}
