/** 5-6-7 breathing pacer (spec D6). The 18s cycle is pure CSS animation; with
 *  prefers-reduced-motion the orb stays static and only the labels cycle (also CSS). */
export function NightBreathing({ onStop }: { onStop: () => void }) {
  return (
    <div className="nb">
      <div className="night-eye">Légzés · 5 – 6 – 7</div>
      <div className="nb-stage" aria-hidden="true">
        <div className="nb-orb" />
        <div className="nb-labels">
          <span className="nb-in">Be…</span>
          <span className="nb-hold">Tartsd…</span>
          <span className="nb-out">Ki…</span>
        </div>
      </div>
      <div className="nb-hint">Kövesd a kört a légzéseddel.<br />A hosszú kilégzés nyugtatja az idegrendszert.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}
