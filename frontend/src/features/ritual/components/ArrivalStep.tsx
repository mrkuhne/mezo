import { Icon3D } from '@/shared/ui/clay'

/**
 * Napzárás act 1 — Megérkezés (mezo-ilsj, spec §4; Üveg re-dress mezo-me75u.3).
 * The floating 3D moon over a lavender/amber halo + the two fixed arrival lines, then the lit
 * amber CTA into act 2. The two HU lines are LAW, do not paraphrase.
 */
export function ArrivalStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rz-act rz-arrival">
      <div className="rz-moon" aria-hidden="true"><Icon3D name="t-moon" size={110} /></div>
      <h1 className="rz-line1">A nap véget ért.</h1>
      <p className="rz-line2">Zárjuk le együtt.</p>
      <button className="rz-cta" onClick={onNext}>Kezdjük</button>
    </div>
  )
}
