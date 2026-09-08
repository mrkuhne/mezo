import { useState } from 'react'
import { useAdminMemoryRun, useAdminMemoryRuns } from '@/data/admin/adminMemoryHooks'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MosaicDesktop, Tile } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'
import { formatLatency, formatTime } from '@/features/me/logic/llmCallFormat'
import { RunDetail, type InspectorBody } from '@/features/admin/memory/views/RunDetail'
import { ReplayBox } from '@/features/admin/memory/views/ReplayBox'
import type { ViewKey } from '@/features/admin/memory/MemorySegmentBar'
import type { AdminMemoryRunSummary } from '@/data/admin/adminMemoryApi'

const PAGE_SIZE = 25

// Futások (mezo-4qyt.3, Step 3.6): the run table, the SHADOW-honesty badge, one selected run's
// detail below the table, then the always-visible replay box.
//
// SHADOW is the PRODUCTION default (mezo.companion.memory-platform.serving-mode), so almost
// every stored run is a shadow run: the pipeline was audited in the background while the LEGACY
// path actually served the chat. Saying so on every row is the difference between an explainer
// and a misleading one.
const MODE_BADGE: Record<string, { label: string; tone: string; title: string }> = {
  SHADOW: { label: 'árnyék', tone: 'shadow', title: 'Árnyékfutás — nem ezt látta a modell' },
  NEW: { label: 'élő', tone: 'new', title: 'Egységes visszakeresés szolgálta ki' },
  OLD: { label: 'legacy', tone: 'old', title: 'A régi visszakeresési út' },
}

export function RunsView({
  userId,
  isOwner,
  selectedRunId,
  onSelectRun,
  onGo,
  onInspect,
}: {
  userId: string
  isOwner: boolean
  selectedRunId: string | null
  onSelectRun: (runId: string | null) => void
  onGo: (view: ViewKey, sel: string | null) => void
  onInspect: (body: InspectorBody | null) => void
}) {
  const [page, setPage] = useState(0)
  const runs = useAdminMemoryRuns(userId, page, PAGE_SIZE, isOwner)
  const detail = useAdminMemoryRun(userId, selectedRunId ?? '', isOwner && selectedRunId != null)

  if (runs.data.degraded) {
    return (
      <MosaicDesktop>
        <div className="am-degraded">
          <div className="t">A memória-felfedező ki van kapcsolva</div>
          <p>Ehhez a userhez (vagy ehhez a környezethez) a mezo.feature.admin-memory switch nincs bekapcsolva.</p>
        </div>
      </MosaicDesktop>
    )
  }

  // `keepPreviousRealData` means the table can briefly show the previous page's rows while the
  // next resolves — the page indicator always comes from the RESPONSE, never the requested page
  // (Step 3.6 trap).
  const responsePage = runs.data.page
  const canPrev = responsePage > 0
  const canNext = (responsePage + 1) * (runs.data.size || 1) < runs.data.total

  return (
    <MosaicDesktop>
      <AdminTile query={runs} wash="coral" eyebrow="Futáslista" span={12}>
        <div className="ad-eyebrow">
          {huInt(runs.data.total)} futás · a futások {runs.data.retentionDays} nap után törlődnek
        </div>
        <div className="ad-scroll" style={{ margin: '8px 0 14px' }}>
          <table className="ad-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Idő</th><th>Policy</th><th>Mód</th><th>Lekérdezés mód</th><th>Nyers → átfogalmazott</th>
                <th className="num">Jelöltek</th><th className="num">Ideje</th><th>Hiba</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.items.map((run) => (
                <RunRow
                  key={run.id ?? run.traceId ?? run.createdAt}
                  run={run}
                  selected={run.id === selectedRunId}
                  onSelect={() => onSelectRun(run.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="ad-cell" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="ad-chip" disabled={!canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Előző</button>
          <span className="ad-mut">{responsePage + 1}. oldal · {runs.data.size}/oldal</span>
          <button type="button" className="ad-chip" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>Következő ›</button>
        </div>
      </AdminTile>

      {selectedRunId && (
        <AdminTile query={detail} wash="sage" eyebrow="Futás részletei" span={12}>
          <RunDetail detail={detail.data} onGo={onGo} onInspect={onInspect} />
        </AdminTile>
      )}

      <Tile wash="sky" eyebrow="Próbafutás" span={12}>
        <ReplayBox userId={userId} onGo={onGo} onInspect={onInspect} />
      </Tile>
    </MosaicDesktop>
  )
}

function RunRow({ run, selected, onSelect }: { run: AdminMemoryRunSummary; selected: boolean; onSelect: () => void }) {
  const mode = MODE_BADGE[run.servingMode] ?? { label: run.servingMode, tone: 'mut', title: run.servingMode }
  return (
    <tr className={selected ? undefined : 'norow'} onClick={onSelect} style={{ cursor: 'pointer' }}>
      <td className="ad-mut">{formatTime(run.createdAt)}</td>
      <td>{run.consumerPolicy}</td>
      <td><span className={`am-mode ${mode.tone}`} title={mode.title}>{mode.label}</span></td>
      <td>{run.queryMode.toLowerCase()}</td>
      <td style={{ whiteSpace: 'normal', maxWidth: 260 }}>
        „{run.rawQuery}”{run.rewrittenQuery
          ? <> → <em>„{run.rewrittenQuery}”</em></>
          : <span className="ad-mut"> — nincs átírás</span>}
      </td>
      <td className="num">{run.candidateCount}</td>
      <td className="num">{formatLatency(run.durationMs)}</td>
      <td>{run.errorCode ? <span className="ad-tag warn">{run.errorCode}</span> : <span className="ad-mut">—</span>}</td>
    </tr>
  )
}
