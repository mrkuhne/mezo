import { cn } from '@/lib/cn'
type Tone = 'glow' | 'warning' | 'error'
export function ProgressBar({ value, tone = 'glow', color, glow, className }:
  { value: number; tone?: Tone; color?: string; glow?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('bar', className)}>
      <div className={cn('bar-fill', !color && tone)}
        style={{ width: `${pct}%`, ...(color ? { background: color } : {}),
          ...(glow && color ? { boxShadow: `0 0 6px ${color}` } : {}) }} />
    </div>
  )
}
