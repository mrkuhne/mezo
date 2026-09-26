import { Fragment } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Wizard progress indicator, dot mode (DS §Stepper — for 3–5 steps where step
 * names don't fit): title + "N / total" head row, then the dot row with the
 * current step's name to the right. States: done (success), active (gold
 * milestone ring), idle (recess). Line mode arrives with its first consumer.
 *
 * Numbered mode (`steps`, mezo-me75u.10 — the onboarding wizard's üveg look): instead of the
 * dots, one numbered disc per step WITH its name (current lit, done half-lit), joined by
 * hairlines. Same states, same accessible group label; purely visual.
 */
export function Stepper({ title, step, total, stepLabel, steps, className }: {
  title: string
  /** 1-based current step */
  step: number
  total: number
  stepLabel?: string
  /** Numbered mode: every step's name, in order (length = total). */
  steps?: readonly string[]
  className?: string
}) {
  return (
    <div className={cn(className, steps && 'stepper-numbered')} role="group" aria-label={`${title}: ${step}. lépés / ${total}`}>
      <div className="stepper-head">
        <span className="stepper-title">{title}</span>
        <span className="stepper-count">{step} / {total}</span>
      </div>
      {steps ? (
        <div className="stepper-steps" aria-hidden="true">
          {steps.map((name, i) => (
            <Fragment key={name}>
              {i > 0 && <span className="stepper-join" />}
              <span className={cn('stepper-step', i + 1 < step && 'done', i + 1 === step && 'active')}>
                <i>{i + 1}</i><span className="stepper-step-lb">{name}</span>
              </span>
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="stepper-dots">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('stepper-dot', i + 1 < step && 'done', i + 1 === step && 'active')}
              aria-hidden="true"
            />
          ))}
          {stepLabel && <span className="stepper-label">{stepLabel}</span>}
        </div>
      )}
    </div>
  )
}
