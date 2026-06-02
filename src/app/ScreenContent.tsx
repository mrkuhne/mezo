import type { ReactNode } from 'react'
export function ScreenContent({ children }: { children: ReactNode }) {
  return <div className="screen-content">{children}</div>
}
