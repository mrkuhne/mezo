/**
 * Napzárás act 1 — Megérkezés (mezo-ilsj, spec §4). Breathing moon + the two fixed
 * arrival lines, then the CTA into act 2. Byte-exact copy per the approved mockup
 * (ritual-flow.html phone 1) — the HU lines are LAW, do not paraphrase.
 */
export function ArrivalStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rz-act rz-arrival">
      <div className="rz-moon" aria-hidden="true" />
      <h1 className="rz-line1">A nap véget ért.</h1>
      <p className="rz-line2">Zárjuk le együtt.</p>
      <button className="rz-cta" onClick={onNext}>Kezdjük 🌙</button>
    </div>
  )
}
