// ============================================================
// Heti · töltés + hiba (mezo-d20.6.10)
// Source: en-body.html `.skel` shimmer (`switchWeek()`), ×1.18.
//
// Handoff §4's last row: today the Heti surfaces have NEITHER state —
// `useMeWeek` threw `isPending`/`isError` away, so a cold real-mode load
// and a FAILED fetch both rendered as "nothing logged". They are not the
// same thing as an empty week, and the UI must not say they are.
// ============================================================
export function WeekPageSkeleton({ pending = true }: { pending?: boolean }) {
  if (!pending) {
    // Resolved, but no week came back — honest emptiness, not a spinner forever.
    return <p className="wkd-empty">Ehhez a héthez nincs adat.</p>
  }
  return (
    <div className="wkd-skelwrap" role="status" aria-label="Betöltés…">
      <div className="wkd-skel" style={{ height: 44 }} />
      <div className="wkd-skel" style={{ height: 132 }} />
      <div className="wkd-skel" style={{ height: 132 }} />
    </div>
  )
}

export function WeekPageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="wkd-errbox" role="alert">
      <p>Nem sikerült betölteni a hét adatait.</p>
      <button type="button" className="wkd-retry" onClick={onRetry}>Próbáld újra</button>
    </div>
  )
}

/**
 * The DAY page's evaluation, still in flight (mezo-ahf5b). Its own state on purpose: with no
 * evaluation the day page falls back to the pre-jcpt surface — no dimension tiles, the
 * standalone Fuel card — which is the right answer for a FAILED evaluation and a lie for one
 * that simply has not landed yet. A closed day costs a synchronous LLM call on its first read,
 * so that window is seconds long and was read as „a nap semmit nem gyűjtött".
 */
export function DayEvaluationSkeleton() {
  return (
    <div className="wkd-skelwrap" role="status" aria-label="Az értékelés készül…">
      <div className="wkd-skel" style={{ height: 96 }} />
      <div className="wkd-skel" style={{ height: 116 }} />
      <div className="wkd-skel" style={{ height: 116 }} />
    </div>
  )
}
