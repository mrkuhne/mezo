import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { peopleApi, toMention, toPersonEntry } from '@/data/me/peopleApi'
import { people as personSeed, mentions as mentionSeed } from '@/data/me/people'
import type { Mention, MentionLogInput, PersonEntry, PersonSaveInput } from '@/data/types'

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
 * S4: `people` is now candidate-filtered (status !== 'candidate'), with a parallel `candidates`
 * array and a `decidePerson(personId, decision)` mutation to accept/reject a candidate.
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
      await peopleApi.logMention(input.personId, input.tone, input.text, input.contextLabel)
    },
    onSuccess: isMockMode() ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })

  const saveM = useMutation({
    mutationFn: async (input: PersonSaveInput) => {
      if (mock) { mockSavePerson(qc, input); return }
      if (input.id) await peopleApi.updatePerson(input.id, input)
      else await peopleApi.createPerson(input)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })
  const delM = useMutation({
    mutationFn: async (personId: string) => {
      if (mock) { mockDeletePerson(qc, personId); return }
      await peopleApi.deletePerson(personId)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })

  const undoM = useMutation({
    mutationFn: async (m: Mention) => {
      if (mock) { mockUndoMention(qc, m.id); return }
      await peopleApi.deleteMention(m.person_id, m.id)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })

  const decideM = useMutation({
    mutationFn: async (input: { personId: string; decision: 'accept' | 'reject' }) => {
      if (mock) { mockDecidePerson(qc, input.personId, input.decision); return }
      await peopleApi.decidePerson(input.personId, input.decision)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })

  return {
    people: data.people.filter(p => p.status !== 'candidate'),
    candidates: data.people.filter(p => p.status === 'candidate'),
    mentions: data.mentions,
    logMention: (input: MentionLogInput) => logM.mutate(input),
    savePerson: (input: PersonSaveInput) => saveM.mutate(input),
    deletePerson: (personId: string) => delM.mutate(personId),
    undoMention: (m: Mention) => undoM.mutate(m),
    decidePerson: (personId: string, decision: 'accept' | 'reject') =>
      decideM.mutate({ personId, decision }),
    isPending,
  }
}

function mockUndoMention(qc: QueryClient, mentionId: string) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    return { ...base, mentions: base.mentions.filter(m => m.id !== mentionId) }
  })
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

function mockSavePerson(qc: QueryClient, input: PersonSaveInput) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    if (input.id) {
      return { ...base, people: base.people.map(p => p.id === input.id
        ? { ...p, ...editable(input, p.contactCadenceLabel), initial: input.name.slice(0, 1).toUpperCase() } : p) }
    }
    const fresh: PersonEntry = {
      id: crypto.randomUUID(), initial: input.name.slice(0, 1).toUpperCase(),
      affect_baseline: input.affectBaseline ?? 'neutral',
      mentionCount: 0, mentionsThisWeek: 0, last_mentioned_at: '',
      lastMentionLabel: 'Még nincs említés', affectTrend: [], knownFacts: [], ties: [],
      status: 'active', sourceKind: 'manual', ...editable(input),
    }
    return { ...base, people: [...base.people, fresh] }
  })
}
// existingCadence: pass-through fallback so PUTs that omit contactCadenceLabel (no
// cadence field in the edit UI) don't blank an already-set value — mirrors the
// keep-when-absent semantics PersonEditSheet.submit applies before calling savePerson.
function editable(i: PersonSaveInput, existingCadence = '') {
  return { name: i.name, aliases: i.aliases, relationship: i.relationship,
    relationshipHu: i.relationshipHu, contactCadenceLabel: i.contactCadenceLabel ?? existingCadence,
    notes: i.notes ?? '' }
}
function mockDeletePerson(qc: QueryClient, personId: string) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    return {
      people: base.people.filter(p => p.id !== personId),
      mentions: base.mentions.filter(m => m.person_id !== personId),
    }
  })
}

function mockDecidePerson(qc: QueryClient, personId: string, decision: 'accept' | 'reject') {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    if (decision === 'reject') {
      return { ...base, people: base.people.filter(p => p.id !== personId) }
    }
    return { ...base, people: base.people.map(p => p.id === personId ? { ...p, status: 'active' } : p) }
  })
}
