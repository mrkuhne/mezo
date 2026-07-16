import { cn } from '@/shared/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function CtaPrimary({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-primary', className)} {...rest}>{children}</button>
}
export function CtaGhost({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-ghost', className)} {...rest}>{children}</button>
}
