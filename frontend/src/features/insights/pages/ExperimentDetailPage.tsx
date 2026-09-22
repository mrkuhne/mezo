import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useExperimentActions, useExperiments } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { experimentChipOf } from '@/features/insights/components/experimentStatus'

export function ExperimentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { experiments, mode, isPending, isError, refetch } = useExperiments()
  const { decide, pending } = useExperimentActions()
  const experiment = experiments.find((item) => item.id === id)
  const meta = experiment ? experimentChipOf(experiment) : undefined
  return <MozaikPage tone="gold">
    <PageHead onBack={() => navigate(`/mezo/experiments?${search}`)} label="‹ Kísérletek" />
    <PageHero icon="i-lombik" name={experiment?.title ?? 'Kísérlet'} sub={experiment ? `${experiment.total} napos saját megfigyelés` : undefined} />
    <PageBody>
      {isPending ? <p role="status">Betöltés…</p> : isError ? <div role="alert"><p>Nem sikerült betölteni a kísérletet.</p><button className="mzp-cta" onClick={refetch}>Újrapróbálom</button></div> : !experiment ? <p>Ez a kísérlet nem található.</p> :
        <EntranceGroup className="col gap-md">
          <section className={`mzp-pred rise ${meta?.wash ?? ''}`}>
            <span className={`mzp-stch ${meta?.chip}`}>{meta?.label}</span>
            <h2 className="mzp-title">Mit vizsgálunk?</h2><p className="mzp-basis">{experiment.hypothesis}</p>
            {experiment.status === 'proposed' && mode === 'live' && <div className="mzp-decrow"><button className="mzp-cta" disabled={pending} onClick={() => decide(experiment.id, 'accept')}>Elfogadom</button><button className="mzp-ghost" disabled={pending} onClick={() => decide(experiment.id, 'dismiss')}>Elvetem</button></div>}
          </section>
          {experiment.status === 'active' && <section className="mzp-pred amber rise"><h2 className="mzp-title">Hol tartunk?</h2><p>{experiment.day}/{experiment.total} nap</p><div className="mzp-daydots" aria-hidden="true">{Array.from({ length: experiment.total }, (_, day) => <i key={day} className={day < experiment.day ? 'f' : ''} />)}</div><div className="mzp-gbar"><div className="gold" style={{ width: `${experiment.total > 0 ? Math.min(100, Math.round(experiment.day / experiment.total * 100)) : 0}%` }} /></div><p className="mzp-basis">Az eltelt napokat látod. Az eredmény a lezárt megfigyelés után jelenik meg.</p></section>}
          <section className="mzp-pred rise"><h2 className="mzp-title">Eredmény</h2><p className="mzp-basis">{experiment.outcome || (experiment.status === 'dismissed' ? 'Ezt a javaslatot elvetetted; nem indult belőle kísérlet.' : experiment.status === 'completed' ? 'A kísérlet lezárult, de nincs szöveges eredmény.' : 'Még nincs lezárt eredmény.')}</p></section>
        </EntranceGroup>}
    </PageBody>
  </MozaikPage>
}
