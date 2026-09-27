import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/shared/ui/ToastProvider'
import { TOAST } from '@/features/insights/logic/hubCopy'

export const UNDO_MS = 5000

export interface ForgetRequest {
  key: string
  label: string
  /** Computed items (observations, effects) are suppressed, not deleted — the bar says so. */
  computed: boolean
  commit: () => void | Promise<unknown>
}
type Pending = ForgetRequest & { startedAt: number }

/**
 * S6 (mezo-d6ivw.6): "Elfelejtem" is permanent, so the ONLY undo is this window — the request is
 * sent when it closes (never before), exactly once. A purpose-built rich confirmation (countdown +
 * bar), hence feature-local rather than the shared toast (frontend_conventions §7a).
 */
export function useForgetUndo() {
  const toast = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const ref = useRef<Pending | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  // A failed request has already rolled the row back (the data layer's optimistic write) — say so,
  // or the "Végleg elfelejtve" toast would be a lie.
  const send = useCallback((p: Pending) => {
    const failed = () => toast.show({ kind: 'error', text: TOAST.forgetFailed })
    try {
      Promise.resolve(p.commit()).catch(failed) // sent synchronously — the request goes out now
    } catch {
      failed()
    }
  }, [toast])

  const sendRef = useRef(send)
  sendRef.current = send

  const commitNow = useCallback((expired: boolean) => {
    const p = ref.current
    if (!p) return
    clear()
    ref.current = null
    setPending(null)
    send(p)
    if (expired) toast.show({ kind: 'info', text: TOAST.forgotten })
  }, [toast, send])

  const start = useCallback((req: ForgetRequest) => {
    commitNow(false)
    const next = { ...req, startedAt: Date.now() }
    ref.current = next
    setPending(next)
    timer.current = setTimeout(() => commitNow(true), UNDO_MS)
  }, [commitNow])

  const undo = useCallback(() => {
    if (!ref.current) return
    clear()
    ref.current = null
    setPending(null)
    toast.show({ kind: 'info', text: TOAST.undone })
  }, [toast])

  useEffect(() => () => {
    // leaving the page is not an undo: commit what the user asked for
    const p = ref.current
    clear()
    ref.current = null
    if (p) sendRef.current(p)
  }, [])

  const isHidden = useCallback((key: string) => pending?.key === key, [pending])
  return { pending, start, undo, isHidden }
}
