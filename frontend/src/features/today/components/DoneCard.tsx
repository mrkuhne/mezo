// ============================================================
// Mezo · DoneCard — the day hero's "this session is over" block (mezo-k496).
// Replaces the `.td-foot.is-done` footnote the done-state shipped with: a
// success-ramp block in the CTA's slot — check circle + `Kész` + an optional
// detail line, then a hairline and the session's numbers.
//
// Today-LOCAL by design: Train has its own `DoneBar` for the same job, but a
// feature may not import another feature's components, and Today speaks the
// `.td-*` list language. Same idea, this screen's vocabulary.
// ============================================================
import { Icon } from '@/shared/ui/Icon'

/** One number cell. The CALLER drops empty facts — this renders what it is given. */
export interface DoneFact {
  /** Already formatted for display (`4 320`), never a raw number — the block does no math. */
  value: string
  /** Short all-caps unit (`SZETT`, `KG`). */
  label: string
}

export function DoneCard({
  facts,
  detail,
  onOpen,
  ariaLabel,
}: {
  facts: DoneFact[]
  /** Quiet second line, e.g. `Megnézem az összegzést`. Only meaningful with `onOpen`. */
  detail?: string | null
  /** When present the whole block becomes the tap target (the gym hero's review). */
  onOpen?: () => void
  /** Accessible name for the tappable variant. */
  ariaLabel?: string
}) {
  const inner = (
    <>
      <div className="td-dcard-head">
        <span className="td-dcard-check" aria-hidden="true"><Icon name="check" size={15} /></span>
        <span className="td-dcard-txt">
          Kész
          {detail ? <small className="td-dcard-sub">{detail}</small> : null}
        </span>
        {onOpen && (
          <span className="td-dcard-chev" aria-hidden="true">
            <Icon name="chevron-right" size={16} color="var(--text-disabled)" />
          </span>
        )}
      </div>
      {facts.length > 0 && (
        <div className="td-dcard-cells">
          {facts.map((f) => (
            <div className="td-dcard-cell" key={f.label}>
              <div className="td-dcard-v">{f.value}</div>
              <div className="td-dcard-l">{f.label}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
  // No handler ⇒ a plain block, never a button: a tap target that goes nowhere is exactly the
  // dead control this screen's suite exists to keep out (the sport hero has no review page).
  if (!onOpen) return <div className="td-dcard">{inner}</div>
  return (
    <button type="button" className="td-dcard np-press" onClick={onOpen} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}
