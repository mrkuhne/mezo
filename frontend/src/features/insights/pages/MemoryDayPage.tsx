import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMemorySummaries } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { GhostState } from '@/shared/ui/GhostState'

export function MemoryDayPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { summaries, isPending, isError, degraded, refetch } = useMemorySummaries()
  const index = summaries.findIndex((day) => day.date === date)
  const day = summaries[index]
  return <MozaikPage tone="gold">
    <PageHead label="‹ Emlékek" onBack={() => navigate('/mezo/emlekek')} />
    <PageHero icon="i-memoar" name="Napi emlék" sub={date} />
    <PageBody>
      {isPending ? <GhostState message="A napi emlék betöltése…" />
        : isError ? <GhostState message="Nem sikerült betölteni a napi emléket." ctaLabel="Újra" onCta={refetch} />
        : degraded ? <GhostState message="A napi emlékek most nem elérhetők." />
        : !day ? <GhostState message="Ehhez a naphoz még nincs elkészült emlék." />
        : <article className="mz-memoir rise"><time className="mz-eyebrow" dateTime={day.date}>{day.date}</time><p className="mz-memoir-bd" style={{ whiteSpace: 'pre-wrap' }}>{day.narrative}</p><p className="mz-fact-origin">Boop éjszakai összefoglalója a rögzített napodról.</p></article>}
      <nav className="col gap-md" aria-label="Napi emlékek navigációja">
        {index >= 0 && summaries[index + 1] && <Link to={`/mezo/emlekek/${summaries[index + 1].date}`}>← Korábbi emlék · {summaries[index + 1].date}</Link>}
        {index > 0 && <Link to={`/mezo/emlekek/${summaries[index - 1].date}`}>Következő emlék · {summaries[index - 1].date} →</Link>}
        <Link to="/mezo/emlekek">Emlékek · összes nap →</Link>
      </nav>
    </PageBody>
  </MozaikPage>
}
