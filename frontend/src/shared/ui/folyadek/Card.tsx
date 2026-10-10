import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from './util'

/** A white section card. Passes `id`, `data-*`, `aria-*` and a `ref` through. */
export const Card = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Card({ className, ...rest }, ref) {
  return <section ref={ref} className={cx('fo-card', className)} {...rest} />
})
