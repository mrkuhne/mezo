import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { knowledgeApi, toKnowledgeFact, toFactCandidate } from '@/data/insights/knowledgeApi'
import { facts as knowledgeSeed, candidateSeed } from '@/data/insights/knowledge'

describe('knowledgeApi wire mapping', () => {
  it('maps KnowledgeFactResponse onto the FE domain shape', () => {
    const fact = toKnowledgeFact({
      id: 'kf-1',
      factText: 'Laktózérzékeny',
      category: 'health',
      source: 'chat',
      reinforcementCount: 4,
      includeInPrompt: false,
      lastReinforcedAt: null,
      createdAt: '2026-07-03T06:00:00Z',
    })
    expect(fact).toEqual({ id: 'kf-1', text: 'Laktózérzékeny', category: 'health', active: false, reinforced: 4 })
  })

  it('maps FactCandidateResponse onto the FE candidate shape', () => {
    const candidate = toFactCandidate({
      id: 'c-9',
      candidateText: 'Reggel edz szívesen',
      category: 'train',
      userDecision: null,
      refinedText: null,
      promotedFactId: null,
      createdAt: '2026-07-03T06:00:00Z',
    })
    expect(candidate).toEqual({ id: 'c-9', text: 'Reggel edz szívesen', category: 'train' })
  })

  it('lists facts and candidates from the default MSW fixtures (seed mirror)', async () => {
    expect(await knowledgeApi.listFacts()).toEqual(knowledgeSeed)
    expect(await knowledgeApi.listCandidates()).toEqual(candidateSeed)
  })

  it('toggleFact PATCHes includeInPrompt and returns the updated fact', async () => {
    let sentBody: unknown
    server.use(
      http.patch(`${API_BASE}/api/companion/fact/f1`, async ({ request }) => {
        sentBody = await request.json()
        return HttpResponse.json({
          id: 'f1', factText: 'x', category: 'train', source: 'manual',
          reinforcementCount: 1, includeInPrompt: false, lastReinforcedAt: null,
          createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    const updated = await knowledgeApi.toggleFact('f1', false)
    expect(sentBody).toEqual({ includeInPrompt: false })
    expect(updated.includeInPrompt).toBe(false)
  })

  it('decide POSTs the decision with the refined text', async () => {
    let sentBody: unknown
    server.use(
      http.post(`${API_BASE}/api/companion/fact/candidate/c1/decision`, async ({ request }) => {
        sentBody = await request.json()
        return HttpResponse.json({
          id: 'c1', candidateText: 'x', category: 'fuel', userDecision: 'refine',
          refinedText: 'Pontosítva', promotedFactId: 'kf-c1', createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    const decided = await knowledgeApi.decide('c1', 'refine', 'Pontosítva')
    expect(sentBody).toEqual({ decision: 'refine', refinedText: 'Pontosítva' })
    expect(decided.promotedFactId).toBe('kf-c1')
  })
})
