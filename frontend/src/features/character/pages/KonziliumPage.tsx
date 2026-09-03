// ============================================================
// Mezo · Karakter — KonziliumPage (mezo-1gim.13, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-konz` (`konzList` /
// `konzTranscript`) — a list of conference summaries; `?id=` opens one transcript (the
// WeekHub sibling idiom — `useSearchParams`, WeekLessonsPage's `?start=` precedent).
//
// List row — deliberate deviation from the prototype's per-row outcome summary
// ("2 elfogadva · 1 nyugdíjazva · 3 portré átírva"): `CharacterConferenceSummary`
// (GET /api/character/conference) carries `id`/`kind`/`weekStart`/`generatedAt` only — no
// outcome/change count (the same gap KarakterHubPage's Konzílium tile already documents for
// the hub). Only the FULL `CharacterConferenceResponse.changes[]`, fetched per-id, has that —
// so the list row shows date + kind badge only; the outcome only exists once a row is opened.
//
// Outcome cells — binding ruling: three cells map the change kinds this DTO actually carries
// (`ClaimLifecycle`/`CharacterConferenceService`, backend/.../character/service/):
// elfogadva=CLAIM_ACCEPTED, nyugdíjazva=CLAIM_RETIRED, portré=PORTRAIT_REWRITTEN. Every other
// kind that can appear (CLAIM_CONFIDENCE_UP/DOWN, CHAPTER_OPENED, CHAPTER_RETIRED, BOOTSTRAP)
// renders as an extra text line below the cells — never folded into a fabricated 4th cell.
// ============================================================
import { useSearchParams, useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterConference, useCharacterConferences, useCharacterExperts } from '@/data/hooks'
import { TranscriptTurn } from '@/features/character/components/TranscriptTurn'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterConferenceSummary, CharacterExpertDto, ConferenceTurn } from '@/data/character/characterApi'

const KIND_BADGE: Record<CharacterConferenceSummary['kind'], string> = {
  WEEKLY: 'HETI',
  MONTHLY: 'HAVI',
  BOOTSTRAP: 'BOOTSTRAP',
}

const HONESTY_NOTE = 'A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja '
  + 'utólag; amit itt olvasol, azt a csapat pontosan így mondta.'

function rowDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
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

/** Groups turns the way the prototype's render loop does: consecutive non-CHAIR turns share
 *  one dashed-rail `.turnsgroup`, a phase label is inserted whenever the phase changes, and a
 *  CHAIR (mezo) turn always breaks out into its own full-width ruling block. */
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

const ACCEPTED = 'CLAIM_ACCEPTED'
const RETIRED = 'CLAIM_RETIRED'
const REWRITTEN = 'PORTRAIT_REWRITTEN'

export function KonziliumPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const { conferences, isLoading: listLoading } = useCharacterConferences()
  const { conference, isLoading: detailLoading } = useCharacterConference(id)
  const { experts, isLoading: expertsLoading } = useCharacterExperts()

  // Fix round (final review, I5): without folding expertsLoading in, the pending window between
  // the conference/list data settling and the experts catalog arriving derived turnKindOf() off
  // a still-empty `experts` array — every turn (including Mezo's ruling) misclassified as plain
  // EXPERT, collapsing the phase labels and losing the CHAIR/ruling face.
  if (listLoading || (id != null && detailLoading) || expertsLoading) return null

  const showList = id == null

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Konzílium</div>
        <div className="mz-hero-sb">a csapat heti tanácskozásai</div>
      </div>

      {showList && (
        <div className="mz-page-body kr-konzlist">
          {conferences.length === 0 && (
            <div className="kr-konz-empty">Egyelőre nincs konzílium — a csapat hetente tanácskozik, ez az első hét még nem zajlott le.</div>
          )}
          {conferences.map((k, i) => (
            <button
              key={k.id}
              type="button"
              className="kr-konzrow rise"
              style={{ '--d': `${i * 50}ms` } as React.CSSProperties}
              onClick={() => setParams({ id: k.id })}
            >
              <div style={{ flex: 1 }}>
                <div className="kr-kd">{rowDateLabel(k.generatedAt)}.</div>
              </div>
              <span className={`kr-kbadge ${k.kind.toLowerCase()}`}>{KIND_BADGE[k.kind]}</span>
            </button>
          ))}
        </div>
      )}

      {!showList && conference == null && (
        <div className="mz-page-body">
          <div className="kr-konz-empty">Ez a konzílium nem található.</div>
          <button type="button" className="kr-tminiback" onClick={() => setParams({})}>‹ vissza a listához</button>
        </div>
      )}

      {!showList && conference != null && (
        <div className="mz-page-body">
          <button type="button" className="kr-tminiback" onClick={() => setParams({})}>‹ vissza a listához</button>
          {(() => {
            const accepted = conference.changes.filter((c) => c.kind === ACCEPTED).length
            const retired = conference.changes.filter((c) => c.kind === RETIRED).length
            const rewritten = conference.changes.filter((c) => c.kind === REWRITTEN).length
            const extras = conference.changes.filter((c) => ![ACCEPTED, RETIRED, REWRITTEN].includes(c.kind))
            return (
              <div className="kr-outcomehd">
                <div className="kr-oh-title">Kimenet</div>
                <div className="kr-outcells">
                  <div className="kr-outcell" style={{ '--ow': 'rgba(143,175,126,0.2)', '--oc': '#4E6B42' } as React.CSSProperties}>
                    <b>{accepted}</b><small>elfogadva</small>
                  </div>
                  <div className="kr-outcell" style={{ '--ow': 'rgba(201,150,46,0.18)', '--oc': '#A8801F' } as React.CSSProperties}>
                    <b>{retired}</b><small>nyugdíjazva</small>
                  </div>
                  <div className="kr-outcell" style={{ '--ow': 'rgba(138,118,204,0.16)', '--oc': '#5D4FA0' } as React.CSSProperties}>
                    <b>{rewritten}</b><small>portré átírva</small>
                  </div>
                </div>
                {extras.map((c, i) => <div className="kr-outcome-extra" key={i}>{c.summary}</div>)}
              </div>
            )
          })()}
          {buildBlocks(conference.transcript, experts).map((b, i) => {
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
          <p className="kr-honestynote">{HONESTY_NOTE}</p>
        </div>
      )}
    </div>
  )
}
