import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { usePeople, useTurnFacts } from '@/data/me/peopleHooks'
import { mentionDayLabel } from '@/data/me/peopleApi'
import { people as personSeed, mentions as mentionSeed } from '@/data/me/people'
import type { MentionResponse, PeopleResponse, PersonResponse } from '@/data/me/peopleApi'

const WIRE_PERSON: PersonResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Petra',
  initial: 'P',
  facts: [],
  relationship: 'partner',
  relationshipHu: 'Élettárs',
  aliases: [],
  status: 'active',
  sourceKind: 'manual',
  affectBaseline: 'positive',
  contactCadenceLabel: 'Napi',
  notes: 'Közös háztartás.',
  knownFacts: ['ELTE doktorátus'],
  ties: [],
  affectTrend: [4, 5, 4],
  direction: 'flat',
  mentionCount: 2,
  mentionsThisWeek: 1,
  lastMentionedAt: '2026-07-03T20:14:00Z',
  graphEdges: [],
}

const WIRE_MENTION: MentionResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  ts: '2026-07-03T20:14:00Z',
  personId: WIRE_PERSON.id,
  personName: 'Petra',
  source: 'chip',
  excerpt: 'Hosszú vacsi.',
  tone: 'positive',
  tiedToKind: 'checkin',
  tiedToLabel: 'Esti check-in · 21:00',
  flagged: false,
}

const BOOTSTRAP: PeopleResponse = {
  persons: [WIRE_PERSON],
  mentions: [WIRE_MENTION],
  mezoNote: 'Petra volt a leggyakoribb neved ezen a héten.',
}

describe('usePeople (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds people + mentions synchronously', () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    expect(result.current.people).toEqual(personSeed.filter(p => p.status !== 'candidate'))
    expect(result.current.mentions).toEqual(mentionSeed)
  })

  it('deletePerson removes person and their mentions (mock mode)', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const victim = result.current.people[0]
    act(() => result.current.deletePerson(victim.id))
    await waitFor(() => {
      expect(result.current.people.map(p => p.id)).not.toContain(victim.id)
      expect(result.current.mentions.every(m => m.person_id !== victim.id)).toBe(true)
    })
  })

  it('undoMention removes just that mention from the cache (mock mode)', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const victim = result.current.mentions[0]
    act(() => result.current.undoMention(victim))
    await waitFor(() => {
      expect(result.current.mentions.map(m => m.id)).not.toContain(victim.id)
    })
  })

  it('usePeople splits candidates from the circle', () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const candidateSeed = personSeed.filter(p => p.status === 'candidate')
    const activeSeed = personSeed.filter(p => p.status !== 'candidate')
    expect(result.current.candidates).toEqual(candidateSeed)
    expect(result.current.candidates.length).toBeGreaterThan(0)
    expect(result.current.people).toHaveLength(activeSeed.length)
    expect(result.current.people.some(p => p.status === 'candidate')).toBe(false)
  })

  it('decidePerson accept activates the candidate (mock)', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const candidate = result.current.candidates[0]
    act(() => result.current.decidePerson(candidate.id, 'accept'))
    await waitFor(() => {
      expect(result.current.candidates.map(p => p.id)).not.toContain(candidate.id)
      const activated = result.current.people.find(p => p.id === candidate.id)
      expect(activated?.status).toBe('active')
    })
  })

  it('decidePerson reject removes the candidate (mock)', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const candidate = result.current.candidates[0]
    act(() => result.current.decidePerson(candidate.id, 'reject'))
    await waitFor(() => {
      expect(result.current.candidates.map(p => p.id)).not.toContain(candidate.id)
      expect(result.current.people.map(p => p.id)).not.toContain(candidate.id)
    })
  })

  // --- S3 person facts (mock) ---

  it('seeds facts on persons; undoFact removes the fact from the cache', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const petra = result.current.people.find(p => p.id === 'pp-petra')!
    expect(petra.facts.length).toBeGreaterThan(0)
    const victim = petra.facts[0]
    act(() => result.current.undoFact('pp-petra', victim.id))
    await waitFor(() => {
      const after = result.current.people.find(p => p.id === 'pp-petra')!
      expect(after.facts.map(f => f.id)).not.toContain(victim.id)
    })
  })

  it('toggleFact flips includeInPrompt in place', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    const fact = result.current.people.find(p => p.id === 'pp-petra')!.facts[0]
    expect(fact.includeInPrompt).toBe(true)
    act(() => result.current.toggleFact('pp-petra', fact.id, false))
    await waitFor(() => {
      const after = result.current.people.find(p => p.id === 'pp-petra')!
      expect(after.facts.find(f => f.id === fact.id)?.includeInPrompt).toBe(false)
    })
  })

  it('markFactsSeen sets seen=true on that person\'s facts', async () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    expect(result.current.people.find(p => p.id === 'pp-petra')!.facts.some(f => !f.seen)).toBe(true)
    act(() => result.current.markFactsSeen('pp-petra'))
    await waitFor(() => {
      const after = result.current.people.find(p => p.id === 'pp-petra')!
      expect(after.facts.every(f => f.seen)).toBe(true)
    })
  })

  it('useTurnFacts returns the demo fact immediately in mock mode', () => {
    const { result } = renderHook(() => useTurnFacts('msg-1'), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(false)
    expect(result.current.facts.length).toBeGreaterThan(0)
    const empty = renderHook(() => useTurnFacts(null), { wrapper: makeHookWrapper() })
    expect(empty.result.current.facts).toEqual([])
  })
})

