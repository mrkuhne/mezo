// ============================================================
// Mezo · Karakter — ConferenceThreadCard (mezo-xlvr)
// One dossier chapter's thread from a konzílium: the faces that spoke, the chapter's own title,
// and a tally. Collapsed by default (spec §9) — the outcome is readable without opening anything;
// opening reveals the chain in the order it happened: proposal, peer stances, Szkeptikus, Mezo.
//
// Honesty rules this component enforces:
// - confidence is a WORD (confidenceWord), never the raw number;
// - a null skeptic/chair means that round produced no answer, and the card SAYS so — it never
//   renders a default verdict that nobody gave.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { confidenceWord } from '@/data/character/characterApi'
import type { CharacterExpertDto, ConferenceItem, ConferenceThread } from '@/data/character/characterApi'
import {
  ACCEPTED_LABEL,
  NOTE_LABEL,
  SKEPTIC_LABEL,
  STANCE_LABEL,
  STANCE_TONE as SHARED_STANCE_TONE,
  displayName,
  type StanceTone,
} from '@/features/character/deliberationLabels'

const NO_ANSWER = 'Ez a kör nem adott választ erre az állításra.'

const NOTHING_TO_ADD = 'A Szkeptikus érvét elfogadom, nem teszek hozzá.'

/** What the chair CONTRIBUTED, or the honest short form when it only ratified. Mirrors the
 *  backend's `addsSomething` (KonziliumVerdictRound.java) — the two run on different surfaces
 *  with no shared runtime, so this copy is deliberate, not accidental duplication (mezo-lghn).
 *  A rejection that ratifies a KILL, and an acceptance at the strength the Szkeptikus suggested,
 *  both add nothing — paraphrasing the Szkeptikus there is the theater this card exists to avoid.
 *  `dissent` is read with `=== true` (never as a truthy check) because it arrives as a nullable
 *  boolean and the model's self-report cannot be trusted either way. An accept that overrules an
 *  explicit KILL gets the SAME hardening as the rejection arm above (mezo-lghn fix round 4, item
 *  1): it is always shown, and — same spirit — this does NOT consult `dissent` either. Overruling
 *  a kill is the single strongest thing the chair can do, and it can never be mistaken for a
 *  ratification just because a stray `suggestedConfidence` on that KILL happens to land in the
 *  same confidence-word tier as the chair's own number. */
function chairAddedSomething(item: ConferenceItem): boolean {
  const chair = item.chair
  if (chair == null) return false
  if (chair.dissent === true || chair.note != null) return true
  if (!chair.accepted) return item.skeptic == null || item.skeptic.verdict !== 'KILL'
  if (item.skeptic?.verdict === 'KILL') return true
  if (chair.confidence == null) return true
  const suggested = item.skeptic?.suggestedConfidence
  if (suggested == null) return true
  return confidenceWord(chair.confidence) !== confidenceWord(suggested)
}

/** The dissent/note grounds that belong ahead of the chair's own reason, or '' when there are
 *  none — kept separate from `chairAddedSomething` so a ruling that DID add something (a dissent,
 *  a note, an overruled KILL, a differing confidence word) can still show plain `reason` alone
 *  when neither `dissent` nor `note` fired (mezo-lghn). */
function chairDetail(chair: NonNullable<ConferenceItem['chair']>): string {
  const parts: string[] = []
  if (chair.dissent === true) parts.push('a Szkeptikus döntése ellenében')
  if (chair.note != null && NOTE_LABEL[chair.note] != null) {
    const dimension = chair.suggestedDimensionKey != null ? `: ${chair.suggestedDimensionKey}` : ''
    parts.push(`${NOTE_LABEL[chair.note]}${dimension}`)
  }
  return parts.length > 0 ? `${parts.join(' · ')} — ` : ''
}

const ACCEPTED_FALLBACK = 'Elfogadva'
const REJECTED_LABEL = 'Elvetve'
const NO_RULING_LABEL = 'Nincs döntés'

/** The badge an item wears in the collapsed thread, and the styling class that goes with it. */
function outcomeBadge(item: ConferenceItem): { label: string; tone: 'acc' | 'rej' | 'non' } {
  if (item.chair == null) return { label: NO_RULING_LABEL, tone: 'non' }
  if (!item.chair.accepted) return { label: REJECTED_LABEL, tone: 'rej' }
  return { label: (item.kind != null && ACCEPTED_LABEL[item.kind]) || ACCEPTED_FALLBACK, tone: 'acc' }
}

export interface ConferenceThreadCardProps {
  thread: ConferenceThread
  experts: CharacterExpertDto[]
  /** Lefutott-e egyáltalán a kereszt-vita kör ezen a konzíliumon (a szál TÁROLT, nem visszafejtett).
   *  Ha nem, a fejléc nem mondhat "nem vitatták"-at — az azt sugallná, hogy volt kör és senki nem szólt. */
  crossTalkRan: boolean
  defaultOpen?: boolean
}

/** Every expert that spoke in this thread, proposers first, then anyone who only reacted. */
function speakers(thread: ConferenceThread): string[] {
  const keys: string[] = []
  for (const item of thread.items) {
    if (!keys.includes(item.expertKey)) keys.push(item.expertKey)
  }
  for (const item of thread.items) {
    for (const reaction of item.reactions) {
      if (!keys.includes(reaction.expertKey)) keys.push(reaction.expertKey)
    }
  }
  return keys
}

