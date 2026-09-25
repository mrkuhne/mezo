// ============================================================
// Mezo · N=1 kísérletek — üveg (Üvegesítés U8, mezo-me75u.8).
// Paritás: docs/design_2.0/prototypes/src/uveg-mezo-body.html `kiserletek()` + `EXS`
// (owner OK). Rangsor (bible §3.4): az amber halo-hero lombikkal, alatta a flat szűrő-pirulák
// (az aktív amberben világít); az AKTÍV kísérlet az egyetlen hangos elem — `.glass` amber kártya,
// lit kút (t-clock), nap-szegmensek (kész = világító, ma = körvonal) + a meglévő haladás-sáv;
// a JAVASLAT flat kártya levendula hajszállal, lit Elfogadom / szellem Elvetem pirulával; a
// LEZÁRT/ELVETETT flat sor lombikkal, státusz-chippel, kimenet-sorral és chevronnal. Az üres, a
// szűrő-üres, a hiba- és a betöltés-állapot szaggatott / halk. Stílus: prototype.css
// `── uveg mezo1 kiserletek (` blokk, minden szabály a `.exl-page` gyökérre szűkítve.
// Viselkedés érintetlen: őszinte üres állapot, a döntés-gombok csak élő módban és pending
// alatt tiltva, a javaslat-CTA mockban inert (byte-paritás).
// ============================================================
import type { CSSProperties, ReactNode } from 'react'
import { experimentChipOf, type ExperimentChipTone } from '@/features/insights/components/experimentStatus'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useExperiments, useExperimentActions } from '@/data/hooks'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'

const TONE_VAR: Record<ExperimentChipTone, string> = {
  lav: 'var(--dv-lav)',
  amber: 'var(--dv-amber)',
  sage: 'var(--dv-sage)',
  mute: 'var(--text-muted)',
}

/** The page frame every branch renders inside — the way back must exist on all of them. */
function ExpFrame({ big, children }: { big?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="gold" className="exl-page">
      <PageHead glass onBack={() => navigate(ALL_FEATURES_ROUTE)} label="Összes funkció" />
      <PageHero art="t-flask" accent="var(--dv-amber)" name="N=1 kísérletek" big={big} sub="a saját testeden bizonyítjuk" />
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

  if (isPending) return <ExpFrame><p role="status" className="exl-quiet">Betöltés…</p></ExpFrame>
  if (isError) {
    return (
      <ExpFrame>
        <div role="alert" className="exl-error">
          <Icon3D name="t-info" size={26} />
          <p>Nem sikerült betölteni a kísérleteket.</p>
          <button type="button" className="exl-pill is-ghost" onClick={refetch}>Újrapróbálom</button>
        </div>
      </ExpFrame>
    )
  }
  if (experiments.length === 0) {
    return (
      <ExpFrame>
        <div className="exl-empty uv-empty">
          <span className="uv-eyebrow">tanulom</span>
          <p><Icon3D name="t-sprout" size={20} />Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.</p>
        </div>
      </ExpFrame>
    )
  }

  return (
    <ExpFrame big={<>{heroCount}<small> kísérlet</small></>}>
    <EntranceGroup className="exl-list">
      <div className="exl-filters" role="group" aria-label="Kísérletek szűrése">
        {([['all', 'Mind'], ['active', 'Aktív'], ['proposed', 'Javaslat'], ['closed', 'Lezárt']] as const).map(([value, label]) => <button key={value} type="button" className={cn('exl-filter', filter === value && 'is-on')} aria-pressed={filter === value} onClick={() => setSearch({ status: value }, { replace: true })}>{label}</button>)}
      </div>
      {visible.length === 0 && <p className="exl-filter-empty">Ebben az állapotban még nincs kísérlet.</p>}
      {visible.map((e, i) => {
        const meta = experimentChipOf(e)
        const isActive = e.status === 'active'
        const isProposed = e.status === 'proposed'
        const isClosed = !isActive && !isProposed
        const accent = isActive ? 'var(--dv-amber)' : isProposed ? 'var(--dv-lav)' : TONE_VAR[meta.tone]
        return (
          <div
            key={e.id}
            className={cn('exl-card', isActive ? 'glass' : 'is-flat', 'rise')}
            data-status={e.status}
            style={{ '--c': accent, '--d': `${i * 70}ms`, '--i': i } as CSSProperties}
          >
            <div className="exl-top">
              {isActive
                ? <span className="exl-well uv-well"><Icon3D name="t-clock" size={30} /></span>
                : <Icon3D name={isProposed ? 't-bulb' : 't-flask'} size={30} />}
              <span className="exl-grow">
                <span className="exl-chip" data-tone={meta.tone} style={{ '--c': TONE_VAR[meta.tone] } as CSSProperties}>
                  <Icon3D name={meta.art} size={16} />{meta.label}
                </span>
              </span>
              {!isProposed && <em className="exl-days">{e.day}/{e.total} nap</em>}
              {isClosed && <span className="exl-chev" aria-hidden="true">›</span>}
            </div>

            <Link className="exl-title" to={`/mezo/experiments/${encodeURIComponent(e.id)}?${search}`}>{e.title}</Link>
            <p className="exl-hyp">{e.hypothesis}</p>

            {isActive && (
              <>
                <div className="exl-dots" aria-hidden="true">
                  {Array.from({ length: e.total }, (_, d) => (
                    <i key={d} className={cn(d < e.day && 'is-done', d === e.day && 'is-now')} />
                  ))}
                </div>
                <span className="exl-bar uv-bar" aria-hidden="true">
                  <b style={{ '--w': `${Math.round((e.day / e.total) * 100)}%`, '--d': `${350 + i * 70}ms` } as CSSProperties} />
                </span>
              </>
            )}

            {e.outcome && <div className="exl-outcome">{e.outcome}</div>}

            {isProposed && live && (
              <div className="exl-decide">
                <button type="button" className="exl-pill" disabled={pending} onClick={() => decide(e.id, 'accept')}>
                  <Icon3D name="t-tick" size={18} />Elfogadom
                </button>
                <button type="button" className="exl-pill is-ghost" disabled={pending} onClick={() => decide(e.id, 'dismiss')}>
                  <Icon3D name="t-skip" size={18} />Elvetem
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className="exl-new rise"
        style={{ '--d': `${experiments.length * 70}ms` } as CSSProperties}
        disabled={live && pending}
        onClick={live ? () => propose() : undefined}
      >
        <Icon3D name="t-bulb" size={24} />Új kísérletet javasol Mezo
      </button>
    </EntranceGroup>
    </ExpFrame>
  )
}
