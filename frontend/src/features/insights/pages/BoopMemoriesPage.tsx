import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemoir, useMemoirArchive, useMemorySummaries } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { MemorySearchPanel } from '@/features/insights/components/MemorySearchPanel'

export function BoopMemoriesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.toString() ? `?${params}` : ''
  const { memoir } = useMemoir()
  const archive = useMemoirArchive()
  const journal = useMemorySummaries()
  return <MozaikPage tone="lav">
    <PageHead label="‹ Menü" onBack={() => navigate('/mezo/menu')} />
    <PageHero icon="i-memoar" name="Emlékek" sub="A napjaid és a közös történetünk" />
    <PageBody><EntranceGroup className="col gap-md">
      <Link to="/mezo/memoir" className="mz-memoir rise" style={{ textDecoration: 'none', color: 'inherit' }}>
        <ClayIcon name="i-memoar" size={52} />
        <span className="mz-eyebrow">Heti memoár{memoir ? ` · ${memoir.week}` : ''}</span>
        <h2 className="mz-memoir-ttl">{memoir?.title ?? 'A heted története'}</h2>
        <p className="mz-memoir-bd">{memoir ? memoir.body.split('\n\n')[0] : 'Itt olvashatod majd az elkészült heti fejezeteket.'}</p>
        <span>Memoár olvasása →</span>
      </Link>
      <Link className="mz-qcard" to="/mezo/memoir/archivum">Memoár · archívum{!archive.isPending && !archive.isError && archive.data.length > 0 ? ` · ${archive.data.length} fejezet` : ''} →</Link>
      <h2 className="h-display size-md">Napi emlékek</h2>
      {journal.isPending ? <GhostState message="A napi emlékek betöltése…" />
        : journal.isError ? <GhostState message="Nem sikerült betölteni a napi emlékeket." ctaLabel="Újra" onCta={journal.refetch} />
        : journal.degraded ? <GhostState message="A napi emlékek most nem elérhetők." />
        : journal.summaries.length === 0 ? <GhostState message="Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik." />
        : journal.summaries.map((day) => <Link key={day.date} to={`/mezo/emlekek/${day.date}${search}`} className="mem-daycard rise" style={{ color: 'inherit', textDecoration: 'none' }}>
          <time className="mem-dl" dateTime={day.date}>{day.date}</time>
          <p className="mem-bd">{day.narrative.length > 180 ? `${day.narrative.slice(0, 180)}…` : day.narrative}</p>
          <span className="mz-eyebrow">A nap története →</span>
        </Link>)}
      <h2 className="h-display size-md">Hasonló napok keresése</h2>
      <MemorySearchPanel initialQuery={params.get('q') ?? ''}
        onSearch={(query) => setParams(previous => {
          const next = new URLSearchParams(previous)
          if (query) next.set('q', query); else next.delete('q')
          return next
        }, { replace: true })}
        onPick={(date) => navigate(`/mezo/emlekek/${date}${search}`)} />
      <Link className="mz-qcard" to="/me/week">Heti értékelés →</Link>
      <Link className="mz-qcard" to="/mezo/memoria">Memória · rétegek és audit →</Link>
    </EntranceGroup></PageBody>
  </MozaikPage>
}
