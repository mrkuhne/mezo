import { Link } from 'react-router-dom'
import { Boop, ClayIcon } from '@/shared/ui/clay'
import { useExperiments, usePatterns, usePredictions } from '@/data/hooks'
import { KarakterHubPage } from '@/features/character/pages/KarakterHubPage'
import '@/features/insights/boop-world.css'

/** Existing source records surface here; their detail pages own decisions and mutations. */
function CurrentDiscoveries() {
  const { patterns } = usePatterns()
  const { predictions } = usePredictions()
  const { experiments } = useExperiments()
  const pattern = patterns.find(item => item.status === 'proposed')
  const prediction = [...predictions].sort((a, b) => b.date.localeCompare(a.date))[0]
  const experiment = experiments.find(item => item.status === 'active')
  if (!pattern && !prediction && !experiment) return null
  return (
    <section className="boop-world-discoveries" aria-label="Kapcsolódó felfedezések">
      <h2>Amit közben figyelünk</h2>
      {pattern && <Link className="boop-world-story" to={`/mezo/patterns/${encodeURIComponent(pattern.pairKey || pattern.id)}`}>
        <span className="boop-world-story-head"><ClayIcon name="i-minta" size={28} />Minták · döntésre vár</span>
        <strong>{pattern.title}</strong><p>{pattern.mechanism}</p><small>Bizonyítékok és saját döntésed →</small>
      </Link>}
      {prediction && <Link className="boop-world-story" to={`/mezo/predictions/${encodeURIComponent(prediction.id)}`}>
        <span className="boop-world-story-head"><ClayIcon name="i-kristaly" size={28} />Előrejelzés · {prediction.status === 'pending' ? 'folyamatban' : prediction.status === 'validated' ? 'bevált' : 'nem vált be'}</span>
        <strong>{prediction.title}</strong><p>{prediction.actual || prediction.basis}</p><small>Várakozás és tényleges eredmény →</small>
      </Link>}
      {experiment && <Link className="boop-world-story" to={`/mezo/experiments/${encodeURIComponent(experiment.id)}`}>
        <span className="boop-world-story-head"><ClayIcon name="i-lombik" size={28} />Aktív kísérlet · {experiment.day}/{experiment.total} nap</span>
        <strong>{experiment.title}</strong><p>{experiment.hypothesis}</p><small>A kísérlet története →</small>
      </Link>}
    </section>
  )
}

export function BoopWorldPage() {
  return (
    <div className="boop-world-social">
      <div className="boop-world-page">
        <header className="boop-world-heading">
          <div><span className="mz-eyebrow">A te kis csapatod</span><h1>Üzenőfal</h1></div>
          <Boop domain="mezo" size={60} alive />
        </header>
        <nav className="boop-world-links" aria-label="Az üzenőfal mellett">
          <Link to="/mezo/menu"><ClayIcon name="i-minta" size={22} />Összes funkció</Link>
          <Link to="/mezo/chat" data-kalauz-anchor="mezo-chat"><ClayIcon name="i-level" size={22} />Beszélgetés Booppal</Link>
        </nav>
      </div>
      <KarakterHubPage embedded />
      <CurrentDiscoveries />
    </div>
  )
}
