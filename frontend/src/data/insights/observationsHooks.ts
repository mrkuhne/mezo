import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { observationsApi } from '@/data/insights/observationsApi'
import { observations as mockObservations } from '@/data/insights/observations'
import type { Observation, ObservationChoice } from '@/data/types'

/** Prefix key — every day's feed hangs under it, so one invalidate refreshes them all. */
export const OBSERVATIONS_KEY = ['observations']

export interface ObservationsBootstrap {
  observations: Observation[]
  degraded: boolean
}

const MOCK_OBSERVATIONS: ObservationsBootstrap = { observations: mockObservations, degraded: false }
const EMPTY_OBSERVATIONS: ObservationsBootstrap = { observations: [], degraded: false }

/**
 * A nap észrevétel-feedje (Reflexió S5, mezo-eq85.5) — a Nap→Mezo oldal harmadik füle.
 *
 * A szerver MÁR rendezve adja a listát (fresh → return → watching → confirmed, csoporton
 * belül a legfrissebb elöl); itt nem rendezünk újra. Egy `monitoring` sor jogosan
 * szerepelhet KÉTSZER (esemény-kártya + sor-kártya) — a lista kulcsa ezért `item.id`.
 * Kikapcsolt társ (404) ⇒ `degraded`, nem hiba.
 */
export function useObservations(date?: string) {
  const { data, isPending, isError, refetch } = useDualQuery<ObservationsBootstrap>({
    queryKey: [...OBSERVATIONS_KEY, date ?? 'today'],
    mockData: MOCK_OBSERVATIONS,
    realFetch: async () => {
      try {
        return { observations: await observationsApi.list(date), degraded: false }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { ...EMPTY_OBSERVATIONS, degraded: true }
        throw e
      }
    },
    realEmpty: EMPTY_OBSERVATIONS,
  })
  return { ...data, isPending, isError, refetch }
}

/**
 * A chip-válasz (Igen, figyeld / Nem stimmel / Mesélj).
 *
 * A szerver oldalon NEM idempotens — a hívó felület felel azért, hogy egy kártyán egyszer
 * fusson le (a chip-csoport tiltása a `pending` alatt + a válasz utáni elrejtés).
 * `talk` ágon a válasz beszélgetés-azonosítót hoz, amire a hívó navigál.
 */
export function useObservationReply() {
  const queryClient = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async ({ patternId, choice, text }: {
      patternId: string; choice: ObservationChoice; text?: string
    }): Promise<{ conversationId?: string }> => {
      if (mock) {
        queryClient.setQueriesData<ObservationsBootstrap>({ queryKey: OBSERVATIONS_KEY }, (current) =>
          current
            ? {
                ...current,
                observations: current.observations.map((o) =>
                  o.patternId === patternId ? { ...o, repliedChoice: choice } : o,
                ),
              }
            : current,
        )
        return choice === 'talk' ? { conversationId: 'mock-conv' } : {}
      }
      const res = await observationsApi.reply(patternId, choice, text)
      queryClient.invalidateQueries({ queryKey: OBSERVATIONS_KEY })
      return { conversationId: res.conversationId ?? undefined }
    },
  })

  return {
    reply: (patternId: string, choice: ObservationChoice, text?: string) =>
      mutation.mutateAsync({ patternId, choice, text }),
    /** Melyik sor válasza van épp úton — a kártya ezzel tiltja a saját chipjeit. */
    pendingPatternId: mutation.isPending ? mutation.variables?.patternId : undefined,
  }
}
