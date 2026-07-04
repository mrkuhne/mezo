import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { usePeople } from '@/data/me/peopleHooks'
import { mentionDayLabel } from '@/data/me/peopleApi'
import { people as personSeed, mentions as mentionSeed } from '@/data/me/people'
import type { MentionResponse, PeopleResponse, PersonResponse } from '@/data/me/peopleApi'

const WIRE_PERSON: PersonResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Petra',
  initial: 'P',
  relationship: 'partner',
  relationshipHu: 'Élettárs',
  affectBaseline: 'positive',
  contactCadenceLabel: 'Napi',
  notes: 'Közös háztartás.',
  knownFacts: ['ELTE doktorátus'],
  ties: [],
  affectTrend: [4, 5, 4],
  mentionCount: 2,
  mentionsThisWeek: 1,
  lastMentionedAt: '2026-07-03T20:14:00Z',
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

const BOOTSTRAP: PeopleResponse = { persons: [WIRE_PERSON], mentions: [WIRE_MENTION] }

describe('usePeople (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds people + mentions synchronously', () => {
    const { result } = renderHook(() => usePeople(), { wrapper: makeHookWrapper() })
    expect(result.current.people).toEqual(personSeed)
    expect(result.current.mentions).toEqual(mentionSeed)
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
