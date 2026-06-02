import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function Eyebrow({ children, brand = false, className }: { children: ReactNode; brand?: boolean; className?: string }) {
  return <span className={cn('eyebrow', brand && 'brand', className)}>{children}</span>
}
