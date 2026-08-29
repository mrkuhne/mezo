import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMemoryOverview, useMemorySummaries } from '@/data/hooks'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { MemoryLayersPanel } from '@/features/insights/components/MemoryLayersPanel'
import { MemoryJournalPanel } from '@/features/insights/components/MemoryJournalPanel'
import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'
import { MemoryAuditPanel } from '@/features/insights/components/MemoryAuditPanel'

type MemoryView = 'overview' | 'journal' | 'search' | 'audit'

/** The page frame every branch renders inside — the way back must exist on all of them
 *  (ADR 0032 / fidelity audit mezo-d20.11: the Memória mounted no PageHead at all).
 *  Hero = prototype #page-memoria: i-retegek + „47/60" + „mért nap a minta-ablakban". */
function MemFrame({ big, sub, children }: { big?: ReactNode; sub?: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero icon="i-retegek" name="Memória" big={big} sub={sub} />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

export function MemoryPage() {
  const [view, setView] = useStickyTab<MemoryView>('insights.memoria.view', 'overview')
  const [focusDate, setFocusDate] = useState<string | null>(null)
  const { overview, degraded, isPending, isError, refetch } = useMemoryOverview()
  const { summaries } = useMemorySummaries()
  // Prototype hero big number spins up; the hook stays above every early return.
  const heroDays = useCountUp(overview?.l0.daysWithAnyData ?? 0)

  if (degraded) {
    return (
      <MemFrame>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            A társ memóriája most nem elérhető — a rétegek itt jelennek majd meg.
          </p>
          {/* Direct to the Minták dashboard — the `/mezo/motor` redirect was an extra hop. */}
          <Link to="/mezo/patterns" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
            A minta-motor diagnosztikája →
          </Link>
        </div>
      </MemFrame>
    )
  }
  if (!overview) {
    if (isPending) return <MemFrame><GhostState message="A memória-rétegek betöltése…" /></MemFrame>
    if (isError) {
      return (
        <MemFrame>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <p className="text-tertiary" style={{ fontSize: 12 }}>
              Nem sikerült betölteni a memória-rétegeket.
            </p>
            <button onClick={() => refetch()} style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
              Újra
            </button>
          </div>
        </MemFrame>
      )
    }
    return <MemFrame>{null}</MemFrame>
  }

  return (
    <MemFrame
      big={<>{heroDays}<span className="mem-herounit">/{overview.l0.windowDays}</span></>}
      sub="mért nap a minta-ablakban"
    >
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
    </MemFrame>
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
