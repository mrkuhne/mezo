import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function CtaPrimary({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-primary', 'notch-8', className)} {...rest}>{children}</button>
}
export function CtaGhost({ children, className, ...rest }: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('cta-ghost', 'notch-8', className)} {...rest}>{children}</button>
}
