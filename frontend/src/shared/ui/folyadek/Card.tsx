import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from './util'

/** A white section card. Passes `id`, `data-*`, `aria-*` and a `ref` through. `gold` = the card that holds something won
 *  (new records, the kcal earned): a gold rim and glow. */
export const Card = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { gold?: boolean }>(function Card({ className, gold, ...rest }, ref) {
  return <section ref={ref} className={cx('fo-card', gold && 'gold', className)} {...rest} />
})
