// Weekly review (mezo-p2tr) — dual-mode read of the AI-generated weekly review + its digest,
// plus the on-demand regenerate action. MOCK: the deterministic demo week's seed (re-dated per
// startIso, null for the CURRENT week — see weeklyReviewMock.ts). REAL: 404 on the review GET is
// the honest "not generated yet" state (`review: null`, never a thrown error — the
// isSwitchedOff-style 404-tolerant fetch idiom); the digest GET never 404s.
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { weeklyReviewApi } from '@/data/me/weeklyReviewApi'
import {
  mockWeeklyReview,
  mockWeeklyReviewDigest,
  type WeeklyReview,
  type WeeklyReviewDigest,
} from '@/data/me/weeklyReviewMock'

export type { WeeklyReview, WeeklyReviewDigest }

const EMPTY_DIGEST: WeeklyReviewDigest = { patterns: [], newFacts: [], lifeEvents: [], memoir: false, predictions: [] }

export interface WeeklyReviewBootstrap {
  /** null = not generated yet (404) or the real-mode fetch hasn't resolved — never fabricated. */
  review: WeeklyReview | null
  digest: WeeklyReviewDigest | null
  /** Real mode only — mock mode has no backend to regenerate against and resolves immediately. */
  regenerate: () => Promise<void>
  regenerating: boolean
  mode: 'mock' | 'live'
  /** Additive (mezo-d20.6.10): the Heti detail pages owe a skeleton and a retryable
   *  error instead of reading an unresolved/failed fetch as an honest empty week
   *  (handoff §4, the "töltés / hiba — ma egyik sincs" row). True while EITHER read is
   *  unresolved / has failed. Mock mode seeds synchronously, so both stay false there. */
  isPending: boolean
  isError: boolean
  refetch: () => void
}

/** `startIso` — ISO Monday of the week to load. */
export function useWeeklyReview(startIso: string): WeeklyReviewBootstrap {
  const mock = isMockMode()
  const qc = useQueryClient()
  const [regenerating, setRegenerating] = useState(false)

  const { data: review, isPending: reviewPending, isError: reviewError, refetch: refetchReview } = useDualQuery<WeeklyReview | null>({
    queryKey: ['weeklyReview', startIso],
    mockData: mockWeeklyReview(startIso),
    realFetch: async () => {
      try {
        return await weeklyReviewApi.get(startIso)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    realEmpty: null,
  })

  const { data: digest, isPending: digestPending, isError: digestError, refetch: refetchDigest } = useDualQuery<WeeklyReviewDigest>({
    queryKey: ['weeklyReviewDigest', startIso],
    mockData: mockWeeklyReviewDigest(startIso),
    realFetch: () => weeklyReviewApi.digest(startIso),
    realEmpty: EMPTY_DIGEST,
  })

  const regenerate = useCallback(async () => {
    // Mock mode has no backend row to regenerate — the "Frissítsd az elemzést" affordance is a
    // real-mode-only surface (a mock review is never `stale`), so there is nothing to await here.
    if (mock) return
    setRegenerating(true)
    try {
      await weeklyReviewApi.regenerate(startIso)
      await qc.invalidateQueries({ queryKey: ['weeklyReview', startIso] })
    } finally {
      setRegenerating(false)
    }
  }, [mock, qc, startIso])

  const refetch = useCallback(() => { refetchReview(); refetchDigest() }, [refetchReview, refetchDigest])

  return {
    review, digest, regenerate, regenerating, mode: mock ? 'mock' : 'live',
    isPending: reviewPending || digestPending,
    isError: reviewError || digestError,
    refetch,
  }
}
