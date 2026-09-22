import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFeedback, usePredictions } from '@/data/hooks'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { PREDICTION_STATUS } from '@/features/insights/logic/predictionStatus'

/** A direct link resolves only the current user's existing prediction list. */
export function PredictionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { predictions, isPending, isError, refetch } = usePredictions()
  const prediction = predictions.find((item) => item.id === id)
  const feedback = useFeedback('prediction', prediction ? [prediction.id] : [])
  return <MozaikPage tone="sky">
    <PageHead onBack={() => navigate(`/mezo/predictions?${search}`)} label="‹ Előrejelzések" />
    <PageHero icon="i-kristaly" name={prediction?.title ?? 'Előrejelzés'} sub={prediction?.date} />
    <PageBody>
      {isPending ? <p role="status">Betöltés…</p> : isError ? <div role="alert"><p>Nem sikerült betölteni az előrejelzést.</p><button className="mzp-cta" onClick={refetch}>Újrapróbálom</button></div> : !prediction ? <p>Ez az előrejelzés nem található.</p> :
        <EntranceGroup className="col gap-md">
          <section className={`mzp-pred rise ${PREDICTION_STATUS[prediction.status].wash ?? ''}`}>
            <span className={`mzp-stch ${PREDICTION_STATUS[prediction.status].chip}`}>{PREDICTION_STATUS[prediction.status].label}</span>
            <h2 className="mzp-title">Mennyire biztos benne Boop?</h2>
            <p className="mzp-basis">{prediction.confidence == null ? 'Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.' : `${Math.round(prediction.confidence * 100)}% becsült megbízhatóság`}</p>
            {prediction.confidence != null && <div className="mzp-gbar"><div style={{ width: `${Math.round(prediction.confidence * 100)}%` }} /></div>}
          </section>
          <section className="mzp-pred rise"><h2 className="mzp-title">Miből következik?</h2><p className="mzp-basis">{prediction.basis || 'Ehhez az előrejelzéshez nem érkezett részletes indoklás.'}</p></section>
          <section className="mzp-pred rise"><h2 className="mzp-title">Mi történt?</h2><p className="mzp-basis">{prediction.actual ? `${prediction.status === 'validated' ? '✓ Bejött' : 'Megfigyelt eredmény'}: ${prediction.actual}` : prediction.status === 'pending' ? 'Az eredmény még nem ismert. A megfigyelési időszak adatai alapján értékeljük.' : 'Ehhez a lezárt előrejelzéshez nincs szöveges eredmény.'}</p></section>
          <section className="mzp-pred rise"><h2 className="mzp-title">Hasznos volt?</h2><FeedbackChips value={feedback.get(prediction.id)} onVote={(verdict, reason) => feedback.vote(prediction.id, verdict, reason)} label="az előrejelzésről" /></section>
        </EntranceGroup>}
    </PageBody>
  </MozaikPage>
}
