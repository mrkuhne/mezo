import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './util'

/** The floating bottom action bar of a full-screen flow. `nonav` = the bottom bar is hidden, so it sits at the screen edge. */
export function Foot(p: { nonav?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx('fo-foot', p.nonav && 'nonav', p.className)}>{p.children}</div>
}

/** Two (or `three`) equal cells in a row: paired buttons or paired fields. */
export function TwoBtn({ three, className, ...rest }: HTMLAttributes<HTMLDivElement> & { three?: boolean }) {
  return <div className={cx('fo-two', three && 'three', className)} {...rest} />
}

/** The root of a converted page: the page rhythm under the title bar. `foot` = the floating action bar (pinned above the
 *  bottom bar, or at the screen edge with `nonav`); `tone="dusk"` = the evening liquid for everything inside. */
export function Page({ className, tone, foot, nonav, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: 'dusk'; foot?: ReactNode; nonav?: boolean }) {
  return (
    <div className={cx('fo-page', tone === 'dusk' && 'fo-dusk', foot != null && 'has-foot', nonav && 'nonav', className)} {...rest}>
      {children}
      {foot != null && <Foot nonav={nonav}>{foot}</Foot>}
    </div>
  )
}
