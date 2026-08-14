import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMemoryOverview, useMemorySummaries } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { GhostState } from '@/shared/ui/GhostState'
import { MemoryLayersPanel } from '@/features/insights/components/MemoryLayersPanel'
import { MemoryJournalPanel } from '@/features/insights/components/MemoryJournalPanel'
import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'

type MemoryView = 'overview' | 'journal' | 'search'

export function MemoryPage() {
  const [view, setView] = useStickyTab<MemoryView>('insights.memoria.view', 'overview')
  const [focusDate, setFocusDate] = useState<string | null>(null)
  const { overview, degraded, isPending } = useMemoryOverview()
  const { summaries } = useMemorySummaries()

  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>
          A társ memóriája most nem elérhető — a rétegek itt jelennek majd meg.
        </p>
        <Link to="/insights/motor" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
          A minta-motor diagnosztikája →
        </Link>
      </div>
    )
  }
  if (!overview) {
    return isPending ? <GhostState message="A memória-rétegek betöltése…" /> : null
  }

  return (
    <div className="col gap-md">
      <div
        className="row" role="tablist" aria-label="Memória nézetek"
        style={{ background: 'var(--surface-glass)', borderRadius: 12, padding: 3 }}
      >
        <SegButton on={view === 'overview'} onClick={() => setView('overview')}>Áttekintés</SegButton>
        <SegButton on={view === 'journal'} onClick={() => setView('journal')}>Napló</SegButton>
        <SegButton on={view === 'search'} onClick={() => setView('search')}>Kereső</SegButton>
      </div>

      {view === 'overview' && (
        <MemoryLayersPanel overview={overview} onOpenJournal={() => setView('journal')} />
      )}
      {view === 'journal' && <MemoryJournalPanel summaries={summaries} focusDate={focusDate} />}
      {view === 'search' && (
        <MemorySearchPanel onPick={(date) => { setFocusDate(date); setView('journal') }} />
      )}
    </div>
  )
}

/** A GrowthPage/FuelSlotsPage szegmens-gomb idiómájának lokális másolata (a bevett norma). */
function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      role="tab" aria-selected={on} onClick={onClick} className="rad-12"
      style={{
        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 1,
        textTransform: 'uppercase', padding: '7px 0', borderRadius: 3,
        color: on ? 'var(--lav-deep)' : 'var(--text-tertiary)',
        background: on ? 'var(--wash-lav)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
