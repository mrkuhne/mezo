import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx } from './util'

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { ghost?: boolean; sm?: boolean; wide?: boolean; grow?: boolean; icon?: Icon3DName
  /** The danger tone: an action that closes or deletes for good. */
  bad?: boolean }

/** The button: a liquid pill (primary), `ghost` = white, `sm` = small, `wide` = full width, `grow` = takes the free space of its row, `bad` = danger. */
export function Btn({ ghost, sm, wide, grow, icon, bad, className, type = 'button', children, ...rest }: BtnProps) {
  return (
    <button type={type} className={cx('fo-btn', ghost && 'ghost', sm && 'sm', wide && 'wide', grow && 'grow', bad && 'bad', className)} {...rest}>
      {icon && <Icon3D name={icon} size={18} />}
      {children}
    </button>
  )
}

/** A text link that is a button. `bad` = the danger tone (remove, delete); `disabled` dims it. */
export function Lk({ className, type = 'button', bad, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { bad?: boolean }) {
  return <button type={type} className={cx('fo-lk', bad && 'bad', className)} {...rest} />
}

/** The wrapping action row (buttons + links). `center` centres it (empty states). */
export function Acts({ center, className, ...rest }: HTMLAttributes<HTMLDivElement> & { center?: boolean }) {
  return <div className={cx('fo-acts', center && 'center', className)} {...rest} />
}
