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
//    a different, one-off class, `.kr-konz-empty`, borrowed from KonziliumPage). Üveg re-dress
//    (U9): the not-found face is the csapatfal's dashed `tf-dash` (bible §3 rank 4).
//  · NIGHTLY + observationCount === 0 AND detectorKeys.length === 0 (isQuietNightly) -> the
//    proud quiet-night face (QUIET_MSG) — never a fabricated signal chain for a night nothing
//    fired on. A catch-up run (detectors fired but no observation resulted — isCatchUpNightly)
//    is a DIFFERENT honest state (CATCHUP_MSG), never the quiet-night face (final review, I3).
//  · conference-kind runs (WEEKLY/MONTHLY/BOOTSTRAP) never show a "0 hívás" flow-strip cell
//    (binding ruling — see `flowSteps` below).
//
// Üveg re-dress (U9, mezo-me75u.9) — uveg-mezo-teljes-u9.js `futas()`: the slate dev-door head
// (Futás · date / kind), a lede sentence, the flow strip as flat numeral cells, sage flat notes,
// the signal chain as flat panels in the observing character's accent, flat op chips, and the
// AI-napló row as the page's one glass object. Expert names are the csapatfal characters'
// (`personaName`, owner 2026-09-25); keys and calls are unchanged.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import '@/features/insights/boop-world.css'
import { Icon3D } from '@/shared/ui/clay'
import { Boop } from '@/shared/ui/clay/boop/Boop'
import { GepteremHead } from '@/features/character/components/GepteremHead'
import { personaCharacter, personaName } from '@/features/character/personaCharacter'
import { useCharacterExperts, useCharacterRun } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { RunFlowStrip, type RunFlowStep } from '@/features/character/components/RunFlowStrip'
import { SignalChainCard } from '@/features/character/components/SignalChainCard'
import {
  CATCHUP_MSG,
  isCatchUpNightly,
  isQuietNightly,
  KIND_LABEL,
  NOT_CALLED_LINE,
  QUIET_MSG,
  runHeroLede,
} from '@/features/character/runLabels'
import { huMonthDay } from '@/shared/lib/dates'
import type { CharacterRunSummary } from '@/data/character/characterApi'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'

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
    // I3 (final review): "jel" used to reuse observationCount — signals ≠ observations, and the
    // summary carries no real signal count. `detectorKeys.length` is the nearest REAL number
    // (the distinct detectors that fired), so the strip's first cell is relabeled to match what
    // it actually counts.
    return [
      { label: 'detektor tüzelt', value: run.detectorKeys.length },
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
  EDITION: 'poszt',
}

/** Fix round (mezo-a9bo7.12): EDITION runs post AS the team characters (szunya/mocor/falat/
 *  deru/mezo, matching the backend's `TeamCharacter.key()`) — they are not "called experts" like
 *  NIGHTLY/WEEKLY/MONTHLY/BOOTSTRAP's expertKeys. Resolves the display name from the shared FE
 *  team registry (features/insights/logic/team.ts, the one place munkanevek live); an unknown key
 *  falls back to itself, same honesty rule as the expert catalog lookup below. */
function teamCharacterName(key: string): string {
  return TEAM[key as TeamCharacterId]?.name ?? key
}

