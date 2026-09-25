// ============================================================
// Mezo · Proaktív coaching — one rule's verdict (mezo-6269.3).
// Spec 2026-09-05 §6.3. Poster anatomy, not a settings row: rank plaque,
// 3D icon by domain, state chip, one evidence line — and the frozen numbers
// behind it one tap away. Generated from the server's fields alone; there
// is no per-flagKey markup anywhere.
// Üveg (mezo-me75u.8): ranked by STATE, never reordered — a flagged rule is
// the loud `.glass` (coral), a resting one flat with an amber tint, a fine
// one flat and dimmed, an unmeasurable one dashed. Name on top, the chips
// under it; the state chip carries its 3D icon (bible rule 45).
// Not `CollapsibleStrip`: its header takes a plain-string eyebrow and has
// no rank/icon slot, and widening it for one caller would put feature
// semantics into the domain-free shared kit. The interaction contract is
// copied verbatim (aria-expanded + aria-controls + a hidden body).
// ============================================================
import { useId, useState, type CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import {
  STATE_ART, STATE_LABEL, WINNER_ART, WINNER_LABEL, stateOf, visualOf,
  type CoachingState,
} from '@/features/insights/logic/coachingCopy'
import type { CoachingRule } from '@/data/types'

/** A flat state chip with its 3D icon — `winner` is the „Nyertes" stamp. Tone per state in CSS. */
export function CoachingChip({ state }: { state: CoachingState | 'winner' }) {
  const winner = state === 'winner'
  return (
    <span className={cn('coach-chip', `is-${state}`)}>
      <Icon3D name={winner ? WINNER_ART : STATE_ART[state]} size={16} />
      {winner ? WINNER_LABEL : STATE_LABEL[state]}
    </span>
  )
}

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
      <span className="coach-rank">{rule.rank}</span>
      <Icon3D name={visualOf(rule.domain).icon} size={30} className="mzo-rule-ic" />
      <span className="coach-grow">
        <span className="mzo-rule-nm">{rule.label}</span>
        <span className="coach-chips">
          {winner && <CoachingChip state="winner" />}
          <CoachingChip state={state} />
        </span>
      </span>
      {expandable && <span className="coach-chev" aria-hidden="true">▾</span>}
    </>
  )

  return (
    <div className={cn('mzo-rule', `is-${state}`, state === 'raised' && 'glass', 'rise',
      winner && 'is-winner', open && 'open')}
      data-state={state}
      style={{ '--d': `${delayMs}ms` } as CSSProperties}>
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
            <div key={i} className="coach-fact"><span className="vl">{fact}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
