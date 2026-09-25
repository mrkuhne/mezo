import type { CSSProperties } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMemorySummaries } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { Icon3D } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'

export function MemoryDayPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { search } = useLocation()
  const back = `/mezo/emlekek${search}`
  const { summaries, isPending, isError, degraded, refetch } = useMemorySummaries()
  const index = summaries.findIndex((day) => day.date === date)
  const day = summaries[index]
  const earlier = index >= 0 ? summaries[index + 1] : undefined
  const later = index > 0 ? summaries[index - 1] : undefined
  return <MozaikPage tone="gold" className="eml-page eml-emlek">
    <PageHead glass label="Emlékek" onBack={() => navigate(back)} />
    <PageHero art="t-album" accent="var(--dv-amber)" name="Napi emlék" sub={date} />
    <PageBody>
      {isPending ? <div className="eml-ghost"><GhostState message="A napi emlék betöltése…" /></div>
        : isError ? <div className="eml-ghost"><GhostState message="Nem sikerült betölteni a napi emléket." ctaLabel="Újra" onCta={refetch} /></div>
        : degraded ? <div className="eml-ghost"><GhostState message="A napi emlékek most nem elérhetők." /></div>
        : !day ? <div className="eml-empty uv-empty"><GhostState message="Ehhez a naphoz még nincs elkészült emlék." /></div>
        : <article className="eml-article glass rise" style={{ '--c': 'var(--dv-amber)' } as CSSProperties}>
          <time className="uv-eyebrow eml-article-eb" dateTime={day.date}>{day.date}</time>
          <p className="eml-article-prose">{day.narrative}</p>
          <p className="eml-article-note">Boop éjszakai összefoglalója a rögzített napodról.</p>
        </article>}
      <nav className="eml-daynav" aria-label="Napi emlékek navigációja">
        {(earlier || later) && <div className="eml-pager">
          {earlier && <Link className="eml-pager-cell is-prev" to={`/mezo/emlekek/${earlier.date}${search}`}>
            <small>‹ Korábbi emlék</small><strong>{earlier.date}</strong>
          </Link>}
          {later && <Link className="eml-pager-cell is-next" to={`/mezo/emlekek/${later.date}${search}`}>
            <small>Következő emlék ›</small><strong>{later.date}</strong>
          </Link>}
        </div>}
        <Link className="eml-door" to={back} style={{ '--c': 'var(--dv-amber)' } as CSSProperties}>
          <span className="uv-well eml-door-well"><Icon3D name="t-album" size={28} /></span>
          <span className="eml-door-grow"><strong>Emlékek</strong><small>összes nap</small></span>
          <span className="eml-chev" aria-hidden="true">›</span>
        </Link>
      </nav>
    </PageBody>
  </MozaikPage>
}
