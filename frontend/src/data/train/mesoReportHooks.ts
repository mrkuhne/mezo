import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { trainApi, type MesocycleReportResponse } from '@/data/train/trainApi'
import { mesoReportMock, mesocycles } from '@/data/train/train'
import type { Mesocycle } from '@/data/types'

/** How often the report is re-read while something is still being generated server-side. */
const POLL_MS = 3000

const reportKey = (id: string | null) => ['train', 'mesoReport', id]

/** Mock mode has exactly one closed run with a report — every other id has none (404 parity). */
function mockReportFor(id: string | null): MesocycleReportResponse | null {
  return id === mesoReportMock.mesocycleId ? mesoReportMock : null
}

/**
 * Mock-mode "generate": the offline app owns its cache, so a regenerate writes a report
 * straight into it (the mesoTemplateHooks/pantry idiom) instead of no-oping — otherwise the
 * „Riport generálása" affordance would be a dead button in the demo. The fixture's numbers
 * are reused verbatim; only the identity fields follow the run being generated for.
 */
function mockRegenerate(qc: QueryClient, id: string | null): void {
  const meso = (qc.getQueryData<Mesocycle[]>(['train', 'mesocycles']) ?? mesocycles).find((m) => m.id === id)
  const generated: MesocycleReportResponse = {
    ...mesoReportMock,
    mesocycleId: id ?? mesoReportMock.mesocycleId,
    templateId: meso?.templateId ?? null,
    title: meso?.title ?? mesoReportMock.title,
    weeks: meso?.weeks ?? mesoReportMock.weeks,
    aiEvalGeneratedAt: new Date().toISOString(),
  }
  qc.setQueryData(reportKey(id), generated)
}

/**
 * The frozen end-of-mesocycle report (mezo-meyc.2). Reads dual-mode; real mode resolves the
 * contract's 404 ("no report generated for this run yet") to `notFound` rather than an error,
 * because that is a normal, actionable state — the page offers „Riport generálása" for it and
 * an auto-archived run (archived by starting the next one) always lands there first.
 *
 * `regenerate()` posts the 202 endpoint and then polls until the report materializes; once it
 * exists, polling only continues while an AI eval is still `pending` AND the feature is on
 * (`aiEvalEnabled` is false through S2, so the poll never runs in this slice).
 */
export function useMesoReport(id: string | null) {
  const mock = isMockMode()
  const qc = useQueryClient()
  const key = reportKey(id)
  // True between firing a regenerate and the report actually showing up — the window in which
  // the GET may still legitimately answer 404.
  const [regenerating, setRegenerating] = useState(false)

  const q = useQuery<MesocycleReportResponse | null>({
    queryKey: key,
    queryFn: mock
      ? async () => mockReportFor(id)
      : () =>
          trainApi.getMesoReport(id as string).catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }),
    enabled: mock || !!id,
    initialData: mock ? mockReportFor(id) : undefined,
    // Mock is a client-owned cache (mockRegenerate writes into it) — a stale refetch would
    // re-run the queryFn and clobber the generated report back to null.
    staleTime: mock ? Infinity : undefined,
    retry: false,
    refetchInterval: mock
      ? false
      : (query) => {
          const data = query.state.data
          if (data == null) return regenerating ? POLL_MS : false
          return data.aiEvalStatus === 'pending' && data.aiEvalEnabled ? POLL_MS : false
        },
  })

  // Stop the post-regenerate poll the moment the report exists.
  useEffect(() => {
    if (regenerating && q.data != null) setRegenerating(false)
  }, [regenerating, q.data])

  const regenerateM = useMutation({
    mutationFn: mock
      ? async () => mockRegenerate(qc, id)
      : () => trainApi.regenerateMesoReport(id as string),
    onSuccess: () => {
      if (!mock) qc.invalidateQueries({ queryKey: key })
    },
  })

  const regenerate = useCallback((): Promise<void> => {
    setRegenerating(true)
    // Failed mutations are toasted globally (§7a) — just release the flag so the button
    // returns to its idle state instead of pretending a generation is still running.
    return regenerateM.mutateAsync().then(
      () => undefined,
      (e: unknown) => {
        setRegenerating(false)
        throw e
      },
    )
  }, [regenerateM])

  return {
    report: q.data ?? null,
    pending: !mock && q.isPending,
    /** The run exists but carries no report — the actionable "generate it" state. */
    notFound: !q.isPending && q.data === null,
    regenerating,
    regenerate,
  }
}
