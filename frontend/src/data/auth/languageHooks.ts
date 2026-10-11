import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { emitSaveFailedToast, OWN_ERROR_TOAST } from '@/data/_client/saveFailedToast'
import { authApi, type MeResponse } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { getLang, setLang, useLang, type Lang } from '@/shared/i18n/lang'

/** Where a failed switch returns to: the language and the cached `me` the server last agreed with. */
interface Base { lang: Lang; me: MeResponse | undefined }

// Quick taps (hu -> en -> hu) put several writes in flight, and the remount boundary gives each
// tap a fresh hook instance, so what orders them cannot live in a component. `latest` names the
// newest write: only that one may touch the store or the cached `me` when it settles. `base` is
// the rollback point of the whole chain: taken when the first write of a chain starts, moved
// forward by every write the server confirms.
const LANGUAGE_WRITE = ['auth', 'language-write'] as const
let latest = 0
let base: Base | null = null

/**
 * The interface language as an account preference. Switching is optimistic: the store (and with
 * it the device cache) changes at once, and the cached `me` is updated in the same step so the
 * account sync in `LanguageProvider` sees the new value instead of the stale one while the write
 * is in flight. Mock mode never fetches. A failed real write restores the store, the device cache
 * and the cached `me`, and only then shows the save-failed toast -- in the language the app has
 * rolled back to (the global mutation-error toast fires before the rollback, so this mutation
 * opts out of it).
 *
 * The writes are serialised (`scope`): the server sees them in tap order, and a response that
 * arrives after a newer tap is confirmed silently instead of flipping the app back.
 *
 * `LanguageBoundary` remounts the calling screen on a switch, so the calling component unmounts
 * mid-mutation: all handling lives in mutation-level options (kept on the mutation itself),
 * never in per-call callbacks.
 */
export function useLanguageSetting(): { lang: Lang; setLanguage: (l: Lang) => void; pending: boolean } {
  const client = useQueryClient()
  const lang = useLang()
  const mutation = useMutation<MeResponse | undefined, Error, Lang, number>({
    mutationKey: LANGUAGE_WRITE,
    scope: { id: 'language' },
    meta: { [OWN_ERROR_TOAST]: true },
    mutationFn: async (next) => (isMockMode() ? undefined : authApi.updateLanguage({ language: next })),
    // Synchronous on purpose: the switch must be visible in the same tick as the tap.
    onMutate: (next) => {
      void client.cancelQueries({ queryKey: ME_QUERY_KEY })
      const meBefore = client.getQueryData<MeResponse>(ME_QUERY_KEY)
      // this write is already counted: 1 means no other language write is in flight
      if (client.isMutating({ mutationKey: LANGUAGE_WRITE }) <= 1) base = { lang: getLang(), me: meBefore }
      latest += 1
      if (meBefore) client.setQueryData<MeResponse>(ME_QUERY_KEY, { ...meBefore, language: next })
      setLang(next)
      return latest
    },
    onSuccess: (me, next, seq) => {
      // The server now holds `next`: a later failure returns here, not to where the chain began.
      base = { lang: next, me: me ?? (base?.me ? { ...base.me, language: next } : undefined) }
      if (seq !== latest) return
      if (me) client.setQueryData(ME_QUERY_KEY, me)
    },
    onError: (error, _next, seq) => {
      if (seq === undefined) return
      // A newer tap is in charge: its own outcome decides what the app shows.
      if (seq !== latest || !base) return
      if (base.me) client.setQueryData(ME_QUERY_KEY, base.me)
      setLang(base.lang)
      emitSaveFailedToast(error)
    },
  })
  return { lang, setLanguage: (l) => mutation.mutate(l), pending: mutation.isPending }
}
