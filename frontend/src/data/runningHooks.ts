import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { runningApi, type RunningBlockResponse, type RunningBlockUpsertRequest, type RunSessionLogRequest, type RunSessionLogResponse } from '@/lib/runningApi'
import { runningBlocksMock, runSessionsMock } from './running'

export type RunningData = {
  runningBlocks: RunningBlockResponse[]
  activeRunningBlock: RunningBlockResponse | null
  runSessions: RunSessionLogResponse[]
  /** True while the blocks query is still loading (real mode) — views ghost-guard. */
  runningPending: boolean
  saveRunningBlock: (id: string | null, body: RunningBlockUpsertRequest, opts?: { onSuccess?: (b: RunningBlockResponse) => void }) => void
  activateRunningBlock: (id: string) => void
  closeRunningBlock: (id: string) => void
  deleteRunningBlock: (id: string, opts?: { onSuccess?: () => void }) => void
  logRunSession: (body: RunSessionLogRequest, opts?: { onSuccess?: () => void }) => void
  runningMutationPending: boolean
}

export function useRunning(): RunningData {
  const mock = isMockMode()
  const { data: blocks, isPending } = useQuery({
    queryKey: ['running', 'blocks'],
    queryFn: mock ? async () => runningBlocksMock : () => runningApi.blocks(),
    initialData: mock ? runningBlocksMock : undefined,
  })
  const { data: sessions } = useQuery({
    queryKey: ['running', 'runSessions'],
    queryFn: mock ? async () => runSessionsMock : () => runningApi.runSessions(),
    initialData: mock ? runSessionsMock : undefined,
  })
  const blockList = blocks ?? []

  const qc = useQueryClient()
  const invalidate = () => { if (!mock) qc.invalidateQueries({ queryKey: ['running', 'blocks'] }) }

  const upsertMock = (id: string | null, body: RunningBlockUpsertRequest): RunningBlockResponse => {
    const block: RunningBlockResponse = {
      id: id ?? `rb-${Math.round(performance.now())}-${blockList.length}`,
      status: id ? (blockList.find(b => b.id === id)?.status ?? 'planned') : 'planned',
      ...body, goal: body.goal ?? null, summary: body.summary ?? null, currentWeek: body.currentWeek ?? 0,
    }
    qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) =>
      id ? prev.map(b => b.id === id ? block : b) : [...prev, block])
    return block
  }
  const saveMutation = useMutation({
    mutationFn: (args: { id: string | null; body: RunningBlockUpsertRequest }) =>
      mock ? Promise.resolve(upsertMock(args.id, args.body))
           : (args.id ? runningApi.update(args.id, args.body) : runningApi.create(args.body)),
    onSuccess: invalidate,
  })
  const lifecycleMock = (id: string, status: 'active' | 'archived') => {
    qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) =>
      prev.map(b => b.id === id ? { ...b, status } : status === 'active' && b.status === 'active' ? { ...b, status: 'archived' } : b))
  }
  const activateMutation = useMutation({ mutationFn: (id: string): Promise<void> => mock ? Promise.resolve(lifecycleMock(id, 'active')) : runningApi.activate(id).then(() => undefined), onSuccess: invalidate })
  const closeMutation = useMutation({ mutationFn: (id: string): Promise<void> => mock ? Promise.resolve(lifecycleMock(id, 'archived')) : runningApi.close(id).then(() => undefined), onSuccess: invalidate })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => mock
      ? Promise.resolve(qc.setQueryData<RunningBlockResponse[]>(['running', 'blocks'], (prev = []) => prev.filter(b => b.id !== id)) as unknown as void)
      : runningApi.remove(id),
    onSuccess: invalidate })

  const logMock = (body: RunSessionLogRequest): RunSessionLogResponse =>
    ({ id: `rs-${Math.round(performance.now())}`, ...body,
       completedRounds: body.completedRounds ?? null, rpeActual: body.rpeActual ?? null,
       hrRecoverySec: body.hrRecoverySec ?? null, sprintLandmark: body.sprintLandmark ?? null,
       durationMin: body.durationMin ?? null, notes: body.notes ?? null })
  const logMutation = useMutation({
    mutationFn: (body: RunSessionLogRequest): Promise<void> => mock
      ? Promise.resolve(qc.setQueryData<RunSessionLogResponse[]>(['running', 'runSessions'], (prev = []) => [logMock(body), ...prev]) as unknown as void)
      : runningApi.logRunSession(body).then(() => undefined),
    onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['running', 'runSessions'] }) },
  })

  const saveRunningBlock = useCallback((id: string | null, body: RunningBlockUpsertRequest, opts?: { onSuccess?: (b: RunningBlockResponse) => void }) =>
    saveMutation.mutate({ id, body }, { onSuccess: (b) => { if (b) opts?.onSuccess?.(b) } }), [saveMutation])
  const activateRunningBlock = useCallback((id: string) => activateMutation.mutate(id), [activateMutation])
  const closeRunningBlock = useCallback((id: string) => closeMutation.mutate(id), [closeMutation])
  const deleteRunningBlock = useCallback((id: string, opts?: { onSuccess?: () => void }) => deleteMutation.mutate(id, { onSuccess: () => opts?.onSuccess?.() }), [deleteMutation])
  const logRunSession = useCallback((body: RunSessionLogRequest, opts?: { onSuccess?: () => void }) =>
    logMutation.mutate(body, { onSuccess: () => opts?.onSuccess?.() }), [logMutation])

  return {
    runningBlocks: blockList,
    activeRunningBlock: blockList.find((b) => b.status === 'active') ?? null,
    runSessions: sessions ?? [],
    runningPending: !mock && isPending,
    saveRunningBlock,
    activateRunningBlock,
    closeRunningBlock,
    deleteRunningBlock,
    logRunSession,
    runningMutationPending: saveMutation.isPending || activateMutation.isPending || closeMutation.isPending || deleteMutation.isPending || logMutation.isPending,
  }
}
