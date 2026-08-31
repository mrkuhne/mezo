// ============================================================
// Mezo · Karakter — RunPage (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `renderRun` — the generic
// run-detail page every Futások row (and, from Task 5, every Feed ⚙) opens into: hero
// (kind icon + date + narrative lede) → RunFlowStrip → the signal chain (NIGHTLY) or the
// called-experts row (all kinds) → an AI-napló deep-link row.
//
// Honest states (plan's Global Constraints):
//  · run === null (unknown/foreign id — the useCharacterRun 404 idiom) -> a quiet "not
//    found" face, never a crash. This is DIFFERENT from FutasokPage's "nincs adat erről az
//    éjszakáról": here an id WAS given by a caller and simply doesn't resolve, vs. a day in
//    the timeline that never got a row at all. Uses `.kr-degraded` — the feature's ONE
//    established 404/switch-off idiom (DimensionPage, DimensionsPage, KarakterHubPage,
//    CharacterFeedPage all render the same bordered card; fix round 1 caught this page using
//    a different, one-off class, `.kr-konz-empty`, borrowed from KonziliumPage).
//  · NIGHTLY + observationCount === 0 -> the proud quiet-night face (QUIET_MSG) — never a
//    fabricated signal chain for a night nothing fired on.
//  · conference-kind runs (WEEKLY/MONTHLY/BOOTSTRAP) never show a "0 hívás" flow-strip cell
//    (binding ruling — see `flowSteps` below).
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterExperts, useCharacterRun } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { RunFlowStrip, type RunFlowStep } from '@/features/character/components/RunFlowStrip'
import { SignalChainCard } from '@/features/character/components/SignalChainCard'
import { KIND_LABEL, NOT_CALLED_LINE, QUIET_MSG, runHeroLede } from '@/features/character/runLabels'
import { huMonthDay } from '@/shared/lib/dates'
import type { CharacterRunSummary } from '@/data/character/characterApi'

/** BINDING RULING (task-4 brief): callCount is honest ONLY for NIGHTLY — a "hívás" step for
 *  WEEKLY/MONTHLY/BOOTSTRAP would render their deliberate `callCount: 0` (see
 *  characterMock.ts / CharacterConferenceService's javadoc) as "0 hívás", misreading as
 *  "nobody was called" instead of "not tracked at this level" (the AI-napló row IS that
 *  truth for those kinds).
 *
 *  Fix round 1: a generic "megfigyelés"-labeled fallback cell for every non-NIGHTLY kind
 *  used to sit here — but MONTHLY's `observationCount` counts re-evaluated ÁLLÍTÁSOK
 *  (claims) and BOOTSTRAP's counts kezdő állítások, not megfigyelések. Labeling either as
 *  "megfigyelés" directly contradicted `runHeroLede`'s own sentence two lines above it.
 *  WEEKLY's count genuinely IS a megfigyelés count (consumed observations), so it keeps an
 *  honest single-step strip; MONTHLY/BOOTSTRAP get NO flow strip at all — the prototype's own
 *  `renderRun` never gives havi/bootstrap a `statsHtml` stat row either (karakter-body.html);
 *  the narrative hero already carries the number with the right noun for those two kinds. */
function flowSteps(run: CharacterRunSummary): RunFlowStep[] | null {
  if (run.kind === 'NIGHTLY') {
    return [
      { label: 'jel', value: run.observationCount },
      { label: 'hívás', value: run.callCount },
      { label: 'megfigyelés', value: run.observationCount },
    ]
  }
  if (run.kind === 'WEEKLY') return [{ label: 'megfigyelés', value: run.observationCount }]
  return null
}

const OP_LABEL: Record<CharacterRunSummary['kind'], string> = {
  NIGHTLY: 'megfigyelés',
  WEEKLY: 'javaslat / döntés',
  MONTHLY: 'áttekintés',
  BOOTSTRAP: 'áttekintés',
}

