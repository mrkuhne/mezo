import { ClayIcon } from '@/shared/ui/clay'

/**
 * Napzárás act 1 — Megérkezés (mezo-ilsj, spec §4; Mozaik night language mezo-d20.8.1.1).
 * Breathing clay moon + the two fixed arrival lines, then the CTA into act 2. The two HU
 * lines are LAW, do not paraphrase. The CTA's trailing 🌙 is gone: the moon it stood in for
 * is now on the stage as clay, and an emoji beside it would be the same word said twice.
 */
export function ArrivalStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rz-act rz-arrival">
      <div className="rz-moon" aria-hidden="true"><ClayIcon name="i-hold" size={96} /></div>
      <h1 className="rz-line1">A nap véget ért.</h1>
      <p className="rz-line2">Zárjuk le együtt.</p>
      <button className="rz-cta" onClick={onNext}>Kezdjük</button>
    </div>
  )
}
