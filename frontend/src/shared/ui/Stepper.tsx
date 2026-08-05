import { cn } from '@/shared/lib/cn'

/**
 * Wizard progress indicator, dot mode (DS §Stepper — for 3–5 steps where step
 * names don't fit): title + "N / total" head row, then the dot row with the
 * current step's name to the right. States: done (success), active (gold
 * milestone ring), idle (recess). Line mode arrives with its first consumer.
 */
export function Stepper({ title, step, total, stepLabel, className }: {
  title: string
  /** 1-based current step */
  step: number
  total: number
  stepLabel?: string
  className?: string
}) {
  return (
    <div className={className} role="group" aria-label={`${title}: ${step}. lépés / ${total}`}>
      <div className="stepper-head">
        <span className="stepper-title">{title}</span>
        <span className="stepper-count">{step} / {total}</span>
      </div>
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
    </div>
  )
}