export function RunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { run, isLoading } = useCharacterRun(id ?? null)
  // The expert catalog still gates the first paint (unchanged); the NAMES shown are the
  // csapatfal characters' (U9, owner 2026-09-25) — `personaName`, not the catalog displayName.
  const { isLoading: expertsLoading } = useCharacterExperts()

  if (isLoading || expertsLoading) return null

  const goFutasok = () => navigate('/mezo/karakter/gepterem/futasok')

  if (run == null) {
    return (
      <div className="tf-page tf-c-slate gtm-page gtm-run-page">
        <GepteremHead small="Futás" title="Futás" onBack={goFutasok} />
        <div className="tf-dash gtm-notfound" data-state="not-found">
          <Icon3D name="t-info" size={26} /><span>Ez a futás nem található.</span>
        </div>
      </div>
    )
  }

  const { summary } = run
  const expertName = (key: string) => personaName(key)
  const quietNight = isQuietNightly(summary)
  const catchUpNight = isCatchUpNightly(summary)
  const steps = flowSteps(summary)
  const small = `Futás · ${huMonthDay(summary.day)}.${quietNight ? ' · csendes nap' : ''}`

  return (
    <div className="tf-page tf-c-slate gtm-page gtm-run-page">
      <GepteremHead small={small} title={KIND_LABEL[summary.kind]} onBack={goFutasok} />
      <p className="gtm-lede gtm-runlede">{runHeroLede(summary, expertName)}</p>

      {steps != null && <RunFlowStrip steps={steps} />}

      {quietNight && (
        <>
          <div className="gtm-pnote tf-c-sage" data-state="quiet">{QUIET_MSG}</div>
          <div className="tf-sec"><h2>Hívott szakértők</h2></div>
          {summary.status === 'SUCCESS' && <p className="gtm-lede">{NOT_CALLED_LINE}</p>}
        </>
      )}

      {/* I3 (final review): a catch-up run (detectors fired, but no observation came out of
         it — e.g. the day's signals were already processed by an earlier run) is NOT a quiet
         night and must not render the proud QUIET_MSG face; it gets its own honest note and
         skips the signal-chain / "Hívott szakértők" sections entirely, since there is neither
         a chain to show nor an expert that was actually called. */}
      {catchUpNight && <div className="gtm-pnote tf-c-sage" data-state="catch-up">{CATCHUP_MSG}</div>}

      {summary.kind === 'NIGHTLY' && !quietNight && !catchUpNight && (
        <>
          {run.observations.length > 0 && (
            <div className="tf-sec"><h2>A jellánc</h2><span className="tf-hint">Egy sor = egy megfigyelés</span></div>
          )}
          {run.observations.map((obs, i) => (
            <SignalChainCard key={obs.id} observation={obs} index={i} expertName={expertName(obs.expertKey)} />
          ))}
          <div className="tf-sec"><h2>Hívott szakértők</h2></div>
          <OpChips keys={summary.expertKeys} name={expertName} op={OP_LABEL.NIGHTLY} />
          {summary.status === 'SUCCESS' && <p className="gtm-lede gtm-notcalled">{NOT_CALLED_LINE}</p>}
        </>
      )}

      {summary.kind !== 'NIGHTLY' && summary.kind !== 'EDITION' && (
        <>
          <div className="tf-sec"><h2>Hívott szakértők</h2></div>
          <OpChips keys={summary.expertKeys} name={expertName} op={OP_LABEL[summary.kind]} />
          {/* Konzílium-futásnál a valódi transzkriptre visz — KonziliumPage's own `?id=`
             idiom (frontend/src/features/character/pages/KonziliumPage.tsx). MONTHLY/
             BOOTSTRAP link the same way when they carry a conferenceId (both do, per the
             mock seed) since their outcome also lives on a konzílium record. */}
          {summary.conferenceId != null && (
            <div className="gtm-ctarow">
              <button
                type="button"
                className="tf-c-gold gtm-cta"
                onClick={() => navigate(`/mezo/karakter/konzilium?id=${summary.conferenceId}`)}
              >
                Teljes transzkript megnyitása ›
              </button>
            </div>
          )}
        </>
      )}

      {/* Fix round (mezo-a9bo7.12): EDITION posts AS the team characters — "Hívott szakértők" +
         a "consumed observations" flow strip / transcript link are all NIGHTLY/WEEKLY/MONTHLY/
         BOOTSTRAP concepts that don't apply here (the run's own content IS the edition's posts,
         surfaced on CharacterFeedPage — no separate transcript to open). Chips get their own
         honest header and resolve names from the FE team registry, not the expert catalog. */}
      {summary.kind === 'EDITION' && (
        <>
          <div className="tf-sec"><h2>Posztoló karakterek</h2></div>
          <OpChips keys={summary.expertKeys} name={teamCharacterName} op={OP_LABEL.EDITION} teamChars />
        </>
      )}

      {/* AI-napló mélylink (task-4 brief): AiCallFilters' `filters` state is a plain
         useState in AdminCostPage (frontend/src/features/admin/pages/AdminCostPage.tsx,
         moved from features/me under /admin in mezo-d5iy.13), not URL-driven — there is
         no `?feature=` param it reads. Navigating unfiltered rather than fabricating
         query-param support the target page doesn't have; an honest gap, not a shortcut
         (task-4 brief's explicit fallback for this case). The page's ONE glass object. */}
      <div className="tf-rows gtm-airow">
        <button type="button" className="glass tf-rowg tf-c-slate gtm-ai" onClick={() => navigate('/admin/cost')}>
          <Icon3D name="t-journal" size={30} />
          <span className="tf-rowtxt">
            <span className="tf-rowname">Ehhez a futáshoz tartozó nyers hívások az AI-naplóban</span>
          </span>
          <span className="tf-rowbadge" aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  )
}

/** The called experts / posting characters as flat chips: the character figure, its name and
 *  the op label, in the character's own accent. EDITION keys are already team-character ids
 *  (`teamChar`), so they draw the team avatar directly instead of the persona → character fold. */
function OpChips({ keys, name, op, teamChars = false }: {
  keys: string[]; name: (key: string) => string; op: string; teamChars?: boolean
}) {
  return (
    <div className="gtm-pills">
      {keys.map((key) => {
        const team = teamChars ? TEAM[key as TeamCharacterId] : undefined
        const accent = (team ?? personaCharacter(key)).accent
        return (
          <div className={`gtm-pill tf-c-${accent}`} key={key}>
            {team != null
              ? <span className={`tf-av tf-c-${team.accent} kr-persona`} aria-hidden="true"><Boop domain={team.boop} size={18} alive /></span>
              : <PersonaOrb expertKey={key} size={22} />}
            <span className="gtm-pill-tx"><b>{name(key)}</b><small>{op}</small></span>
          </div>
        )
      })}
    </div>
  )
}
