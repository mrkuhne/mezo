import { cn } from '@/shared/lib/cn'
import type { CSSProperties, ReactNode } from 'react'

type ChipVariant = 'default' | 'brand' | 'warning' | 'error'
export function Chip({ children, variant = 'default', className, style }: { children: ReactNode; variant?: ChipVariant; className?: string; style?: CSSProperties }) {
  return <span className={cn('chip', variant !== 'default' && variant, 'notch-4', className)} style={style}>{children}</span>
}
