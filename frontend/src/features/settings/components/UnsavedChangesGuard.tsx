import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'

function RouterGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty)
  if (blocker.state !== 'blocked') return null
  return <Sheet onClose={() => blocker.reset()} labelledBy="unsaved-settings-title"><div className="col gap-md" style={{ padding: 16 }}>
    <h2 id="unsaved-settings-title">Nem mentett módosítások</h2>
    <p>A módosításaid elvesznek, ha most elhagyod az oldalt.</p>
    <button className="cta-primary" type="button" onClick={() => blocker.reset()}>Maradok, folytatom</button>
    <button className="cta-ghost" type="button" onClick={() => blocker.proceed()}>Elvetem, kilépek</button>
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
