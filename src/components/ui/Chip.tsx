import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type ChipVariant = 'default' | 'brand' | 'warning' | 'error'
export function Chip({ children, variant = 'default', className }: { children: ReactNode; variant?: ChipVariant; className?: string }) {
  return <span className={cn('chip', variant !== 'default' && variant, 'notch-4', className)}>{children}</span>
}
