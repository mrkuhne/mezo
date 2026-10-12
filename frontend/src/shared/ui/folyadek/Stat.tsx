import type { CSSProperties, ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { clamp, cx, type PassProps } from './util'

/** A number tile that is a vessel (prototype `stat`): the caption on top, the numeral with its quiet unit, an optional note —
 *  and, with `pct`, the tile itself filled to that level in `color`. With `onClick` the whole tile is a button. The corner
 *  glyph sits in a white round chip, so the caption keeps clear of it. Lay several out with `StatGrid`. */
export function Stat({ label, value, unit, icon, pct, color, note, onClick, className, ...rest }: PassProps & {
  label: ReactNode; value: ReactNode; unit?: ReactNode; icon?: Icon3DName; pct?: number | null; color?: string; note?: ReactNode
  onClick?: () => void; className?: string
}) {
  const style = { '--c': color ?? 'var(--dom)', ...(pct != null ? { '--p': `${clamp(pct)}%` } : {}) } as CSSProperties
  const inner = (
    <>
      {icon && <span className="fo-stat-ic"><Icon3D name={icon} size={26} /></span>}
      <span className="fo-stat-k">{label}</span>
      <span className="fo-stat-n">{value}{unit != null && unit !== '' && <small>{unit}</small>}</span>
      {note != null && note !== '' && <span className="fo-stat-s">{note}</span>}
    </>
  )
  const cls = cx('fo-stat', pct != null && 'lv', className)
  return onClick
    ? <button type="button" className={cls} style={style} onClick={onClick} {...rest}>{inner}</button>
    : <div className={cls} style={style} {...rest}>{inner}</div>
}

/** Two tiles a row (prototype `grid`); `three` = three across. */
export function StatGrid({ three, className, children, ...rest }: PassProps & { three?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx('fo-stats', three && 'three', className)} {...rest}>{children}</div>
}