function acceptedCount(thread: ConferenceThread): number {
  return thread.items.filter((item) => item.chair?.accepted === true).length
}

function reactionCount(thread: ConferenceThread): number {
  return thread.items.reduce((sum, item) => sum + item.reactions.length, 0)
}

type ChipTone = StanceTone | 'acc' | 'rej' | 'non'

/** The Szkeptikus's chip tone by verdict grade: a KILL reads like a challenge, a WEAKEN like a
 *  nuance, an unreserved KEEP like support — the same three-way vocabulary STANCE_TONE already
 *  uses for peer reactions (mezo-lghn). */
function skepticTone(verdict: string): ChipTone {
  if (verdict === 'KILL') return 'cha'
  if (verdict === 'WEAKEN') return 'nua'
  return 'sup'
}

function ChainStep({ expertKey, who, chip, chipTone, children }: {
  expertKey: string
  who: string
  chip?: string
  chipTone?: ChipTone
  children: React.ReactNode
}) {
  return (
    <div className="kr-thstep" style={{ '--c': expertColor(expertKey) } as CSSProperties}>
      <span className="kr-thorb" aria-hidden="true"><PersonaOrb expertKey={expertKey} size={22} /></span>
      <div className="kr-thwho">
        {who}
        {chip != null && <span className={`kr-thchip ${chipTone ?? 'non'}`}>{chip}</span>}
      </div>
      <div className="kr-thsaid">{children}</div>
    </div>
  )
}

const STANCE_TONE: Record<string, ChipTone> = SHARED_STANCE_TONE

function ItemChain({ item, experts }: { item: ConferenceItem; experts: CharacterExpertDto[] }) {
  const badge = outcomeBadge(item)
  const confidence = item.chair?.accepted === true && item.chair.confidence != null
    ? ` · ${confidenceWord(item.chair.confidence)}`
    : ''
  // A KILL carries no strength to suggest — a stray `suggestedConfidence` on one must never render
  // as a confidence word (mirrors the backend's `skepticLine`, mezo-lghn fix round 4, item 2).
  const skepticConfidence = item.skeptic != null
    && item.skeptic.suggestedConfidence != null
    && item.skeptic.verdict !== 'KILL'
    ? ` · ${confidenceWord(item.skeptic.suggestedConfidence)}`
    : ''
  return (
    <div className="kr-thitem">
      <ChainStep expertKey={item.expertKey} who={displayName(experts, item.expertKey)} chip="felvetette">
        {item.text}
      </ChainStep>
      {item.reactions.map((reaction, i) => (
        <ChainStep
          key={i}
          expertKey={reaction.expertKey}
          who={displayName(experts, reaction.expertKey)}
          chip={STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}
          chipTone={STANCE_TONE[reaction.stance]}
        >
          {reaction.argument}
        </ChainStep>
      ))}
      <ChainStep
        expertKey="szkeptikus"
        who="Szkeptikus"
        chip={item.skeptic == null ? undefined : `${SKEPTIC_LABEL[item.skeptic.verdict] ?? 'Válaszolt'}${skepticConfidence}`}
        chipTone={item.skeptic == null ? undefined : skepticTone(item.skeptic.verdict)}
      >
        {item.skeptic == null ? NO_ANSWER : item.skeptic.argument}
      </ChainStep>
      <ChainStep
        expertKey="mezo"
        who="Mezo"
        chip={item.chair == null ? undefined : `${badge.label}${confidence}`}
        chipTone={badge.tone}
      >
        {item.chair == null
          ? NO_ANSWER
          : !chairAddedSomething(item)
            ? NOTHING_TO_ADD
            : `${chairDetail(item.chair)}${item.chair.reason}`}
      </ChainStep>
    </div>
  )
}

export function ConferenceThreadCard({ thread, experts, crossTalkRan, defaultOpen = false }: ConferenceThreadCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const accepted = acceptedCount(thread)
  const reactions = reactionCount(thread)

  return (
    <div className="kr-thread">
      <button
        type="button"
        className="kr-thhead"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="kr-thfaces">
          {speakers(thread).map((key) => (
            <span key={key} className="kr-thorb" style={{ '--c': expertColor(key) } as CSSProperties}>
              <PersonaOrb expertKey={key} size={20} />
            </span>
          ))}
        </span>
        <span className="kr-thtitle">
          <span className="kr-thtt">{thread.title}</span>
          <span className="kr-thts">
            {`${thread.items.length} állítás`}
            {reactions > 0
              ? <> · <span className="kr-thdeb">{`${reactions} hozzászólás`}</span></>
              : crossTalkRan
                ? ' · nem vitatták'
                : ` · ${accepted} elfogadva`}
          </span>
        </span>
        <span className="kr-thchev" aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>
      {open
        ? (
            <div className="kr-thbody">
              {thread.items.map((item) => <ItemChain key={item.index} item={item} experts={experts} />)}
            </div>
          )
        : (
            <div className="kr-thcollapsed">
              {thread.items.map((item) => {
                const badge = outcomeBadge(item)
                return (
                  <div key={item.index} className="kr-throw">
                    <span className={`kr-thb ${badge.tone}`}>{badge.label}</span>
                    <span className={`kr-thtx${badge.tone === 'acc' ? '' : ' dim'}`}>{item.text}</span>
                  </div>
                )
              })}
            </div>
          )}
    </div>
  )
}
