import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx, type PassProps } from './util'

/** The one text field recipe (`.fo-in`): a single line. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('fo-in', className)} {...rest} />
})

/** The text field, several lines (no resize handle). */
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('fo-in', className)} {...rest} />
})

/** The text field as a select. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx('fo-in', className)} {...rest} />
})

/** The big numeral of a sheet or card: value + quiet unit (+ a note line under them). `left` / `right` sit beside it
 *  (a Jar, a glass, a Bub); with `onClick` the numeral itself is a button (e.g. „show the total again"). */
export function Big({ value, unit, note, left, right, onClick, className, ...rest }: PassProps & {
  value: ReactNode; unit?: ReactNode; note?: ReactNode; left?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string
}) {
  const inner = <>{value}{unit != null && <small>{unit}</small>}{note != null && <em>{note}</em>}</>
  return (
    <div className={cx('fo-bigrow', className)}>
      {left}
      {onClick
        ? <button type="button" className="fo-big" onClick={onClick} {...rest}>{inner}</button>
        : <span className="fo-big" {...rest}>{inner}</span>}
      {right != null && <span className="fo-big-end">{right}</span>}
    </div>
  )
}
