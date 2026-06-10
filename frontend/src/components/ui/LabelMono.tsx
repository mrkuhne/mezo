import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function LabelMono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('label-mono', className)}>{children}</span>
}
