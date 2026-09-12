// ============================================================
// Mezo · Karakter — KonziliumPage (mezo-sp9w)
// Döntés-első felület. A régi lista+részlet kettősség megszűnt: `?id=` nélkül a LEGUTÓBBI
// tanácskozás nyílik, a korábbiakat a fejléc léptetője és az archívum lap éri el. Ezért van a
// lapon pontosan EGY visszalépő vezérlő (`PageHead`) — a "vissza a listához" gomb megszűnt.
//
// A lap három rétege, ebben a sorrendben: kontextus (Mi ez + Hogyan zajlott) → eredmény
// (Mi változott a dossziédban) → a vita (szálak, vagy a Beszélgetés nézet köreiben).
//
// Két forrás, két címke, soha nem összevonva:
// - "Mi változott a dossziédban" a `changes[]`-ből számol — ez a TARTÓS hatás;
// - a kör-térkép 4. cellája a `deliberation`-ből — ezek a tanácskozás DÖNTÉSEI.
// ============================================================
import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterConference, useCharacterConferences, useCharacterExperts } from '@/data/hooks'
import { TranscriptTurn } from '@/features/character/components/TranscriptTurn'
import { ConferenceThreadCard } from '@/features/character/components/ConferenceThreadCard'
import { ConferenceArchiveSheet } from '@/features/character/components/ConferenceArchiveSheet'
import { KonziliumRoundMap, KonziliumWhatIs } from '@/features/character/components/KonziliumRoundMap'
import { KonziliumConversationView } from '@/features/character/components/KonziliumConversationView'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterConferenceSummary, CharacterExpertDto, ConferenceTurn } from '@/data/character/characterApi'

const KIND_WORD: Record<CharacterConferenceSummary['kind'], string> = {
  WEEKLY: 'heti',
  MONTHLY: 'havi',
  BOOTSTRAP: 'első beolvasás',
}

const HONESTY_NOTE = 'A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja '
  + 'utólag; amit itt olvasol, azt a csapat pontosan így mondta.'

const ACCEPTED = 'CLAIM_ACCEPTED'
const RETIRED = 'CLAIM_RETIRED'
const REWRITTEN = 'PORTRAIT_REWRITTEN'

function headerDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })
}

type TurnKind = 'EXPERT' | 'SKEPTIC' | 'CHAIR'

function turnKindOf(persona: string, experts: CharacterExpertDto[]): TurnKind {
  const kind = experts.find((e) => e.key === persona)?.kind
  return kind === 'SKEPTIC' ? 'SKEPTIC' : kind === 'CHAIR' ? 'CHAIR' : 'EXPERT'
}

function phaseOf(kind: TurnKind): string {
  if (kind === 'SKEPTIC') return 'A Szkeptikus'
  if (kind === 'CHAIR') return 'Döntés'
  return 'Javaslatok'
}

type Block =
  | { block: 'phase'; label: string }
  | { block: 'group'; turns: ConferenceTurn[]; kinds: TurnKind[] }
  | { block: 'ruling'; turn: ConferenceTurn }

/** The prose fallback for a conference whose threads could not be derived at all. */
function buildBlocks(turns: ConferenceTurn[], experts: CharacterExpertDto[]): Block[] {
  const blocks: Block[] = []
  let lastPhase: string | null = null
  let group: (Block & { block: 'group' }) | null = null

  for (const turn of turns) {
    const kind = turnKindOf(turn.persona, experts)
    const phase = phaseOf(kind)
    if (phase !== lastPhase) {
      group = null
      blocks.push({ block: 'phase', label: phase })
      lastPhase = phase
    }
    if (kind === 'CHAIR') {
      blocks.push({ block: 'ruling', turn })
      group = null
    } else {
      if (group == null) {
        group = { block: 'group', turns: [], kinds: [] }
        blocks.push(group)
      }
      group.turns.push(turn)
      group.kinds.push(kind)
    }
  }
  return blocks
}

