import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { runningApi, type RunningBlockResponse, type RunSessionLogResponse } from '@/lib/runningApi'
import { runningBlocksMock, runSessionsMock } from './running'

export type RunningData = {
  runningBlocks: RunningBlockResponse[]
  activeRunningBlock: RunningBlockResponse | null
  runSessions: RunSessionLogResponse[]
  /** True while the blocks query is still loading (real mode) — views ghost-guard. */
  runningPending: boolean
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
  const list = blocks ?? []
  return {
    runningBlocks: list,
    activeRunningBlock: list.find((b) => b.status === 'active') ?? null,
    runSessions: sessions ?? [],
    runningPending: !mock && isPending,
  }
}
