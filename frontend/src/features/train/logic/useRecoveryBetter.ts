import { useState } from 'react'
import type { RecoveryPeriod } from '@/data/train/recoveryApi'
import type { useDiscardRecovery, useRecoveryCheckIn } from '@/data/train/recoveryHooks'
import { useToast } from '@/shared/ui/ToastProvider'
import { KIMELO } from '@/features/train/logic/skipCopy'

/**
 * „Jobban vagyok" (Kímélő mód S2, mezo-q4xt2.2) — one rule for every surface that ends a period
 * (Edzés · Mai hero, the Nap hub's „Hogy vagy?" card and its „Befejezem ›" line):
 * - on the period's START day the server rejects BETTER (a same-day recovery has no return), so
 *   the period is simply discarded, toasting „Kímélő mód befejezve";
 * - later, BETTER ends it today and applies the return rule; `welcome` then turns on so the caller
 *   shows „Üdv újra!" from `period.return`.
 * The caller passes its own mutation instances so its busy flag covers these writes too; a failed
 * write is toasted by the global MutationCache and moves nothing.
 */
export function useRecoveryBetter({ checkIn, discard }: {
  checkIn: ReturnType<typeof useRecoveryCheckIn>
  discard: ReturnType<typeof useDiscardRecovery>
}) {
  const toast = useToast()
  const [welcome, setWelcome] = useState(false)
  const better = (period: RecoveryPeriod | null | undefined) => {
    if (!period || period.endedOn) return
    if (period.dayIndex <= 1) {
      discard.mutate(undefined, { onSuccess: () => toast.show({ kind: 'success', text: KIMELO.toastEnded }) })
    } else {
      checkIn.mutate('BETTER', { onSuccess: () => setWelcome(true) })
    }
  }
  return { better, welcome, closeWelcome: () => setWelcome(false) }
}
