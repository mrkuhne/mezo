import { useQuery } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { memoirApi } from '@/data/insights/memoirApi'
import { memoir as mockMemoir, memoirArchive as mockMemoirArchive, anniversaryNote as mockAnniversaryNote } from '@/data/insights/insights'
import type { Memoir, MemoirEntry } from '@/data/types'

export interface MemoirView {
  memoir: Memoir | null
  /** Mock-only demo copy (deferred epic); always null in live mode. */
  anniversaryNote: string | null
  mode: 'mock' | 'live'
}

/**
 * The weekly memoir (proactive W2). Mock: the Phase-1 seed (byte parity). Live: the latest
 * generated memoir, or null (404/loading/error) — the page renders its honest "készül" state.
 */
export function useMemoir(): MemoirView {
  const mock = isMockMode()
  const q = useQuery<Memoir | null>({
    queryKey: ['memoir'],
    queryFn: mock
      ? async () => mockMemoir
      : async () => {
          try {
            return await memoirApi.latest()
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }
        },
    initialData: mock ? mockMemoir : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { memoir: mockMemoir, anniversaryNote: mockAnniversaryNote, mode: 'mock' }
  }
  return { memoir: q.data ?? null, anniversaryNote: null, mode: 'live' }
}

/**
 * F7.5 (mezo-d20.8.5): the archive shelf — every persisted memoir, newest week first.
 * The switch-off 404 resolves to the honest empty shelf (the archive page renders its
 * "még nincs fejezet" state), never a thrown error.
 */
export function useMemoirArchive() {
  return useDualQuery<MemoirEntry[]>({
    queryKey: ['memoir', 'archive'],
    mockData: mockMemoirArchive,
    realFetch: async () => {
      try {
        return await memoirApi.archive()
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return []
        throw e
      }
    },
    realEmpty: [],
  })
}
