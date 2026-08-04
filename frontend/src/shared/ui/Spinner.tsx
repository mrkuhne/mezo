import { cn } from '@/shared/lib/cn'

/**
 * Fallback loader (DS §Spinner) — Skeleton stays the canonical loading pattern
 * for >2s waits; Spinner is for inline button loaders and short indeterminate
 * operations. Always pair with visible text or pass an aria-label.
 */
export function Spinner({ size = 'md', tone = 'accent', label, className }: {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'accent' | 'primary' | 'muted' | 'onsolid'
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn('spinner', size, `tone-${tone}`, className)}
      role="status"
      aria-label={label ?? 'Betöltés…'}
    />
  )
}
