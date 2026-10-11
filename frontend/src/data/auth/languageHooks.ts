import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { authApi, type MeResponse } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { getLang, setLang, useLang, type Lang } from '@/shared/i18n/lang'

interface Rollback { previous: Lang; meBefore: MeResponse | undefined }

/**
 * The interface language as an account preference. Switching is optimistic: the store (and with
 * it the device cache) changes at once, and the cached `me` is updated in the same step so the
 * account-sync effect in `LanguageProvider` sees the new value instead of the stale one while
 * the write is in flight. Mock mode never fetches. A failed real write restores the store, the
 * device cache and the cached `me`; the failure toast is the app's default mutation-error toast.
 *
 * `LanguageProvider` remounts its subtree on a switch, so the calling component unmounts
 * mid-mutation: all handling lives in mutation-level options (kept on the mutation itself),
 * never in per-call callbacks.
 */
export function useLanguageSetting(): { lang: Lang; setLanguage: (l: Lang) => void; pending: boolean } {
  const client = useQueryClient()
  const lang = useLang()
  const mutation = useMutation<MeResponse | undefined, Error, Lang, Rollback>({
    mutationFn: async (next) => (isMockMode() ? undefined : authApi.updateLanguage({ language: next })),
    // Synchronous on purpose: the switch must be visible in the same tick as the tap.
    onMutate: (next) => {
      void client.cancelQueries({ queryKey: ME_QUERY_KEY })
      const meBefore = client.getQueryData<MeResponse>(ME_QUERY_KEY)
      const previous = getLang()
      if (meBefore) client.setQueryData<MeResponse>(ME_QUERY_KEY, { ...meBefore, language: next })
      setLang(next)
      return { previous, meBefore }
    },
    onSuccess: (me) => {
      if (me) client.setQueryData(ME_QUERY_KEY, me)
    },
    onError: (_error, _next, rollback) => {
      if (!rollback) return
      if (rollback.meBefore) client.setQueryData(ME_QUERY_KEY, rollback.meBefore)
      setLang(rollback.previous)
    },
  })
  return { lang, setLanguage: (l) => mutation.mutate(l), pending: mutation.isPending }
}
