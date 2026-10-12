// Mezo · WeeklyLearningDot (mezo-3n2so, spec §5.1) — the small drop that signals a fresh weekly learning summary (prototype
// fuel.js `.fu-dot`): on the „Heti összegző" button of the learning page and beside the Alap row of the Mai equation. It is
// ONLY a signal, never a tap target of its own (owner, prototype round 2): the control around it takes the tap. Full when
// the week moved the base, hollow (`hold`) when the week held for too little data. It draws in `currentColor`: white on a
// liquid button, the domain colour on white (`.ft-dot`, styles/folyadek-fuel-tanulas.css). Static — nothing for reduced
// motion to switch off.
export function WeeklyLearningDot({ hold }: { hold: boolean }) {
  return <i className={`ft-dot${hold ? ' hold' : ''}`} aria-hidden="true" />
}
