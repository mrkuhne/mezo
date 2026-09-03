import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useWorkshop } from '@/data/fuel/workshopHooks'
import { buildPickables } from '@/data/fuel/pantryPickables'
import { ingredients } from '@/data/fuel/pantry'
import { supplementsStash } from '@/data/fuel/fuel'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { WorkshopDraft } from '@/data/types'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('useWorkshop (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('round 1 (draft null) returns a draft whose every pantry line refId resolves against the mock pantry pool', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWorkshop())
    const promise = result.current.workshopTurn({ message: 'csirkés tál', goal: null, history: [], draft: null })
    await vi.advanceTimersByTimeAsync(700)
    const turn = await promise
    expect(turn.draft.lines.length).toBeGreaterThan(0)
    const pool = buildPickables(ingredients, supplementsStash)
    const pantryLines = turn.draft.lines.filter(l => l.source === 'pantry')
    expect(pantryLines.length).toBeGreaterThanOrEqual(3)
    for (const line of pantryLines) {
      expect(pool.some(p => p.id === line.refId)).toBe(true)
    }
    // the one estimate line carries its own totals, not a pantry ref
    const estimateLines = turn.draft.lines.filter(l => l.source === 'estimate')
    expect(estimateLines.length).toBeGreaterThanOrEqual(1)
    expect(estimateLines[0].est).toBeDefined()
  })

  it('a goal turn preserves a manually-edited amount on a line the goal tweak does not touch', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWorkshop())
    const round1Promise = result.current.workshopTurn({ message: 'csirkés tál', goal: null, history: [], draft: null })
    await vi.advanceTimersByTimeAsync(700)
    const round1 = await round1Promise

    // Manually bump the túró line's amount — high_protein only touches chicken/rice.
    const editedDraft: WorkshopDraft = {
      ...round1.draft,
      lines: round1.draft.lines.map(l => (l.name.includes('Túró') ? { ...l, amount: 999 } : l)),
    }
    const editedTuroAmount = editedDraft.lines.find(l => l.name.includes('Túró'))!.amount
    expect(editedTuroAmount).toBe(999)

    const goalPromise = result.current.workshopTurn({ message: 'legyen fehérjedúsabb', goal: 'high_protein', history: [], draft: editedDraft })
    await vi.advanceTimersByTimeAsync(700)
    const goalTurn = await goalPromise

    const turoLine = goalTurn.draft.lines.find(l => l.name.includes('Túró'))
    expect(turoLine?.amount).toBe(999)
    // sanity: the goal tweak did actually touch chicken/rice
    const chickenLine = goalTurn.draft.lines.find(l => l.name.includes('Csirke'))
    const originalChicken = round1.draft.lines.find(l => l.name.includes('Csirke'))!
    expect(chickenLine?.amount).toBe(originalChicken.amount + 60)
  })

  it('a before_bed goal turn merges the rice→túró swap into the existing túró line (no duplicate refId)', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWorkshop())
    const round1Promise = result.current.workshopTurn({ message: 'csirkés tál', goal: null, history: [], draft: null })
    await vi.advanceTimersByTimeAsync(700)
    const round1 = await round1Promise

    const beforeBedPromise = result.current.workshopTurn({
      message: 'legyen lefekvés előttre jó', goal: 'before_bed', history: [], draft: round1.draft,
    })
    await vi.advanceTimersByTimeAsync(700)
    const beforeBedTurn = await beforeBedPromise

    const refIds = beforeBedTurn.draft.lines.map(l => l.refId).filter((id): id is string => id != null)
    expect(new Set(refIds).size).toBe(refIds.length)
    expect(beforeBedTurn.draft.lines.some(l => l.name.includes('Rizs') || l.name.includes('rizs'))).toBe(false)
    const turoLines = beforeBedTurn.draft.lines.filter(l => l.name.includes('Túró'))
    expect(turoLines.length).toBe(1)
  })
})

describe('useWorkshop (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('workshopTurn POSTs to /api/recipe/workshop/turn', async () => {
    let posted = false
    const wireDraft = {
      name: 'Teszt recept', category: 'lunch', servings: 2, steps: [],
      lines: [{ source: 'pantry', pantryItemId: 'ing-csirkemell', name: 'Csirke', amount: 200, unit: 'g', kcal: null, proteinG: null, carbsG: null, fatG: null }],
    }
    server.use(http.post(`${API_BASE}/api/recipe/workshop/turn`, async ({ request }) => {
      posted = true
      const body = await request.json()
      expect(body).toMatchObject({ message: 'szia', goal: null, draft: null })
      return HttpResponse.json({ reply: 'ok', draft: wireDraft })
    }))
    const { result } = renderHook(() => useWorkshop())
    await act(async () => {
      const turn = await result.current.workshopTurn({ message: 'szia', goal: null, history: [], draft: null })
      expect(turn.reply).toBe('ok')
      expect(turn.draft.name).toBe('Teszt recept')
    })
    expect(posted).toBe(true)
  })

  it('workshopTurn caps a long history at the last 20 turns (contract @Size maxItems 20)', async () => {
    let postedHistory: unknown[] = []
    const longHistory: { role: 'user' | 'assistant'; text: string }[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: `turn ${i}`,
    }))
    server.use(http.post(`${API_BASE}/api/recipe/workshop/turn`, async ({ request }) => {
      const body = await request.json() as { history: unknown[] }
      postedHistory = body.history
      return HttpResponse.json({
        reply: 'ok',
        draft: { name: 'X', category: 'lunch', servings: 1, steps: [], lines: [] },
      })
    }))
    const { result } = renderHook(() => useWorkshop())
    await act(async () => {
      await result.current.workshopTurn({ message: 'szia', goal: null, history: longHistory, draft: null })
    })
    expect(postedHistory).toHaveLength(20)
    expect(postedHistory).toEqual(longHistory.slice(-20))
  })
})
