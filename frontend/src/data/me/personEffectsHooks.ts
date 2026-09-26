import { useDualQuery } from '@/data/useDualQuery'
import { personEffectsApi, toPersonEffect } from '@/data/me/personEffectsApi'
import { MOCK_PERSON_EFFECTS } from '@/data/me/people'
import type { PersonEffect } from '@/data/types'

const EMPTY_EFFECTS: PersonEffect[] = []

/**
 * Dual-mode nevesített hatás-sorok egy személyhez (S4, mezo-d6ivw.4): a
 * `GET /api/companion/effects?personId=` végpont wire→domain leképezéssel. Mock módban a
 * demó-személy (Petra) 3 sort kap, mindenki más üreset. `enabled` csak akkor igaz, ha van
 * `personId` — a PersonDetailPage-en ez mindig adott, de a hook önmagában is védett.
 */
export function usePersonEffects(personId: string | undefined): { effects: PersonEffect[]; isPending: boolean } {
  const { data, isPending } = useDualQuery<PersonEffect[]>({
    queryKey: ['person-effects', personId],
    mockData: personId ? (MOCK_PERSON_EFFECTS[personId] ?? EMPTY_EFFECTS) : EMPTY_EFFECTS,
    realFetch: async () => {
      const res = await personEffectsApi.getForPerson(personId!)
      return res.effects.map(toPersonEffect)
    },
    realEmpty: EMPTY_EFFECTS,
    enabled: !!personId,
  })
  return { effects: data, isPending }
}
