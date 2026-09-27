import { describe, expect, it } from 'vitest'
import { groupEffectSubjects, toKnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import type { components } from '@/data/_client/api.gen'

type EffectResponse = components['schemas']['EffectResponse']
const row = (over: Partial<EffectResponse>): EffectResponse => ({
  metric: 'mental', direction: 'higher', strengthBand: 'kozepes', confidenceTier: 'kozepes',
  meanDiff: 0.6, subjectDays: 11, complementDays: 40, computedAt: '2026-09-27T03:40:00Z',
  subjectKind: 'person', subjectKey: 'p-anya', subjectLabel: 'Anya', muted: false, ...over,
})

describe('groupEffectSubjects', () => {
  it('folds the flat rows into one subject per (kind, key), keeping row order inside', () => {
    const subjects = groupEffectSubjects([
      row({ metric: 'mental' }),
      row({ subjectKind: 'event', subjectKey: 'edzes', subjectLabel: 'Edzésnapok', metric: 'stress', direction: 'lower' }),
      row({ metric: 'stress' }),
    ])
    expect(subjects).toHaveLength(2)
    expect(subjects[0]).toMatchObject({ kind: 'person', key: 'p-anya', label: 'Anya', muted: false })
    expect(subjects[0].effects.map((e) => e.metric)).toEqual(['mental', 'stress'])
    expect(subjects[1]).toMatchObject({ kind: 'event', key: 'edzes', label: 'Edzésnapok' })
  })

  it('drops rows without a label (the server already does; the FE never invents a name)', () => {
    expect(groupEffectSubjects([row({ subjectLabel: null })])).toEqual([])
  })

  it('a subject is muted when any of its rows says so', () => {
    expect(groupEffectSubjects([row({ muted: true })])[0].muted).toBe(true)
  })
})

describe('toKnowledgeObservation', () => {
  it('maps the wire and runs evidence through mapEvidence', () => {
    const o = toKnowledgeObservation({
      patternId: 'o1', title: 'A késői vacsora és a felszínes alvás együtt mozog.',
      confirmedAt: '2026-08-30T08:00:00Z', recheckedAt: null, status: 'confirmed',
      factId: 'f1', factMutedReason: null, factMutedAt: null, replacesPatternId: null,
      replacedByPatternId: null, topicKey: 'alvas-vacsora',
      evidence: [{ type: 'tag', text: 'r=0,4' }, { type: 'record', source: 'sleep_log', date: '2026-09-20', fields: {} }],
    })
    expect(o).toMatchObject({ patternId: 'o1', factId: 'f1', topicKey: 'alvas-vacsora' })
    expect(o.evidence[0]).toEqual({ kind: 'tag', text: 'r=0,4' })
    expect(o.evidence[1]).toMatchObject({ kind: 'record', date: '2026-09-20' })
    expect(o.evidenceSources).toEqual(['sleep_log'])
  })
})
