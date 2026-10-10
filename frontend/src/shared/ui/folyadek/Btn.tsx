import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cx } from './util'

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { ghost?: boolean; sm?: boolean; wide?: boolean; grow?: boolean; icon?: Icon3DName }

/** The button: a liquid pill (primary), `ghost` = white, `sm` = small, `wide` = full width, `grow` = takes the free space of its row. */
export function Btn({ ghost, sm, wide, grow, icon, className, type = 'button', children, ...rest }: BtnProps) {
  return (
    <button type={type} className={cx('fo-btn', ghost && 'ghost', sm && 'sm', wide && 'wide', grow && 'grow', className)} {...rest}>
      {icon && <Icon3D name={icon} size={18} />}
      {children}
    </button>
  )
}

/** A text link that is a button. */
export function Lk({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx('fo-lk', className)} {...rest} />
}

/** The wrapping action row (buttons + links). `center` centres it (empty states). */
export function Acts({ center, className, ...rest }: HTMLAttributes<HTMLDivElement> & { center?: boolean }) {
  return <div className={cx('fo-acts', center && 'center', className)} {...rest} />
}
