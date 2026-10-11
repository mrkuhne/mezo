import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'

function RouterGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty)
  const t = useM().settings.guard
  if (blocker.state !== 'blocked') return null
  return <Sheet onClose={() => blocker.reset()} labelledBy="unsaved-settings-title" className="glass is-still settings-guard-sheet"><div className="settings-guard-body">
    <h2 id="unsaved-settings-title">{t.title}</h2>
    <p>{t.body}</p>
    <button className="cta-primary" type="button" onClick={() => blocker.reset()}>{t.stay}</button>
    <button className="cta-ghost" type="button" onClick={() => blocker.proceed()}>{t.leave}</button>
  </div></Sheet>
}

/** Data-router navigation plus browser reload/close protection; safe in isolated MemoryRouter renders. */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])
  return router ? <RouterGuard dirty={dirty} /> : null
}
