import { ApiError } from '@/data/_client/api'
import { emitToast } from '@/shared/lib/toastBus'
import { m } from '@/shared/i18n/catalog'

/** The app's default "save failed" error toast, in the language current at the moment of the call. */
export function emitSaveFailedToast(error: unknown): void {
  const trace = error instanceof ApiError ? error.messages[0]?.exceptionTraceId : undefined
  emitToast({
    kind: 'error',
    text: trace ? m().frame.toast.saveFailedTrace(trace.slice(0, 8)) : m().frame.toast.saveFailed,
  })
}

/**
 * `meta` flag of a mutation that shows its own failure toast (after its own rollback), so the
 * global mutation-error toast stays silent for it.
 */
export const OWN_ERROR_TOAST = 'ownErrorToast'
