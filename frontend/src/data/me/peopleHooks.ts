import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { peopleApi, toMention, toPersonEntry } from '@/data/me/peopleApi'
import { people as personSeed, mentions as mentionSeed } from '@/data/me/people'
import type { Mention, MentionLogInput, PersonEntry } from '@/data/types'

export interface PeopleBootstrap {
  people: PersonEntry[]
  mentions: Mention[]
}

const PEOPLE_KEY = ['people'] as const
const EMPTY_PEOPLE: PeopleBootstrap = { people: [], mentions: [] }
const MOCK_PEOPLE: PeopleBootstrap = { people: personSeed, mentions: mentionSeed }

/**
 * Dual-mode People bootstrap (Slice E, mezo-t16y.2): persons + recent-mention feed in one read
 * (the knowledge pattern). Real mode maps the wire DTOs to the mock-era domain shapes with
 * FE-derived display labels; `logMention` POSTs and invalidates (mock: cache prepend, exactly
 * what the old useState version did). Signature `{ people, mentions, logMention }` is unchanged.
 */
export function usePeople() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data, isPending } = useDualQuery<PeopleBootstrap>({
    queryKey: PEOPLE_KEY,
    mockData: MOCK_PEOPLE,
    realFetch: async () => {
      const res = await peopleApi.bootstrap()
      return { people: res.persons.map(toPersonEntry), mentions: res.mentions.map(toMention) }
    },
    realEmpty: EMPTY_PEOPLE,
  })

  const logM = useMutation({
    mutationFn: async (input: MentionLogInput) => {
      if (mock) {
        mockLogMention(qc, input)
        return
      }
      await peopleApi.logMention(input.personId, input.tone, input.text)
    },
    onSuccess: isMockMode() ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })

  return {
    people: data.people,
    mentions: data.mentions,
    logMention: (input: MentionLogInput) => logM.mutate(input),
    isPending,
  }
}

function mockLogMention(qc: QueryClient, input: MentionLogInput) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    const now = new Date()
    const person = base.people.find(p => p.id === input.personId)
    const newMention: Mention = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      dayLabel: 'Ma',
      timeLabel: now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
      person_id: input.personId,
      personName: person?.name ?? '',
      source: 'chip',
      excerpt: input.text ?? '',
      tone: input.tone,
    }
    return { ...base, mentions: [newMention, ...base.mentions] }
  })
}
