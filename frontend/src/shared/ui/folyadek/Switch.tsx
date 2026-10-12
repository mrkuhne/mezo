import { forwardRef, type InputHTMLAttributes } from 'react'
import { useM } from '@/shared/i18n'
import { Bub } from './Bub'
import { cx, type PassProps } from './util'

/** The on / off switch (prototype `sw`): `role="switch"`, named by `label`. The drawn track is 46 × 28; the kit owns the 44 px
 *  touch area. Put it at the end of a `Row as="div"` or beside a label. */
export function Switch({ on, onChange, label, disabled, className, ...rest }: PassProps & {
  on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; className?: string
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={cx('fo-sw', on && 'on', className)} onClick={() => onChange(!on)} {...rest} />
  )
}

/** The search field (prototype `srch`): a lens bubble, the input, and a clear button once it holds text. White on the page
 *  and in a hero, page-grey inside a card or a sheet. `aria-label` (or `placeholder`) names the input. */
export const SearchField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string; onChange: (next: string) => void
}>(function SearchField({ value, onChange, className, placeholder, ...rest }, ref) {
  const M = useM()
  return (
    <div className={cx('fo-srch', className)}>
      <Bub icon="t-lens" size={28} />
      <input ref={ref} type="search" value={value} placeholder={placeholder} aria-label={rest['aria-label'] ?? placeholder}
        onChange={(e) => onChange(e.target.value)} {...rest} />
      {value !== '' && <button type="button" aria-label={M.kit.clearSearch} onClick={() => onChange('')}>×</button>}
    </div>
  )
})