export function KonziliumPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { conferences, isLoading: listLoading } = useCharacterConferences()
  const { experts, isLoading: expertsLoading } = useCharacterExperts()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [view, setView] = useState<'overview' | 'conversation'>('overview')

  // `?id=` absent means "the latest" — the list arrives generatedAt DESC, so index 0 is it.
  const requestedId = params.get('id')
  const currentId = requestedId ?? (conferences.length > 0 ? conferences[0].id : null)
  const { conference, isLoading: detailLoading } = useCharacterConference(currentId)

  // Fix round 1 (mezo-sp9w, review finding 3): the reset must be a consequence of the council
  // actually changing, not of the stepper's click handler — a browser back/forward that swaps
  // `?id=` in the query string bypasses any click handler entirely, and previously left the
  // reader stuck in the chronological view on a different council. Must run before the loading
  // early-return below so it obeys the rules of hooks.
  //
  // C2 (mezo-sp9w branch-review): `archiveOpen` resets here too, for the identical reason.
  // `ConferenceArchiveSheet.onPick` used to rely on the sheet's own `close()` reporting
  // completion (a transition-end handler or a 300ms fallback timer) before flipping the
  // selected id — but `onPick` changing `currentId` can itself put the detail query into a
  // loading state, which makes this component return `null` a few lines below and unmount the
  // sheet before its close animation ever gets to report back. No `onClose` ever fires, so
  // `archiveOpen` stayed stuck `true`, and the sheet reappeared, fully open, once the new
  // conference finished loading. Driving `archiveOpen` off the same effect as `view` — a
  // consequence of `currentId` actually changing, not of any callback's timing — closes it no
  // matter how the animation and the query race.
  useEffect(() => {
    setView('overview')
    setArchiveOpen(false)
  }, [currentId])

  // Folding expertsLoading in matters: without it the window between the conference settling and
  // the expert catalog arriving misclassifies every turn as a plain EXPERT (mezo-xlvr, I5).
  if (listLoading || (currentId != null && detailLoading) || expertsLoading) return null

  const index = conferences.findIndex((c) => c.id === currentId)
  const olderId = index >= 0 && index + 1 < conferences.length ? conferences[index + 1].id : null
  const newerId = index > 0 ? conferences[index - 1].id : null

  function go(id: string | null) {
    if (id == null) return
    setParams({ id })
  }

  if (conferences.length === 0) {
    return (
      <div className="kr-hub">
        <PageHead onBack={() => navigate('/mezo/karakter')} label="‹ Karakter" />
        <div className="mz-page-hero"><div className="mz-hero-nm">Konzílium</div></div>
        <div className="mz-page-body">
          <div className="kr-konz-empty">Egyelőre nincs konzílium — a csapat hetente tanácskozik, ez az első hét még nem zajlott le.</div>
        </div>
      </div>
    )
  }

  const summary = index >= 0 ? conferences[index] : null
  // C1 (mezo-sp9w branch-review): two conditions, kept apart on purpose. Only a WEEKLY meeting
  // ever runs a cross-talk round at all — CharacterBootstrapService and CharacterMonthlyService
  // both assemble their stored envelope with an honestly empty reaction list, because neither
  // kind has this round. `deliberationSource === 'STORED'` alone answers a different question
  // (are these threads the meeting's own, not read back out of an old prose transcript) and a
  // MONTHLY/BOOTSTRAP row can be `STORED` too — so `deliberationSource` alone would tell those
  // two kinds a round happened and produced nothing, when the truth is the round never existed
  // for them.
  const hasCrossTalkRound = conference?.kind === 'WEEKLY'
  const threadsAreOwn = conference?.deliberationSource === 'STORED'
  const crossTalkRan = hasCrossTalkRound && threadsAreOwn
  // Fix round 1 (mezo-sp9w, review finding 1): an empty-but-present thread envelope is a real,
  // reachable backend state (a proposal round that yielded nothing) — treat it exactly like a
  // missing one so the prose transcript fallback runs, instead of silently rendering a
  // thread-less, transcript-less void. Every consumer below reads this same `threads` value, so
  // the round map, the view switcher and the thread list all agree on whether this council has
  // structured threads.
  const rawThreads = conference?.deliberation ?? null
  const threads = rawThreads != null && rawThreads.length > 0 ? rawThreads : null

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/mezo/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Konzílium</div>
        {summary != null && (
          <div className="kr-stepper">
            <button
              type="button"
              className="kr-navbtn"
              aria-label="Korábbi tanácskozás"
              disabled={olderId == null}
              onClick={() => go(olderId)}
            >‹</button>
            <button
              type="button"
              className="kr-datebtn"
              aria-haspopup="dialog"
              onClick={() => setArchiveOpen(true)}
            >
              {`${headerDate(summary.generatedAt)} · ${KIND_WORD[summary.kind]}`}
              <span className="kr-datecv" aria-hidden="true">⌄</span>
            </button>
            <button
              type="button"
              className="kr-navbtn"
              aria-label="Későbbi tanácskozás"
              disabled={newerId == null}
              onClick={() => go(newerId)}
            >›</button>
          </div>
        )}
      </div>

      {conference == null && (
        <div className="mz-page-body">
          <div className="kr-konz-empty">Ez a konzílium nem található.</div>
          {/* Fix round 1 (mezo-sp9w, review finding 7): without the stepper (no `summary` to
              anchor it) a bad deep link stranded the reader with no way into the archive except
              leaving the screen — reusing the date button's own affordance keeps this the only
              non-PageHead exit, not a second back control. */}
          <button
            type="button"
            className="kr-datebtn"
            aria-haspopup="dialog"
            onClick={() => setArchiveOpen(true)}
          >Korábbi tanácskozások</button>
        </div>
      )}

      {conference != null && (
        <div className="mz-page-body">
          {threads != null && (
            <div className="kr-viewseg" role="group" aria-label="Nézet">
              <button
                type="button"
                className={view === 'overview' ? 'on' : ''}
                onClick={() => setView('overview')}
              >Áttekintés</button>
              <button
                type="button"
                className={view === 'conversation' ? 'on' : ''}
                onClick={() => setView('conversation')}
              >Beszélgetés</button>
            </div>
          )}

          {view === 'conversation' && threads != null
            ? <KonziliumConversationView threads={threads} experts={experts} crossTalkRan={crossTalkRan} />
            : (
                <>
                  <KonziliumWhatIs kind={conference.kind} />
                  {threads != null && <KonziliumRoundMap threads={threads} crossTalkRan={crossTalkRan} />}

                  {(() => {
                    const accepted = conference.changes.filter((c) => c.kind === ACCEPTED).length
                    const retired = conference.changes.filter((c) => c.kind === RETIRED).length
                    const rewritten = conference.changes.filter((c) => c.kind === REWRITTEN).length
                    const extras = conference.changes.filter((c) => ![ACCEPTED, RETIRED, REWRITTEN].includes(c.kind))
                    return (
                      <div className="kr-outcomehd">
                        <div className="kr-oh-title">Mi változott a dossziédban</div>
                        <div className="kr-outcells">
                          <div className="kr-outcell" style={{ '--ow': 'rgba(143,175,126,0.2)', '--oc': '#4E6B42' } as CSSProperties}>
                            <b>{accepted}</b><small>bekerült</small>
                          </div>
                          <div className="kr-outcell" style={{ '--ow': 'rgba(201,150,46,0.18)', '--oc': '#A8801F' } as CSSProperties}>
                            <b>{retired}</b><small>nyugdíjazva</small>
                          </div>
                          <div className="kr-outcell" style={{ '--ow': 'rgba(138,118,204,0.16)', '--oc': '#5D4FA0' } as CSSProperties}>
                            <b>{rewritten}</b><small>portré átírva</small>
                          </div>
                        </div>
                        {extras.map((c, i) => <div className="kr-outcome-extra" key={i}>{c.summary}</div>)}
                      </div>
                    )
                  })()}

                  {threads != null
                    ? threads.map((thread, i) => (
                        <ConferenceThreadCard
                          key={`${thread.title}-${i}`}
                          thread={thread}
                          experts={experts}
                          crossTalkRan={crossTalkRan}
                        />
                      ))
                    : buildBlocks(conference.transcript, experts).map((b, i) => {
                        if (b.block === 'phase') return <div className="kr-phaselbl" key={i}>{b.label}</div>
                        if (b.block === 'ruling') {
                          return (
                            <TranscriptTurn
                              key={i}
                              turn={b.turn}
                              kind="CHAIR"
                              displayName={experts.find((e) => e.key === b.turn.persona)?.displayName ?? 'Mezo'}
                              color={expertColor(b.turn.persona)}
                              delayMs={i * 90}
                            />
                          )
                        }
                        return (
                          <div className="kr-turnsgroup" key={i}>
                            {b.turns.map((turn, ti) => (
                              <TranscriptTurn
                                key={ti}
                                turn={turn}
                                kind={b.kinds[ti]}
                                displayName={experts.find((e) => e.key === turn.persona)?.displayName ?? turn.persona}
                                color={expertColor(turn.persona)}
                                delayMs={(i + ti) * 90}
                              />
                            ))}
                          </div>
                        )
                      })}
                </>
              )}

          <p className="kr-honestynote">{HONESTY_NOTE}</p>
        </div>
      )}

      {archiveOpen && (
        <ConferenceArchiveSheet
          conferences={conferences}
          currentId={currentId}
          onPick={(id) => go(id)}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  )
}
