import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { useM } from '@/shared/i18n'
import { cx } from './util'

/** The floating bottom action bar of a full-screen flow. `nonav` = the bottom bar is hidden, so it sits at the screen edge. */
export function Foot(p: { nonav?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx('fo-foot', p.nonav && 'nonav', p.className)}>{p.children}</div>
}

/** A foot whose content is stacked: the full-width button, then a quiet line or a text link under it (`sub`). */
export function FootCol(p: { sub?: ReactNode; className?: string; children: ReactNode }) {
  return <div className={cx('fo-fcol', p.className)}>{p.children}{p.sub != null && <span className="fo-fsub">{p.sub}</span>}</div>
}

/** Two (or `three`) equal cells in a row: paired buttons or paired fields. */
export function TwoBtn({ three, className, ...rest }: HTMLAttributes<HTMLDivElement> & { three?: boolean }) {
  return <div className={cx('fo-two', three && 'three', className)} {...rest} />
}

/** The title row of a CHROME-FREE route (`AppLayout hideChrome`: no title bar is mounted, so `useFrameTitle` shows
 *  nothing there). The page draws the bar's sub-page row itself: round back, the context line with the domain dot, the
 *  title as the screen's `h1`, an optional mark beside it (the kalauz `?`). Pinned like the title bar it stands in for
 *  (`.sticky-top`, the bar's frosted ground); `headingRef` makes the title a focus target (a ceremony step moves the focus there). The back
 *  handler is the caller's — a stateful back (leave the session, step back) or `useBackNav`, never a bare `navigate(-1)`.
 *  `data-*` land on the root. */
export function TitleRow({ context, title, backLabel, onBack, mark, headingRef, className, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  context: ReactNode; title: ReactNode; backLabel?: string; onBack: () => void; mark?: ReactNode; headingRef?: Ref<HTMLHeadingElement>
}) {
  const M = useM()
  return (
    <div className={cx('fo-ptop sticky-top', className)} {...rest}>
      <div className="fo-trow">
        <button type="button" className="fo-ib fo-back" aria-label={backLabel ?? M.kit.back} onClick={onBack}><span aria-hidden="true">‹</span></button>
        <div className="fo-title">
          <small><i aria-hidden="true" /><span>{context}</span></small>
          <div className="fo-h sm"><h1 tabIndex={headingRef ? -1 : undefined} ref={headingRef}>{title}</h1>{mark}</div>
        </div>
      </div>
    </div>
  )
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
