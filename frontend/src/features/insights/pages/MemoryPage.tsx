import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMemoryOverview, useMemorySummaries } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { GhostState } from '@/shared/ui/GhostState'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MemoryLayersPanel } from '@/features/insights/components/MemoryLayersPanel'
import { MemoryJournalPanel } from '@/features/insights/components/MemoryJournalPanel'
import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'
import { MemoryAuditPanel } from '@/features/insights/components/MemoryAuditPanel'

type MemoryView = 'overview' | 'journal' | 'search' | 'audit'

export function MemoryPage() {
  const [view, setView] = useStickyTab<MemoryView>('insights.memoria.view', 'overview')
  const [focusDate, setFocusDate] = useState<string | null>(null)
  const { overview, degraded, isPending, isError, refetch } = useMemoryOverview()
  const { summaries } = useMemorySummaries()

  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          A társ memóriája most nem elérhető — a rétegek itt jelennek majd meg.
        </p>
        <Link to="/mezo/motor" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
          A minta-motor diagnosztikája →
        </Link>
      </div>
    )
  }
  if (!overview) {
    if (isPending) return <GhostState message="A memória-rétegek betöltése…" />
    if (isError) {
      return (
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Nem sikerült betölteni a memória-rétegeket.
          </p>
          <button onClick={() => refetch()} style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
            Újra
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="col gap-md">
      <div className="mem-seg" role="tablist" aria-label="Memória nézetek">
        <SegButton on={view === 'overview'} onClick={() => setView('overview')}>Rétegek</SegButton>
        <SegButton on={view === 'journal'} onClick={() => setView('journal')}>Napló</SegButton>
        <SegButton on={view === 'search'} onClick={() => setView('search')}>Kereső</SegButton>
        <SegButton on={view === 'audit'} onClick={() => setView('audit')}>Audit</SegButton>
      </div>

      <EntranceGroup replayKey={view}>
        {view === 'overview' && (
          <MemoryLayersPanel overview={overview} onOpenJournal={() => setView('journal')} />
        )}
        {view === 'journal' && <MemoryJournalPanel summaries={summaries} focusDate={focusDate} />}
        {view === 'search' && (
          <MemorySearchPanel onPick={(date) => { setFocusDate(date); setView('journal') }} />
        )}
        {view === 'audit' && <MemoryAuditPanel />}
      </EntranceGroup>
    </div>
  )
}

/** Szegmens-gomb a prototípus .segtabs pill arcával (aktív = korall CTA-gradiens). */
function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick} className={on ? 'on' : undefined}>
      {children}
    </button>
  )
}
