import type { HTMLAttributes } from 'react'
import { cx } from './util'

/** A white section card. Passes `id`, `data-*`, `aria-*` through. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('fo-card', className)} {...rest} />
}
