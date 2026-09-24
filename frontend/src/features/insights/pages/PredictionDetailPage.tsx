// ============================================================
// Mezo · PredictionDetailPage — egy előrejelzés „Miből látszik?" mélyoldala.
// Üvegben (Üvegesítés U8a, mezo-me75u.13): prototypes/uveg-uzenofal.html #elore/*.
// EGY üveg-hero: függőben a várakozás + a bizonyosság-gyűrű; lezárva „Ezt vártam — és ez
// történt". Minden más lapos panel; a vissza-gomb oda visz, ahonnan jöttél (`useBackTo`).
// ============================================================
import { useParams, useSearchParams } from 'react-router-dom'
import { useFeedback, usePredictions } from '@/data/hooks'
import { useBackTo } from '@/shared/hooks/useBackNav'
import {
  DayRing, DetailFrame, DetailHero, DetailState, SectionHead, StatePill,
} from '@/features/insights/components/DetailHero'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { PREDICTION_STATE } from '@/features/insights/logic/predictionStatus'
import type { Prediction } from '@/data/types'

/** „Mi történt?" — a régi szöveg szó szerint, a glifa nélkül (bible U6/45). */
function happenedText(prediction: Prediction): string {
  if (prediction.actual) return `${prediction.status === 'validated' ? 'Bejött' : 'Megfigyelt eredmény'}: ${prediction.actual}`
  return prediction.status === 'pending'
    ? 'Az eredmény még nem ismert. A megfigyelési időszak adatai alapján értékeljük.'
    : 'Ehhez a lezárt előrejelzéshez nincs szöveges eredmény.'
}

const LEARNING = 'Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.'

/** A direct link resolves only the current user's existing prediction list. */
export function PredictionDetailPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const back = useBackTo(`/mezo/predictions?${search}`, 'Előrejelzések')
  const { predictions, isPending, isError, refetch } = usePredictions()
  const prediction = predictions.find((item) => item.id === id)
  const feedback = useFeedback('prediction', prediction ? [prediction.id] : [])

  let body
  if (isPending) {
    body = <DetailState art="t-clock" kind="loading" role="status">Betöltés…</DetailState>
  } else if (isError) {
    body = (
      <DetailState art="t-info" role="alert">
        <span>Nem sikerült betölteni az előrejelzést.</span>
        <button type="button" className="pdt-retry" onClick={refetch}>Újrapróbálom</button>
      </DetailState>
    )
  } else if (!prediction) {
    body = <DetailState art="t-info">Ez az előrejelzés nem található.</DetailState>
  } else {
    const state = PREDICTION_STATE[prediction.status]
    const resolved = prediction.status !== 'pending'
    const confidence = prediction.confidence == null ? null : Math.round(prediction.confidence * 100)
    body = (
      <>
        <DetailHero tone={resolved ? state.tone : 'sky'} art="t-orb" labelledBy="prd-title"
          eyebrow={prediction.date} title={<span id="prd-title">{prediction.title}</span>}
          pill={<StatePill label={state.label} tone={state.tone} art={state.art} />}>
          {resolved ? (
            <>
              <div className="pdt-vs">
                <div><small>Ezt vártam</small><p>{`${prediction.title.trim().replace(/[.?!]+$/, '')}.`}</p></div>
                <div><small>Ez történt</small><p>{happenedText(prediction)}</p></div>
              </div>
              <p className="pdt-hypothesis">{prediction.status === 'validated'
                ? 'Bejött — ez a jel erősödik a következő becsléseknél.'
                : 'Nem jött be — ez is számít: ebből a jelből ezután óvatosabban következtetek.'}</p>
            </>
          ) : (
            <div className="pdt-core">
              {confidence == null
                ? <DayRing value="?" pct={0} unit="TANULOM" tone="sky" unknown />
                : <DayRing value={<>{confidence}<i>%</i></>} pct={confidence} unit="BECSLÉS" tone="sky" />}
              <div className="pdt-answer">
                <h1>Mennyire biztos benne Boop?</h1>
                <p className="pdt-answer-sub">{confidence == null ? LEARNING : <><b>{confidence}%</b> becsült megbízhatóság</>}</p>
              </div>
            </div>
          )}
        </DetailHero>

        {resolved && (
          <>
            <SectionHead title="Mennyire biztos benne Boop?" />
            {confidence == null
              ? <DetailState art="t-clock">{LEARNING}</DetailState>
              : (
                <section className="pdt-flat pdt-conf rise">
                  <div className="pdt-conf-head"><strong>{confidence}%</strong><span>becsült megbízhatóság</span></div>
                  <span className="uv-bar pdt-tone-sky"><b style={{ '--w': `${confidence}%` } as React.CSSProperties} /></span>
                </section>
              )}
          </>
        )}

        <SectionHead title="Miből következik?" />
        <section className="pdt-flat rise">
          <p className="pdt-prose">{prediction.basis || 'Ehhez az előrejelzéshez nem érkezett részletes indoklás.'}</p>
        </section>

        {!resolved && (
          <>
            <SectionHead title="Mi történt?" />
            <section className="pdt-flat rise"><p className="pdt-prose is-mute">{happenedText(prediction)}</p></section>
          </>
        )}

        <SectionHead title="Hasznos volt?" />
        <section className="pdt-flat pdt-feedback rise">
          <FeedbackChips glyph3d value={feedback.get(prediction.id)}
            onVote={(verdict, reason) => feedback.vote(prediction.id, verdict, reason)} label="az előrejelzésről" />
        </section>
      </>
    )
  }

  return <DetailFrame back={back} eyebrow="Előrejelzés">{body}</DetailFrame>
}