describe('usePeople (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('maps the wire bootstrap to domain shapes with derived labels — never the mock seed', async () => {
    server.use(http.get(`${API_BASE}/api/people`, () => HttpResponse.json(BOOTSTRAP)))
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    // unresolved window: realEmpty, not the seed
    expect(result.current.people).toEqual([])
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    const p = result.current.people[0]
    expect(p).toMatchObject({
      id: WIRE_PERSON.id, name: 'Petra', affect_baseline: 'positive',
      mentionCount: 2, mentionsThisWeek: 1, knownFacts: ['ELTE doktorátus'],
    })
    expect(p.lastMentionLabel).toContain('·') // derived "day · time" label
    const m = result.current.mentions[0]
    expect(m).toMatchObject({
      person_id: WIRE_PERSON.id, personName: 'Petra', source: 'chip',
      tone: 'positive', excerpt: 'Hosszú vacsi.',
      tiedTo: { kind: 'checkin', label: 'Esti check-in · 21:00' },
    })
    expect(m.flagged).toBeUndefined() // wire false → undefined (mock-shape parity)
  })

  it('renders "Még nincs említés" when a person has no mentions yet', async () => {
    server.use(http.get(`${API_BASE}/api/people`, () => HttpResponse.json({
      persons: [{ ...WIRE_PERSON, mentionCount: 0, mentionsThisWeek: 0, lastMentionedAt: undefined }],
      mentions: [],
    })))
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    expect(result.current.people[0].lastMentionLabel).toBe('Még nincs említés')
    expect(result.current.people[0].last_mentioned_at).toBe('')
  })

  it('logMention POSTs to the person mention endpoint and refetches the bootstrap', async () => {
    let posted: unknown = null
    let gets = 0
    server.use(
      http.get(`${API_BASE}/api/people`, () => { gets++; return HttpResponse.json(BOOTSTRAP) }),
      http.post(`${API_BASE}/api/people/${WIRE_PERSON.id}/mentions`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(WIRE_MENTION, { status: 201 })
      }),
    )
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    const getsBefore = gets
    act(() => result.current.logMention({ personId: WIRE_PERSON.id, tone: 'mixed', text: 'Nehéz nap.' }))
    await waitFor(() => expect(posted).toEqual({ tone: 'mixed', text: 'Nehéz nap.' }))
    await waitFor(() => expect(gets).toBeGreaterThan(getsBefore)) // invalidation → server-truth refetch
  })

  it('undoMention DELETEs the mention and refetches the bootstrap (real mode)', async () => {
    let deleted: { personId?: string; mentionId?: string } = {}
    let gets = 0
    server.use(
      http.get(`${API_BASE}/api/people`, () => { gets++; return HttpResponse.json(BOOTSTRAP) }),
      http.delete(`${API_BASE}/api/people/:personId/mentions/:mentionId`, ({ params }) => {
        deleted = { personId: params.personId as string, mentionId: params.mentionId as string }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mentions).toHaveLength(1))
    const getsBefore = gets
    act(() => result.current.undoMention(result.current.mentions[0]))
    await waitFor(() => expect(deleted).toEqual({ personId: WIRE_PERSON.id, mentionId: WIRE_MENTION.id }))
    await waitFor(() => expect(gets).toBeGreaterThan(getsBefore))
  })

  it('decidePerson POSTs the decision and refetches the bootstrap (real mode)', async () => {
    let posted: unknown = null
    let gets = 0
    server.use(
      http.get(`${API_BASE}/api/people`, () => { gets++; return HttpResponse.json(BOOTSTRAP) }),
      http.post(`${API_BASE}/api/people/${WIRE_PERSON.id}/decision`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ...WIRE_PERSON, status: 'active' })
      }),
    )
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    const getsBefore = gets
    act(() => result.current.decidePerson(WIRE_PERSON.id, 'accept'))
    await waitFor(() => expect(posted).toEqual({ decision: 'accept' }))
    await waitFor(() => expect(gets).toBeGreaterThan(getsBefore)) // invalidation → server-truth refetch
  })

  it('undoFact DELETEs the fact endpoint and refetches (real mode)', async () => {
    let deleted: { personId?: string; factId?: string } = {}
    let gets = 0
    server.use(
      http.get(`${API_BASE}/api/people`, () => { gets++; return HttpResponse.json(BOOTSTRAP) }),
      http.delete(`${API_BASE}/api/people/:personId/facts/:factId`, ({ params }) => {
        deleted = { personId: params.personId as string, factId: params.factId as string }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    const getsBefore = gets
    act(() => result.current.undoFact(WIRE_PERSON.id, 'fact-1'))
    await waitFor(() => expect(deleted).toEqual({ personId: WIRE_PERSON.id, factId: 'fact-1' }))
    await waitFor(() => expect(gets).toBeGreaterThan(getsBefore))
  })

  it('useTurnFacts polls the source-fetch endpoint until facts arrive (real mode)', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/people/facts`, ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('sourceRefKind')).toBe('chat_turn')
      expect(url.searchParams.get('sourceRefId')).toBe('msg-9')
      calls++
      return HttpResponse.json([{
        id: 'pf-1', personId: WIRE_PERSON.id, kind: 'preference', factText: 'Szereti a teát',
        confidence: 'high', sourceRefKind: 'chat_turn', active: true, includeInPrompt: true,
        seen: false, createdAt: '2026-07-03T20:20:00Z',
      }])
    }))
    const { result } = renderHook(() => useTurnFacts('msg-9'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.facts).toHaveLength(1))
    expect(result.current.facts[0]).toMatchObject({ text: 'Szereti a teát', sourceKind: 'chat_turn' })
    expect(result.current.pending).toBe(false)
    expect(calls).toBe(1) // találat után nincs további poll
  })

  it('savePerson creates then refetches (real mode)', async () => {
    let persons: PersonResponse[] = [WIRE_PERSON]
    server.use(
      http.get(`${API_BASE}/api/people`, () => HttpResponse.json({ persons, mentions: [WIRE_MENTION] })),
      http.post(`${API_BASE}/api/people`, async ({ request }) => {
        const req = (await request.json()) as { name: string }
        const created: PersonResponse = {
          ...WIRE_PERSON, id: crypto.randomUUID(), name: req.name, initial: req.name[0],
        }
        persons = [...persons, created]
        return HttpResponse.json(created, { status: 201 })
      }),
    )
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    act(() => result.current.savePerson({
      name: 'Marci', aliases: ['Marcika'], relationship: 'friend', relationshipHu: 'Barát',
    }))
    await waitFor(() => expect(result.current.people.map(p => p.name)).toContain('Marci'))
  })
})

describe('mentionDayLabel', () => {
  it('derives Ma / Tegnap / weekday / month-day buckets', () => {
    const now = new Date('2026-07-04T12:00:00')
    expect(mentionDayLabel('2026-07-04T08:00:00', now)).toBe('Ma')
    expect(mentionDayLabel('2026-07-03T22:00:00', now)).toBe('Tegnap')
    expect(mentionDayLabel('2026-07-01T10:00:00', now)).toBe('szerda')
    expect(mentionDayLabel('2026-05-15T10:00:00', now)).toMatch(/máj/)
  })
})
