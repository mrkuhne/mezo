import { describe, expect, it, vi } from 'vitest'
import { facts as factSeed } from '@/data/insights/knowledge'
import { people as personSeed } from '@/data/me/people'
import { MOCK_EFFECT_SUBJECTS, MOCK_OBSERVATIONS } from '@/data/insights/knowledgeHub'
import { hubCounts, obsState, type Loadable } from '@/features/insights/logic/hubCounts'
import { heroNote, tileSub } from '@/features/insights/logic/hubCopy'

const ok = <T,>(items: T): Loadable<T> => ({ items, degraded: false, isPending: false, isError: false, refetch: vi.fn() })
const off = <T,>(empty: T): Loadable<T> => ({ ...ok(empty), degraded: true })
const err = <T,>(empty: T): Loadable<T> => ({ ...ok(empty), isError: true })
const loading = <T,>(empty: T): Loadable<T> => ({ ...ok(empty), isPending: true })

const personFacts = personSeed.flatMap((p) => p.facts)
const factMuted = factSeed.filter((f) => !f.active).length
const personMuted = personFacts.filter((f) => !f.includeInPrompt).length
const effectMuted = MOCK_EFFECT_SUBJECTS.filter((s) => s.muted).length
const obsMuted = MOCK_OBSERVATIONS.filter((o) => obsState(o) !== 'igaz').length

describe('hubCounts', () => {
  it('with all four ok, counts facts + person facts + effect subjects — observations once, via their fact', () => {
    const c = hubCounts(ok(factSeed), ok(personSeed), ok(MOCK_OBSERVATIONS), ok(MOCK_EFFECT_SUBJECTS))
    expect(c.total).toBe(factSeed.length + personFacts.length + MOCK_EFFECT_SUBJECTS.length)
    expect(c.muted).toBe(factMuted + personMuted + effectMuted)
    expect(c.note).toBe(heroNote('ok'))
    expect(c.hero).toBe('number')
  })

  it('with facts off, the observations are counted and the note says so', () => {
    const c = hubCounts(off([]), ok(personSeed), ok(MOCK_OBSERVATIONS), ok(MOCK_EFFECT_SUBJECTS))
    expect(c.sections.facts.state).toBe('off')
    expect(c.total).toBe(personFacts.length + MOCK_OBSERVATIONS.length + MOCK_EFFECT_SUBJECTS.length)
    expect(c.muted).toBe(personMuted + obsMuted + effectMuted)
    expect(c.note).toBe(heroNote('off'))
  })

  it('with effects failing, the effect section is left out and the note is partial', () => {
    const c = hubCounts(ok(factSeed), ok(personSeed), ok(MOCK_OBSERVATIONS), err([]))
    expect(c.sections.effects.state).toBe('error')
    expect(c.total).toBe(factSeed.length + personFacts.length)
    expect(c.note).toBe(heroNote('partial'))
  })

  it('a still-loading section contributes nothing; all loading → the hero shows no number', () => {
    const some = hubCounts(loading([]), ok(personSeed), ok(MOCK_OBSERVATIONS), ok(MOCK_EFFECT_SUBJECTS))
    expect(some.sections.facts.state).toBe('loading')
    expect(some.note).toBe(heroNote('partial'))
    expect(some.hero).toBe('number')
    expect(hubCounts(loading([]), loading([]), loading([]), loading([])).hero).toBe('loading')
  })

  it('no section counted and none loading (all failed) → unavailable, never a 0', () => {
    expect(hubCounts(err([]), err([]), err([]), err([])).hero).toBe('unavailable')
    expect(hubCounts(off([]), err([]), off([]), off([])).hero).toBe('unavailable')
  })

  it('no section counted but facts still loading (rest failed) → loading, not a number', () => {
    expect(hubCounts(loading([]), err([]), err([]), err([])).hero).toBe('loading')
  })

  it('the observation tile sub for the mock seeds: 3 still true, the drift pair\'s older half superseded, the refuted one muted', () => {
    const c = hubCounts(ok(factSeed), ok(personSeed), ok(MOCK_OBSERVATIONS), ok(MOCK_EFFECT_SUBJECTS))
    expect(c.sections.observations.sub).toBe(tileSub.observations(3, 1, 1))
  })

  it('obsState: superseded fact or a newer replacement → felul; refuted / user-muted → elh', () => {
    const base = MOCK_OBSERVATIONS[0]
    expect(obsState(base)).toBe('igaz')
    expect(obsState({ ...base, factMutedReason: 'superseded' })).toBe('felul')
    expect(obsState({ ...base, replacedByPatternId: 'x' })).toBe('felul')
    expect(obsState({ ...base, factMutedReason: 'user' })).toBe('elh')
    expect(obsState({ ...base, status: 'refuted' })).toBe('elh')
  })
})
