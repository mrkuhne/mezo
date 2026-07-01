import { cn } from '@/shared/lib/cn'
import type { ReactNode } from 'react'

type DisplaySize = 'xl' | 'lg' | 'md' | 'sm'
export function Display({ children, size = 'md', className }: { children: ReactNode; size?: DisplaySize; className?: string }) {
  return <div className={cn('h-display', `size-${size}`, className)}>{children}</div>
}
