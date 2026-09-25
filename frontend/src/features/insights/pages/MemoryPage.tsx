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
 *  Üveg hero (mezo-me75u.8, prototype `memoria()`): a frameless lavender halo, the page name as
 *  its eyebrow, and the „47/60" figure INSIDE a big glowing lavender ring on a lit inner disc,
 *  the sub line under it. Without an overview (degraded/loading/error) only the halo + name. */
function MemFrame({ ring, sub, children }: { ring?: ReactNode; sub?: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="lav" className="mmr-page">
      <PageHead glass onBack={() => navigate('/mezo')} label="Mezo" />
      <PageHero glass accent="var(--dv-lav)" name="Memória">
        {ring}
        {sub && <div className="mz-hero-sb">{sub}</div>}
      </PageHero>
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

/** The hero ring: progress = measured days / window, the count-up numeral in its centre. */
function MemRing({ shown, days, windowDays }: { shown: number; days: number; windowDays: number }) {
  const pct = windowDays > 0 ? Math.min(100, Math.max(0, (days / windowDays) * 100)) : 0
  return (
    <div className="mmr-ring">
      <svg viewBox="0 0 150 150" className="uv-ring" aria-hidden="true">
        <circle className="uv-ring-track" cx="75" cy="75" r="66" pathLength={100} />
        <circle className="uv-ring-prog" cx="75" cy="75" r="66" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <span className="mz-bignum">{shown}<small>/{windowDays}</small></span>
    </div>
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
        <div className="mmr-note uv-empty" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
          <p>A társ memóriája most nem elérhető — a rétegek itt jelennek majd meg.</p>
          {/* Direct to the Minták dashboard — the `/mezo/motor` redirect was an extra hop. */}
          <Link to="/mezo/patterns" className="mmr-notelink">
            A minta-motor diagnosztikája →
          </Link>
        </div>
      </MemFrame>
    )
  }
  if (!overview) {
    if (isPending) return <MemFrame><div className="mmr-ghost"><GhostState message="A memória-rétegek betöltése…" /></div></MemFrame>
    if (isError) {
      return (
        <MemFrame>
          <div className="mmr-note uv-empty" style={{ '--c': 'var(--dv-coral)' } as React.CSSProperties}>
            <p>Nem sikerült betölteni a memória-rétegeket.</p>
            <button type="button" className="mmr-notelink" onClick={() => refetch()}>
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
      ring={<MemRing shown={heroDays} days={overview.l0.daysWithAnyData} windowDays={overview.l0.windowDays} />}
      sub="mért nap a minta-ablakban"
    >
    <div className="mmr-body">
      <div className="mmr-segbar">
        <div className="mmr-seg" role="tablist" aria-label="Memória nézetek">
          <SegButton on={view === 'overview'} onClick={() => setView('overview')}>Rétegek</SegButton>
          <SegButton on={view === 'journal'} onClick={() => setView('journal')}>Napló</SegButton>
          <SegButton on={view === 'search'} onClick={() => setView('search')}>Kereső</SegButton>
          <SegButton on={view === 'audit'} onClick={() => setView('audit')}>Audit</SegButton>
        </div>
      </div>

      <EntranceGroup replayKey={view}>
        {view === 'overview' && (
          <MemoryLayersPanel overview={overview} onOpenJournal={() => setView('journal')} />
        )}
        {view === 'journal' && <MemoryJournalPanel summaries={summaries} focusDate={focusDate} />}
        {view === 'search' && (
          <div className="mmr-search">
            <MemorySearchPanel onPick={(date) => { setFocusDate(date); setView('journal') }} />
          </div>
        )}
        {view === 'audit' && <MemoryAuditPanel />}
      </EntranceGroup>
    </div>
    </MemFrame>
  )
}

/** Szegmens-gomb a prototípus .seg pill arcával (üveg: aktív = levendulával kivilágított). */
function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="tab" aria-selected={on} onClick={onClick} className={on ? 'on' : undefined}>
      {children}
    </button>
  )
}
