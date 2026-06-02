import { cn } from '@/lib/cn'

type Tone = 'glow' | 'warning' | 'error'
export function ProgressBar({ value, tone = 'glow', className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('bar', className)}>
      <div className={cn('bar-fill', tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}
