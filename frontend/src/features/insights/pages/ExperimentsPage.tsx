// ============================================================
// Mezo · N=1 kísérletek — Mozaik re-face (mezo-d20.5.6).
// Source of truth: mezo-body.html #page-kiserlet (.predtile, ×1.18).
// Status-washed tiles: ◇ Javaslat = gold-ringed proposal card with the
// Elfogadom/Elvetem decision row (live-only, the existing accept
// mutation — invalidate → the refetched row re-faces as ◐ Aktív 0/7),
// ◐ Aktív = amber + day-dot row + gold progress bar, ✓ Megerősítve =
// sage + "✓ …" outcome line. Chips were already Hungarian here; the
// dismissed branch gains its missing label (audit §6 gap). Behavioral
// contracts preserved: honest empty state, actions gated on live and
// disabled while pending, the propose CTA inert in mock (byte-parity).
// ============================================================
import type { ReactNode } from 'react'
import { experimentChipOf } from '@/features/insights/components/experimentStatus'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useExperiments, useExperimentActions } from '@/data/hooks'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'

/** The page frame every branch renders inside — the way back must exist on all of them. */
function ExpFrame({ big, children }: { big?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate(ALL_FEATURES_ROUTE)} label="‹ Összes funkció" />
      <PageHero icon="i-lombik" name="N=1 kísérletek" big={big} sub="a saját testeden bizonyítjuk" />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

export function ExperimentsPage() {
  const { experiments, mode, isPending, isError, refetch } = useExperiments()
  const [search, setSearch] = useSearchParams()
  const filter = search.get('status') ?? 'all'
  const visible = experiments.filter((e) => filter === 'active' ? e.status === 'active' : filter === 'proposed' ? e.status === 'proposed' : filter === 'closed' ? e.status === 'completed' || e.status === 'dismissed' : true)
  const { decide, propose, pending } = useExperimentActions()
  const live = mode === 'live'
  // Prototype hero big number (#kisBig) — spins up, reduced-motion aware in the hook itself.
  const heroCount = useCountUp(experiments.length)

  if (isPending) return <ExpFrame><p role="status">Betöltés…</p></ExpFrame>
  if (isError) return <ExpFrame><div role="alert"><p>Nem sikerült betölteni a kísérleteket.</p><button className="mzp-cta" onClick={refetch}>Újrapróbálom</button></div></ExpFrame>
  if (experiments.length === 0) {
    return (
      <ExpFrame>
        <div className="card" style={{ padding: 18, textAlign: 'center' }}>
          <span className="eyebrow text-tertiary">tanulom</span>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.
          </p>
        </div>
      </ExpFrame>
    )
  }

  return (
    <ExpFrame big={heroCount}>
    <EntranceGroup className="col gap-md">
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }} role="group" aria-label="Kísérletek szűrése">
        {([['all', 'Mind'], ['active', 'Aktív'], ['proposed', 'Javaslat'], ['closed', 'Lezárt']] as const).map(([value, label]) => <button key={value} type="button" className={cn('chip', filter === value && 'active')} aria-pressed={filter === value} onClick={() => setSearch({ status: value }, { replace: true })}>{label}</button>)}
      </div>
      {visible.length === 0 && <p>Ebben az állapotban még nincs kísérlet.</p>}
      {visible.map((e, i) => {
        const meta = experimentChipOf(e)
        return (
          <div
            key={e.id}
            className={cn('mzp-pred', meta.wash, e.status === 'proposed' && 'propcard', 'rise')}
            style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="mzp-top">
              <span className="mzp-pic"><ClayIcon name={e.status === 'active' ? 'i-idozito' : 'i-lombik'} size={22} /></span>
              <span className={cn('mzp-stch', 'mz-ebic', meta.chip)}>{meta.label}</span>
              {e.status !== 'proposed' && <span className="mzp-date">{e.day}/{e.total} nap</span>}
            </div>

            <Link className="mzp-title" to={`/mezo/experiments/${encodeURIComponent(e.id)}?${search}`}>{e.title}</Link>
            <p className="mzp-basis">{e.hypothesis}</p>

            {e.status === 'active' && (
              <>
                <div className="mzp-daydots" aria-hidden="true">
                  {Array.from({ length: e.total }, (_, d) => (
                    <i key={d} className={cn(d < e.day && 'f')} />
                  ))}
                </div>
                <div className="mzp-conf">
                  <div className="mzp-gbar">
                    <div className="gold" style={{ width: `${Math.round((e.day / e.total) * 100)}%`, '--d': `${350 + i * 70}ms` } as React.CSSProperties} />
                  </div>
                </div>
              </>
            )}

            {e.outcome && <div className="mzp-actual">✓ {e.outcome}</div>}

            {e.status === 'proposed' && live && (
              <div className="mzp-decrow">
                <button type="button" className="mzp-cta" disabled={pending} onClick={() => decide(e.id, 'accept')}>
                  Elfogadom
                </button>
                <button type="button" className="mzp-ghost" disabled={pending} onClick={() => decide(e.id, 'dismiss')}>
                  Elvetem
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className="mzp-new rise"
        style={{ '--d': `${experiments.length * 70}ms` } as React.CSSProperties}
        disabled={live && pending}
        onClick={live ? () => propose() : undefined}
      >
        ＋ Új kísérletet javasol Mezo
      </button>
    </EntranceGroup>
    </ExpFrame>
  )
}
