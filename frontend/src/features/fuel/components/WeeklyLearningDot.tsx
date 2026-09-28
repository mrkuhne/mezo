// Mezo · WeeklyLearningDot (mezo-3n2so, spec §5.1) — the glowing dot that signals a fresh weekly
// learning summary on the Fuel Mai page (elo/fuel.html `.wdot`). It is ONLY a signal, never a tap
// target of its own (owner, prototype round 2): the whole row around it takes the tap. Sage by
// default, amber when the week held for too little data. Static — no pulse, so reduced motion has
// nothing to switch off.
export function WeeklyLearningDot({ hold }: { hold: boolean }) {
  return <span className={`fwl-dot${hold ? ' is-hold' : ''}`} aria-hidden="true" />
}
