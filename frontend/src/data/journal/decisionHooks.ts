import { useMutation, useQueryClient } from '@tanstack/react-query'
import { decisionApi } from '@/data/journal/decisionApi'
import { mockDecisions } from '@/data/journal/decisionMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

const DECISIONS_KEY = ['decisions'] as const

/** A decision is "due" once its review date has arrived and it has not been reviewed yet.
 * `<=` on ISO date strings is a correct chronological comparison and needs no Date parsing. */
export function isDecisionDue(decision: DecisionEntry, todayIso: string): boolean {
  return decision.reviewedAt === null && decision.reviewDue <= todayIso
}

export function useDecisions(): {
  data: DecisionEntry[]
  isPending: boolean
  isError: boolean
  refetch: () => void
} {
  return useDualQuery<DecisionEntry[]>({
    queryKey: [...DECISIONS_KEY],
    mockData: mockDecisions,
    realFetch: () => decisionApi.list(),
    realEmpty: [],
  })
}

export function useDecisionActions(): {
  addDecision: (decisionText: string, decidedOn?: string) => Promise<DecisionEntry>
  reviewDecision: (id: string, outcomeRating: number, outcomeText?: string) => Promise<DecisionEntry>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  const addM = useMutation({
    mutationFn: async (input: { decisionText: string; decidedOn?: string }): Promise<DecisionEntry> => {
      if (mock) {
        const decidedOn = input.decidedOn ?? localDateString()
        // The mock horizon mirrors the backend default (30 days) — a mock-only constant, never a
        // second source of truth for the real reviewDue, which the server always computes.
        const due = new Date(`${decidedOn}T00:00:00`)
        due.setDate(due.getDate() + 30)
        const decision: DecisionEntry = {
          id: `dec-m-${Date.now()}`,
          decidedOn,
          decisionText: input.decisionText,
          reviewDue: due.toISOString().slice(0, 10),
          reviewedAt: null,
          outcomeRating: null,
          outcomeText: null,
          createdAt: new Date().toISOString(),
        }
        qc.setQueryData<DecisionEntry[]>([...DECISIONS_KEY], (d) =>
          [decision, ...(d ?? [])].sort((a, b) => (a.decidedOn < b.decidedOn ? 1 : -1)),
        )
        return decision
      }
      return decisionApi.create(input.decisionText, input.decidedOn)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: [...DECISIONS_KEY] }),
  })

  const reviewM = useMutation({
    mutationFn: async (input: {
      id: string
      outcomeRating: number
      outcomeText?: string
    }): Promise<DecisionEntry> => {
      if (mock) {
        let updated: DecisionEntry | undefined
        qc.setQueryData<DecisionEntry[]>([...DECISIONS_KEY], (d) =>
          (d ?? []).map((row) => {
            if (row.id !== input.id) return row
            updated = {
              ...row,
              outcomeRating: input.outcomeRating,
              outcomeText: input.outcomeText ?? null,
              reviewedAt: new Date().toISOString(),
            }
            return updated
          }),
        )
        return updated!
      }
      return decisionApi.review(input.id, input.outcomeRating, input.outcomeText)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: [...DECISIONS_KEY] }),
  })

  return {
    addDecision: (decisionText: string, decidedOn?: string) => addM.mutateAsync({ decisionText, decidedOn }),
    reviewDecision: (id: string, outcomeRating: number, outcomeText?: string) =>
      reviewM.mutateAsync({ id, outcomeRating, outcomeText }),
    pending: addM.isPending || reviewM.isPending,
  }
}
