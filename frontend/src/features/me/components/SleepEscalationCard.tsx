import { ESCALATION_LEAD } from '@/features/me/logic/sleepEducation'

/** The gentle escalation card (slice C3, spec D4) — renders INSTEAD of SleepStatCard while
 *  the trigger holds and isn't snoozed. No red, no guilt framing (ADR 0010); the heavy
 *  clinical stats live in the sheet's escalation section, never here. */
export function SleepEscalationCard({
  reason,
  onDetails,
  onSnooze,
}: {
  reason: 'short' | 'quality' | null
  onDetails: () => void
  onSnooze: () => void
}) {
  return (
    <section className="sesc" aria-label="Az alvásod jelez">
      <span className="sstat-eye" style={{ color: 'var(--amber-deep)' }}>Az alvásod jelez</span>
      <p className="sesc-lead">
        {ESCALATION_LEAD[reason === 'quality' ? 'quality' : 'short']}
      </p>
      <p className="sesc-body">
        Ez nem akaraterő kérdése — és van rá bizonyított, gyógyszermentes segítség.
      </p>
      <div className="sesc-actions">
        <button className="sesc-cta" onClick={onDetails}>Részletek</button>
        <button className="sesc-quiet" onClick={onSnooze}>Most nem</button>
      </div>
    </section>
  )
}
