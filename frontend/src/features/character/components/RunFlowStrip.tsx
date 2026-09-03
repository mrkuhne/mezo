// ============================================================
// Mezo · Karakter — RunFlowStrip (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `flowStripHTML(n)` — connected
// jel → hívás → megfigyelés steps.
//
// BINDING RULING (task-4 brief): callCount is honest ONLY for NIGHTLY runs — a conference-
// kind run (WEEKLY/MONTHLY/BOOTSTRAP) must never render a "0 hívás" cell, since its callCount
// is deliberately 0 by design (characterMock.ts's ruling comment / CharacterConferenceService
// javadoc) and a 0-cell here would misread as "nobody was called" rather than "not tracked at
// this level" — the AI-napló row is the call-level truth for those kinds. This component stays
// a dumb, honest renderer of whatever `steps` it's given; the kind-branching (and the ruling
// itself) lives in the caller (RunPage's `flowSteps`), not here.
// ============================================================
import { Fragment } from 'react'

export interface RunFlowStep {
  label: string
  value: number
}

export function RunFlowStrip({ steps }: { steps: RunFlowStep[] }) {
  return (
    <div className="kr-runflow" role="group" aria-label="Futás-lánc">
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          {i > 0 && <div className="kr-runflow-arrow" aria-hidden="true">→</div>}
          <div className="kr-runflow-step">
            <b>{step.value}</b>
            <small>{step.label}</small>
          </div>
        </Fragment>
      ))}
    </div>
  )
}
