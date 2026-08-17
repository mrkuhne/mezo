import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { trainApi, type MesocycleReportResponse } from '@/data/train/trainApi'
import { mesoReportHyp03Mock, mesoReportMock, mesocycles } from '@/data/train/train'
import type { Mesocycle } from '@/data/types'

/** How often the report is re-read while something is still being generated server-side. */
const POLL_MS = 3000

/** The one report cache key — `trainHooks`' mock close writes into it too (mezo-meyc.2). */
export const mesoReportQueryKey = (id: string | null) => ['train', 'mesoReport', id]

/**
 * The closed runs that ship with a FIXTURE report — every other id has none (404 parity).
 * Two of them since mezo-meyc.4: the compare view needs a pair to line up.
 */
const MOCK_REPORTS: MesocycleReportResponse[] = [mesoReportMock, mesoReportHyp03Mock]

function mockReportFor(id: string | null): MesocycleReportResponse | null {
  return MOCK_REPORTS.find((r) => r.mesocycleId === id) ?? null
}

/**
 * Mock-mode resolution order — **seeded cache first**, then the fixture run, then "no report".
 *
 * This ordering is the whole point: in mock mode the cache is the source of truth, because
 * `mockClose` (trainHooks) and `mockRegenerate` below WRITE reports into it for runs that are
 * not the `meso-rec-03` fixture. A queryFn that answered from the fixture table alone would
 * resolve `null` for exactly those ids and overwrite the seeded report — turning a
 * just-closed run's report back into the „nincs riport" state (CI #198, mock-mode job).
 *
 * `staleTime: Infinity` already stops the *routine* mount refetch, but that only removes the
 * triggers we know about; resolving cache-first makes the regression impossible regardless of
 * what causes a re-resolve (an explicit `refetch()`, an invalidate, a fresh observer after gc).
 * Belt AND braces, because the failure is silent and only shows up one screen later.
 */
function mockResolve(qc: QueryClient, id: string | null): MesocycleReportResponse | null {
  return qc.getQueryData<MesocycleReportResponse | null>(mesoReportQueryKey(id)) ?? mockReportFor(id)
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
  qc.setQueryData(mesoReportQueryKey(id), generated)
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
  const key = mesoReportQueryKey(id)
  // True between firing a regenerate and the report actually showing up — the window in which
  // the GET may still legitimately answer 404.
  const [regenerating, setRegenerating] = useState(false)

  const q = useQuery<MesocycleReportResponse | null>({
    queryKey: key,
    queryFn: mock
      ? async () => mockResolve(qc, id)
      : () =>
          trainApi.getMesoReport(id as string).catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }),
    enabled: mock || !!id,
    initialData: mock ? mockResolve(qc, id) : undefined,
    // Mock is a client-owned cache (mockClose/mockRegenerate write into it) — a stale refetch
    // would re-run the queryFn, and `mockResolve` above is what keeps that harmless.
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
    /**
     * A REAL failure (anything but the 404, which is `notFound` above) — mesoArcHooks' idiom.
     * Without this the page would render a blank shell on a 500/offline read.
     */
    error: !mock && q.isError,
    /** Retry a failed read (the error state's „Újrapróbálás"). */
    refetch: () => { void q.refetch() },
    regenerating,
    regenerate,
  }
}
