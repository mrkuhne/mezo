import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { characterApi, type CharacterCouncilStatusResponse, type CharacterClaimRevisionDto } from '@/data/character/characterApi'
import { MOCK_CLAIM_REVISIONS } from '@/data/character/characterMock'

export function useCharacterCouncilStatus() {
  const query = useDualQuery<CharacterCouncilStatusResponse | null>({
    queryKey: ['characterCouncilStatus'], mockData: null, realEmpty: null,
    realFetch: characterApi.councilStatus, realStaleTime: 30_000,
  })
  const qc = useQueryClient()
  const status = query.data?.status
  useEffect(() => {
    if (isMockMode() || (status !== 'PROCESSING' && status !== 'WAITING')) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void qc.invalidateQueries({ queryKey: ['characterCouncilStatus'] })
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [qc, status])
  useEffect(() => {
    if (isMockMode() || status !== 'COMPLETED') return
    void qc.invalidateQueries({ queryKey: ['characterFeed'] })
    void qc.invalidateQueries({ queryKey: ['characterConferences'] })
  }, [qc, status, query.data?.completedAt])
  return { status: query.data, isLoading: query.isPending, isError: query.isError, refetch: query.refetch }
}

export function useCharacterClaimRevisions(claimId: string) {
  const qc = useQueryClient()
  const key = ['characterClaimRevisions', claimId]
  const query = useDualQuery<CharacterClaimRevisionDto[]>({
    queryKey: key, mockData: MOCK_CLAIM_REVISIONS[claimId] ?? [], realEmpty: [],
    realFetch: () => characterApi.claimRevisions(claimId), realStaleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: characterApi.undoRevision,
    onSuccess: async () => {
      await Promise.all([
        key, ['characterOverview'], ['characterDimension'], ['characterFeed'], ['characterConference'], ['characterReplies'],
      ].map(queryKey => qc.invalidateQueries({ queryKey })))
    },
    onError: () => { void qc.invalidateQueries({ queryKey: key }) },
  })
  return { revisions: query.data, isLoading: query.isPending, isError: query.isError, refetch: query.refetch, undo: mutation.mutateAsync, pending: mutation.isPending }
}
