import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { useMe, ME_QUERY_KEY } from '@/data/auth/authHooks'
import { preferencesApi, type CompanionPreferences, type PersonalContext, type AccountUpdate } from '@/data/companion/preferencesApi'

const prefsKey = ['companion-preferences'] as const
const contextKey = ['companion-personal-context'] as const
const emptyPreferences: CompanionPreferences = { aboutMe: '', customInstructions: '', useLearnedProfile: true }
export function useCompanionPreferences() {
  const client = useQueryClient()
  const query = useDualQuery<CompanionPreferences | null>({ queryKey: prefsKey, mockData: emptyPreferences, realEmpty: null, realFetch: preferencesApi.get })
  const mutation = useMutation({
    mutationFn: (body: CompanionPreferences) => isMockMode() ? Promise.resolve(body) : preferencesApi.save(body),
    onSuccess: (data) => {
      client.setQueryData(prefsKey, data)
      client.removeQueries({ queryKey: contextKey, type: 'inactive' })
      if (!isMockMode()) void client.invalidateQueries({ queryKey: contextKey })
    },
  })
  return { ...query, save: mutation.mutateAsync, saving: mutation.isPending, saveError: mutation.isError }
}

export function usePersonalContext() {
  const { data: prefs } = useCompanionPreferences()
  const { data: me } = useMe()
  // The offline preview is intentionally a simulation. Real mode always displays the
  // server assembler's bounded output verbatim, never reconstructs it in the browser.
  const sections: PersonalContext['sections'] = [
    { id: 'core', title: 'Alapadatok', text: me?.name ?? '', included: !!me?.name, source: 'Fiók · demó', editPath: '/settings/account' },
    { id: 'about', title: 'Rólam', text: prefs?.aboutMe ?? '', included: !!prefs?.aboutMe, source: 'Saját bemutatkozás', editPath: '/settings/mezo/about' },
    { id: 'instructions', title: 'Saját instrukció', text: prefs?.customInstructions ?? '', included: !!prefs?.customInstructions, source: 'Saját instrukció', editPath: '/settings/mezo/communication' },
    { id: 'learned', title: 'Tanult kommunikáció', text: '', included: false, source: prefs?.useLearnedProfile ? 'A demóban nincs tanult profil' : 'Kikapcsolva', editPath: '/settings/mezo/communication' },
  ]
  const mockData = { sections, renderedText: sections.filter(s => s.included).map(s => `[${s.title}]\n${s.text}`).join('\n\n') }
  const query = useDualQuery<PersonalContext | null>({ queryKey: contextKey, mockData, realEmpty: null, realFetch: preferencesApi.context })
  return { ...query, data: isMockMode() ? mockData : query.data }
}

export function useAccountSettings() {
  const client = useQueryClient()
  const me = useMe()
  const mutation = useMutation({
    mutationFn: async (body: AccountUpdate) => {
      if (!isMockMode()) return preferencesApi.account(body)
      if (!me.data) throw new Error('A fiók még nem töltődött be.')
      return { ...me.data, ...body }
    },
    onSuccess: (data) => {
      client.setQueryData(ME_QUERY_KEY, data)
      if (!isMockMode()) void client.invalidateQueries({ queryKey: contextKey })
    },
  })
  return { ...me, save: mutation.mutateAsync, saving: mutation.isPending, saveError: mutation.isError }
}
