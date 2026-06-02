import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('page-title', className)}>{children}</h1>
}
