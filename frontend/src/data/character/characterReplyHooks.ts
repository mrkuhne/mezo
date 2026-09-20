import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import {
  characterApi,
  type CharacterReplySource,
  type CharacterReplyResponse,
} from '@/data/character/characterApi'

export function useCharacterReplies(source: CharacterReplySource) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const key = useMemo(
    () => ['characterReplies', source.sourceType, source.sourceId, source.sourceIndex],
    [source.sourceType, source.sourceId, source.sourceIndex],
  )
  const query = useDualQuery<CharacterReplyResponse[]>({
    queryKey: key,
    mockData: [],
    realEmpty: [],
    realFetch: () => characterApi.replies(source),
    realStaleTime: 0,
  })
  const hasPending = query.data.some((reply) => reply.status === 'SAVED' || reply.status === 'PROCESSING')
  // Poll only mounted, unfinished threads. A saved reply remains visible across refetches.
  useEffect(() => {
    if (mock || !hasPending) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void qc.invalidateQueries({ queryKey: key })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [hasPending, key, mock, qc])
  const completed = query.data
    .filter((reply) => reply.status === 'COMPLETED')
    .map((reply) => reply.id)
    .join(',')
  useEffect(() => {
    if (!completed || mock) return
    for (const queryKey of [['characterOverview'], ['characterDimension'], ['characterFeed']])
      void qc.invalidateQueries({ queryKey })
  }, [completed, mock, qc])
  async function store(reply: CharacterReplyResponse) {
    await qc.cancelQueries({ queryKey: key })
    qc.setQueryData<CharacterReplyResponse[]>(key, (old) =>
      [...(old ?? []).filter((item) => item.id !== reply.id), reply].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    )
  }
  const send = useMutation({
    mutationFn: async ({ text, clientRequestId }: { text: string; clientRequestId: string }) => {
      if (!mock) return characterApi.reply({ ...source, text, clientRequestId })
      return {
        ...source,
        id: clientRequestId,
        text,
        sourceText: 'Bemutató bejegyzés',
        createdAt: new Date().toISOString(),
        authorName: 'Te',
        status: 'NEEDS_CLARIFICATION',
        outcome: 'NEEDS_CLARIFICATION',
        outcomeText:
          'Bemutató mód: a válasz rögzítve ebben a munkamenetben. Valódi AI-feldolgozás az éles módban történik.',
      } satisfies CharacterReplyResponse
    },
    onSuccess: store,
  })
  const retry = useMutation({ mutationFn: characterApi.retryReply, onSuccess: store })
  return {
    replies: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    pending: send.isPending || retry.isPending,
    send: (text: string, clientRequestId: string) => send.mutateAsync({ text, clientRequestId }),
    retry: (id: string) => retry.mutateAsync(id),
  }
}

/** Session-local draft state shares the authenticated query cache (cleared on logout).
 * Survives route/filter/collapse remounts, including uncertain network outcomes. */
export function useCharacterReplyDraft(source: CharacterReplySource) {
  const qc = useQueryClient()
  const key = ['characterReplyDraft', source.sourceType, source.sourceId, source.sourceIndex]
  const query = useQuery({
    queryKey: key,
    queryFn: async () => ({ text: '', requestId: '' }),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const data = query.data ?? { text: '', requestId: '' }
  const [draft, setText] = useState(data.text)
  useEffect(() => {
    setText(data.text)
  }, [data.text])
  function setDraft(text: string) {
    const current = qc.getQueryData<typeof data>(key) ?? data
    qc.setQueryData(key, { text, requestId: text === current.text ? current.requestId : '' })
    setText(text)
  }
  function requestId() {
    const current = qc.getQueryData<typeof data>(key) ?? data
    if (current.requestId) return current.requestId
    const id = crypto.randomUUID()
    qc.setQueryData(key, { ...current, requestId: id })
    return id
  }
  return {
    draft,
    setDraft,
    requestId,
    clearDraft: (submittedId: string) => {
      if (qc.getQueryData<typeof data>(key)?.requestId !== submittedId) return
      qc.setQueryData(key, { text: '', requestId: '' })
      setText('')
    },
  }
}
