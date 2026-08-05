import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { InputHTMLAttributes } from 'react'

/**
 * Canonical number field (DS Rule 4, design-system-mezo.html §Inputs):
 * an emptied field STAYS empty — never auto-replaced with 0. Local string
 * state accepts any intermediate input; the numeric value commits on blur
 * (or Enter via the browser's blur), `''` commits `null`. `type="text"` +
 * `inputMode="decimal"` avoids the native number-input spinner/zero behavior
 * on mobile. Parent state must be `number | null`.
 */
export function NumberInput({ value, onChange, className, ...rest }: {
  value: number | null
  onChange: (next: number | null) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(value == null ? '' : String(value))

  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn('ninput', className)}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim().replace(',', '.')
        if (trimmed === '') { onChange(null); return }
        const n = Number(trimmed)
        if (Number.isFinite(n)) onChange(n)
        else setText(value == null ? '' : String(value))
      }}
      {...rest}
    />
  )
}
