// ============================================================
// Mezo · ExperimentDetailPage — egy kísérlet „Miből látszik?" mélyoldala.
// Üvegben (Üvegesítés U8a, mezo-me75u.13): prototypes/uveg-uzenofal.html #kiserlet-oldal/*.
// EGY üveg-hero: futó kísérletnél „Hol tartunk?" (nap-gyűrű + a napok cellái), javaslatnál a
// kérdés és a két döntés, lezárva az eredmény. Minden más lapos panel; a vissza-gomb oda visz,
// ahonnan jöttél (`useBackTo`).
// ============================================================
import { useParams, useSearchParams } from 'react-router-dom'
import { useExperimentActions, useExperiments } from '@/data/hooks'
import { useBackTo } from '@/shared/hooks/useBackNav'
import {
  DayRing, DecisionRow, DetailFrame, DetailHero, DetailState, SectionHead, StatePill, toneClass,
} from '@/features/insights/components/DetailHero'
import { experimentStateOf } from '@/features/insights/components/experimentStatus'
import type { Experiment } from '@/data/types'

function outcomeText(experiment: Experiment): string {
  return experiment.outcome || (experiment.status === 'dismissed'
    ? 'Ezt a javaslatot elvetetted; nem indult belőle kísérlet.'
    : experiment.status === 'completed' ? 'A kísérlet lezárult, de nincs szöveges eredmény.' : 'Még nincs lezárt eredmény.')
}

export function ExperimentDetailPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const back = useBackTo(`/mezo/experiments?${search}`, 'Kísérletek')
  const { experiments, mode, isPending, isError, refetch } = useExperiments()
  const { decide, pending } = useExperimentActions()
  const experiment = experiments.find((item) => item.id === id)

  let body
  if (isPending) {
    body = <DetailState art="t-clock" kind="loading" role="status">Betöltés…</DetailState>
  } else if (isError) {
    body = (
      <DetailState art="t-info" role="alert">
        <span>Nem sikerült betölteni a kísérletet.</span>
        <button type="button" className="pdt-retry" onClick={refetch}>Újrapróbálom</button>
      </DetailState>
    )
  } else if (!experiment) {
    body = <DetailState art="t-info">Ez a kísérlet nem található.</DetailState>
  } else {
    const state = experimentStateOf(experiment)
    const pct = experiment.total > 0 ? Math.min(100, Math.round(experiment.day / experiment.total * 100)) : 0
    const active = experiment.status === 'active'
    const proposed = experiment.status === 'proposed'
    body = (
      <>
        <DetailHero tone={state.hero} art="t-flask" eyebrow={`${experiment.total} napos saját megfigyelés`}
          title={experiment.title} pill={<StatePill label={state.label} tone={state.tone} art={state.art} />}>
          {active ? (
            <>
              <div className="pdt-core">
                <DayRing value={experiment.day} of={experiment.total} pct={pct} unit="NAP" tone={state.hero} />
                <div className="pdt-answer">
                  <h1>Hol tartunk?</h1>
                  <p className="pdt-answer-sub"><b>{experiment.day}/{experiment.total} nap.</b> Az eltelt napokat látod. Az eredmény a lezárt megfigyelés után jelenik meg.</p>
                </div>
              </div>
              <div className="pdt-xdays">
                <small>Az eltelt napok</small>
                <div className={`pdt-dcells ${toneClass(state.hero)}`} aria-hidden="true">
                  {Array.from({ length: experiment.total }, (_, day) => (
                    <span key={day} className={day < experiment.day ? 'is-done' : undefined}>{day + 1}.</span>
                  ))}
                </div>
              </div>
            </>
          ) : proposed ? (
            <>
              <div className="pdt-outc"><small>Mit vizsgálunk?</small><p>{experiment.hypothesis}</p></div>
              {mode === 'live' && (
                <DecisionRow label="Döntés a kísérletről" buttons={[
                  { key: 'accept', label: 'Elfogadom', art: 't-tick', disabled: pending, onClick: () => decide(experiment.id, 'accept') },
                  { key: 'dismiss', label: 'Elvetem', art: 't-skip', no: true, disabled: pending, onClick: () => decide(experiment.id, 'dismiss') },
                ]} />
              )}
            </>
          ) : (
            <div className="pdt-outc"><small>Eredmény</small><p>{outcomeText(experiment)}</p></div>
          )}
        </DetailHero>

        {!proposed && (
          <>
            <SectionHead title="Mit vizsgálunk?" />
            <section className="pdt-flat rise"><p className="pdt-prose">{experiment.hypothesis}</p></section>
          </>
        )}
        {(active || proposed) && (
          <>
            <SectionHead title="Eredmény" />
            <section className="pdt-flat rise"><p className="pdt-prose is-mute">{outcomeText(experiment)}</p></section>
          </>
        )}
      </>
    )
  }

  return <DetailFrame back={back} eyebrow="Kísérlet">{body}</DetailFrame>
}
