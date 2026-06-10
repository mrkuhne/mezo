import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'
import { StatusBar } from './StatusBar'

export function PhoneFrame({ children, anchor = false, clock }: { children: ReactNode; anchor?: boolean; clock?: string }) {
  return (
    <div className="app-root">
      <div className="phone">
        <div className={cn('phone-screen', anchor && 'anchor')}>
          <div className="dynamic-island" />
          <StatusBar clock={clock} />
          {children}
          <div className="home-indicator" />
        </div>
      </div>
    </div>
  )
}