export function RunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { run, isLoading } = useCharacterRun(id ?? null)
  const { experts, isLoading: expertsLoading } = useCharacterExperts()

  if (isLoading || expertsLoading) return null

  const goFutasok = () => navigate('/me/karakter/gepterem/futasok')

  if (run == null) {
    return (
      <div className="kr-hub">
        <PageHead onBack={goFutasok} label="‹ Futások" />
        <div className="kr-degraded">Ez a futás nem található.</div>
      </div>
    )
  }

  const { summary } = run
  const expertName = (key: string) => experts.find((e) => e.key === key)?.displayName ?? key
  const quietNight = summary.kind === 'NIGHTLY' && summary.observationCount === 0
  const steps = flowSteps(summary)

  return (
    <div className="kr-hub">
      <PageHead onBack={goFutasok} label="‹ Futások" />
      <div className="mz-page-hero">
        <div className="kr-run-ic">
          <ClaySpot name={summary.kind === 'NIGHTLY' ? 's-orb-ejszaka' : 's-orb'} size={54} />
        </div>
        <div className="mz-hero-nm">{KIND_LABEL[summary.kind]}</div>
        <div className="mz-hero-sb">
          {huMonthDay(summary.day)}.
          {quietNight && <span className="kr-quietmark"> · csendes nap</span>}
        </div>
        <p className="kr-runlede">{runHeroLede(summary, expertName)}</p>
      </div>

      <div className="mz-page-body">
        {steps != null && <RunFlowStrip steps={steps} />}

        {quietNight && (
          <>
            <div className="kr-quietnote">{QUIET_MSG}</div>
            <div className="kr-runsubttl">Hívott szakértők</div>
            <p className="kr-sectnote">{NOT_CALLED_LINE}</p>
          </>
        )}

        {summary.kind === 'NIGHTLY' && !quietNight && (
          <>
            {run.observations.map((obs, i) => (
              <SignalChainCard key={obs.id} observation={obs} index={i} expertName={expertName(obs.expertKey)} />
            ))}
            <div className="kr-runsubttl">Hívott szakértők</div>
            <div className="kr-opchips">
              {summary.expertKeys.map((key) => (
                <div className="kr-opchip" key={key}>
                  <PersonaOrb expertKey={key} size={20} />
                  <div className="kr-opchip-tx"><b>{expertName(key)}</b><small>{OP_LABEL.NIGHTLY}</small></div>
                </div>
              ))}
            </div>
            <p className="kr-sectnote">{NOT_CALLED_LINE}</p>
          </>
        )}

        {summary.kind !== 'NIGHTLY' && (
          <>
            <div className="kr-runsubttl">Hívott szakértők</div>
            <div className="kr-opchips">
              {summary.expertKeys.map((key) => (
                <div className="kr-opchip" key={key}>
                  <PersonaOrb expertKey={key} size={20} />
                  <div className="kr-opchip-tx"><b>{expertName(key)}</b><small>{OP_LABEL[summary.kind]}</small></div>
                </div>
              ))}
            </div>
            {/* Konzílium-futásnál a valódi transzkriptre visz — KonziliumPage's own `?id=`
               idiom (frontend/src/features/character/pages/KonziliumPage.tsx). MONTHLY/
               BOOTSTRAP link the same way when they carry a conferenceId (both do, per the
               mock seed) since their outcome also lives on a konzílium record. */}
            {summary.conferenceId != null && (
              <button
                type="button"
                className="cta kr-runlink"
                onClick={() => navigate(`/me/karakter/konzilium?id=${summary.conferenceId}`)}
              >
                Teljes transzkript megnyitása ›
              </button>
            )}
          </>
        )}

        {/* AI-napló mélylink (task-4 brief): AiCallFilters' `filters` state is a plain
           useState in AiUsagePage (frontend/src/features/me/pages/AiUsagePage.tsx), not
           URL-driven — there is no `?feature=` param it reads. Navigating unfiltered rather
           than fabricating query-param support the target page doesn't have; an honest gap,
           not a shortcut (task-4 brief's explicit fallback for this case). */}
        <button type="button" className="kr-ainaplolink" onClick={() => navigate('/me/ai-usage')}>
          <ClayIcon name="i-tudas" size={22} />
          <div className="kr-tx">Ehhez a futáshoz tartozó nyers hívások az AI-naplóban</div>
          <span className="kr-chev" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  )
}
