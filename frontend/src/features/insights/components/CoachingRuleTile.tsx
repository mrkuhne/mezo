// ============================================================
// Mezo · Proaktív coaching — one rule's verdict (mezo-6269.3).
// Spec 2026-09-05 §6.3. Poster anatomy, not a settings row: rank badge,
// clay icon by domain, wash by outcome, state chip, one evidence line —
// and the frozen numbers behind it one tap away. Generated from the
// server's fields alone; there is no per-flagKey markup anywhere.
// Not `CollapsibleStrip`: its header takes a plain-string eyebrow and has
// no rank/icon slot, and widening it for one caller would put feature
// semantics into the domain-free shared kit. The interaction contract is
// copied verbatim (aria-expanded + aria-controls + a hidden body).
// ============================================================
import { useId, useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import {
  STATE_CHIP, STATE_LABEL, WINNER_LABEL, stateOf, visualOf, washOf,
} from '@/features/insights/logic/coachingCopy'
import type { CoachingRule } from '@/data/types'

export function CoachingRuleTile({ rule, winner = false, delayMs = 0 }: {
  rule: CoachingRule
  /** The day's card came from this rule — read from `day.winner`, NEVER from `cardOutcome`
   *  (mezo-y43v): a winner that has since gone clear reports no card outcome at all. */
  winner?: boolean
  delayMs?: number
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const state = stateOf(rule)
  const expandable = rule.facts.length > 0

  const head = (
    <>
      <span className={rule.rank === 1 ? 'mzp-rankb' : 'mzp-rankb two'}>{rule.rank}</span>
      <ClayIcon name={visualOf(rule.domain).icon} size={26} />
      <span className="mzo-rule-nm">{rule.label}</span>
      {winner && <span className="mzp-stch prop">{WINNER_LABEL}</span>}
      <span className={`mzp-stch ${STATE_CHIP[state]}`}>{STATE_LABEL[state]}</span>
      {expandable && <span className="mz-chev" aria-hidden="true">▾</span>}
    </>
  )

  return (
    <div className={cn('mzo-rule', `mz-w-${washOf(rule)}`, 'rise', winner && 'is-winner', open && 'open')}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      {expandable ? (
        <button type="button" className="mzo-rule-head" aria-expanded={open} aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}>
          {head}
        </button>
      ) : (
        <div className="mzo-rule-head">{head}</div>
      )}
      <div className="mzo-rule-why">{rule.reasonText}</div>
      {expandable && (
        <div className="mzo-rule-body" id={bodyId} hidden={!open}>
          {rule.facts.map((fact, i) => (
            <div key={i} className="mzp-evrow"><span className="vl">{fact}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
