import { SafeMarkdown } from '@/shared/lib/safeMarkdown'

/** Napiv .aistrip — Mezo's pacing insight, restyled to the shared AI-note vocabulary
 *  (spec §4.4; mirrors ActiveWorkoutPage's rationale strip). Props unchanged. */
export function PacingCard({ pacing }: { pacing: { eyebrow: string; msg: string } }) {
  return (
    <div className="aistrip">
      <span aria-hidden="true">✨</span>
      <p><SafeMarkdown text={pacing.msg} /></p>
    </div>
  )
}
