import type { CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemoir, useMemoirArchive, useMemorySummaries } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'

/** Hungarian month abbreviations for the lit date block (prototype `.dblk`). */
const HU_MONTH = ['JAN', 'FEB', 'MÁR', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEP', 'OKT', 'NOV', 'DEC']

function dateParts(iso: string): { day: string; month: string } {
  const [, m, d] = iso.split('-')
  const month = HU_MONTH[Number(m) - 1]
  return { day: d ? String(Number(d)) : iso, month: month ?? '' }
}

/** A flat door row (prototype `door()`): a lit well with a 3D icon, title + sub, chevron. */
function Door({ to, art, accent, title, sub }: { to: string; art: Icon3DName; accent: string; title: string; sub?: string }) {
  return (
    <Link to={to} className="eml-door rise" style={{ '--c': accent } as CSSProperties}>
      <span className="uv-well eml-door-well"><Icon3D name={art} size={28} /></span>
      <span className="eml-door-grow"><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
      <span className="eml-chev" aria-hidden="true">›</span>
    </Link>
  )
}

export function BoopMemoriesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.toString() ? `?${params}` : ''
  const { memoir } = useMemoir()
  const archive = useMemoirArchive()
  const journal = useMemorySummaries()
  const chapters = !archive.isPending && !archive.isError && archive.data.length > 0 ? `${archive.data.length} fejezet` : undefined
  return <MozaikPage tone="lav" className="eml-page eml-emlekek">
    <PageHead glass label="Üzenőfal" onBack={() => navigate('/mezo')} />
    <PageHero art="t-album" accent="var(--dv-lav)" name="Emlékek" sub="A napjaid és a közös történetünk" />
    <PageBody><EntranceGroup className="col gap-md">
      <Link to="/mezo/memoir" className="eml-memo glass rise" style={{ '--c': 'var(--dv-lav)' } as CSSProperties}>
        <span className="eml-memo-top">
          <Icon3D name="t-scroll" size={56} />
          <span className="eml-memo-head">
            <span className="uv-eyebrow eml-memo-eb">Heti memoár{memoir ? ` · ${memoir.week}` : ''}</span>
            <span className="eml-memo-ttl">{memoir?.title ?? 'A heted története'}</span>
          </span>
        </span>
        <p className="eml-memo-ex">{memoir ? memoir.body.split('\n\n')[0] : 'Itt olvashatod majd az elkészült heti fejezeteket.'}</p>
        <span className="eml-memo-go">Memoár olvasása ›</span>
      </Link>
      <Door to="/mezo/memoir/archivum" art="t-scroll" accent="var(--dv-lav)" title="Memoár · archívum" sub={chapters} />

      <h2 className="uv-eyebrow eml-h3">Napi emlékek</h2>
      {journal.isPending ? <div className="eml-ghost"><GhostState message="A napi emlékek betöltése…" /></div>
        : journal.isError ? <div className="eml-ghost"><GhostState message="Nem sikerült betölteni a napi emlékeket." ctaLabel="Újra" onCta={journal.refetch} /></div>
        : journal.degraded ? <div className="eml-ghost"><GhostState message="A napi emlékek most nem elérhetők." /></div>
        : journal.summaries.length === 0 ? <div className="eml-empty uv-empty"><GhostState message="Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik." /></div>
        : <div className="eml-drows">{journal.summaries.map((day) => {
          const { day: dd, month } = dateParts(day.date)
          return <Link key={day.date} to={`/mezo/emlekek/${day.date}${search}`} className="eml-drow rise">
            <time className="eml-dblk" dateTime={day.date}>
              <b aria-hidden="true">{dd}</b><small aria-hidden="true">{month}</small>
              <span className="sr-only">{day.date}</span>
            </time>
            <div className="eml-drow-grow">
              <p className="eml-drow-bd">{day.narrative.length > 180 ? `${day.narrative.slice(0, 180)}…` : day.narrative}</p>
              <span className="eml-drow-go">A nap története ›</span>
            </div>
          </Link>
        })}</div>}

      <h2 className="uv-eyebrow eml-h3">Hasonló napok keresése</h2>
      <MemorySearchPanel initialQuery={params.get('q') ?? ''}
        onSearch={(query) => setParams(previous => {
          const next = new URLSearchParams(previous)
          if (query) next.set('q', query); else next.delete('q')
          return next
        }, { replace: true })}
        onPick={(date) => navigate(`/mezo/emlekek/${date}${search}`)} />

      <div className="eml-doors">
        <Door to="/me/week" art="t-calendar" accent="var(--dv-rose)" title="Heti értékelés" />
        <Door to="/mezo/memoria" art="t-layers" accent="var(--dv-lav)" title="Memória" sub="rétegek és audit" />
      </div>
    </EntranceGroup></PageBody>
  </MozaikPage>
}
