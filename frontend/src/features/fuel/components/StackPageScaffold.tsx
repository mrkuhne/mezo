// ============================================================
// Mezo · StackPageScaffold — the shared page frame of Protokoll, Új elem and Gyógyszer (Folyadék F5, mezo-n4wf5.5).
//
// A Kiegészítők sub-page: the title and its context line go to the app's title bar (`useFrameTitle`), back returns where
// the user came from (`backTo` is only where a direct link goes); where no title bar is mounted the page draws its own
// back pill. `foot` = the floating action bar. Navigation is unchanged from the Üveg version.
// ============================================================
import type { ReactNode } from 'react'
import { FrameBack, Page, useFrameTitle } from '@/shared/ui/folyadek'
import { useM } from '@/shared/i18n'

interface StackPageScaffoldProps {
  // S5 (mezo-qt5q): the `/fuel/stack/manage` hub is gone — Protokoll is where managing lives.
  backTo: '/fuel/stack' | '/fuel/stack/protocol'
  /** the page's name in the title bar */
  name: string
  /** the context line over it */
  eyebrow: string
  foot?: ReactNode
  className?: string
  children: ReactNode
}

export function StackPageScaffold({ backTo, name, eyebrow, foot, className, children }: StackPageScaffoldProps) {
  const M = useM()
  useFrameTitle({ title: name, eyebrow })
  return (
    <Page className={className ? `fk-page ${className}` : 'fk-page'} foot={foot}>
      <FrameBack className="fo-backpill" history fallback={backTo}>‹ {backTo === '/fuel/stack' ? M.fuelKieg.common.supplements : M.fuelKieg.protocol.title}</FrameBack>
      {children}
    </Page>
  )
}
