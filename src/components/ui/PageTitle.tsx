import { cn } from '@/lib/cn'
import type { CSSProperties, ReactNode } from 'react'

export function PageTitle({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <h1 className={cn('page-title', className)} style={style}>{children}</h1>
}
