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

const STANCE_LABEL: Record<string, string> = {
  SUPPORT: 'támogatja',
  CHALLENGE: 'vitatja',
  NUANCE: 'árnyalja',
}

const NO_ANSWER = 'Ez a kör nem adott választ erre az állításra.'

const SKEPTIC_LABEL: Record<string, string> = {
  KILL: 'Kukázta',
  WEAKEN: 'Gyengítette',
  KEEP: 'Meghagyta',
}

const NOTE_LABEL: Record<string, string> = {
  DUPLICATE: 'már tartunk ilyet',
  CONTRADICTS: 'ellentmond a dossziénak',
  NOT_FOR_DOSSIER: 'nem dossziéba való',
  REHOME: 'máshová tartozik',
}

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

// What an ACCEPTED item actually means depends on what was proposed (`item.kind`, on the wire
// from the backend's ClaimProposal): a RETIRE the chair accepted retired a claim, it did not add
// one. Labelling every accepted item "Bekerült" would tell the user the opposite of what
// happened (mezo-xlvr final review, I3). An unknown/missing kind falls back to the neutral
// "Elfogadva" — never to a guess about which way the dossier moved.
const ACCEPTED_LABEL: Record<string, string> = {
  NEW: 'Bekerült',
  UP: 'Megerősítve',
  DOWN: 'Gyengítve',
  RETIRE: 'Nyugdíjazva',
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
  defaultOpen?: boolean
}

function displayName(experts: CharacterExpertDto[], key: string): string {
  return experts.find((e) => e.key === key)?.displayName ?? key
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

function ChainStep({ who, color, children }: { who: string; color: string; children: React.ReactNode }) {
  return (
    <div className="kr-thstep" style={{ '--c': color } as CSSProperties}>
      <span className="kr-thdot" aria-hidden="true" />
      <div className="kr-thwho">{who}</div>
      <div className="kr-thsaid">{children}</div>
    </div>
  )
}

function ItemChain({ item, experts }: { item: ConferenceItem; experts: CharacterExpertDto[] }) {
  return (
    <div className="kr-thitem">
      <ChainStep who={`${displayName(experts, item.expertKey)} felvetette`} color={expertColor(item.expertKey)}>
        {item.text}
      </ChainStep>
      {item.reactions.map((reaction, i) => (
        <ChainStep
          key={i}
          who={`${displayName(experts, reaction.expertKey)} ${STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}`}
          color={expertColor(reaction.expertKey)}
        >
          {reaction.argument}
        </ChainStep>
      ))}
      <ChainStep who="Szkeptikus" color={expertColor('szkeptikus')}>
        {item.skeptic == null
          ? NO_ANSWER
          : `${SKEPTIC_LABEL[item.skeptic.verdict] ?? 'Válaszolt'}${
              item.skeptic.suggestedConfidence != null && item.skeptic.verdict !== 'KILL'
                ? ` · ${confidenceWord(item.skeptic.suggestedConfidence)}`
                : ''
            } — ${item.skeptic.argument}`}
      </ChainStep>
      <ChainStep who="Mezo" color={expertColor('mezo')}>
        {item.chair == null
          ? NO_ANSWER
          : !chairAddedSomething(item)
            ? NOTHING_TO_ADD
            : `${item.chair.accepted ? 'Elfogadva' : 'Elvetve'}${
                item.chair.accepted && item.chair.confidence != null
                  ? ` · ${confidenceWord(item.chair.confidence)}`
                  : ''
              }${item.chair.dissent === true ? ' · a Szkeptikus döntése ellenében' : ''}${
                item.chair.note != null && NOTE_LABEL[item.chair.note] != null
                  ? ` · ${NOTE_LABEL[item.chair.note]}${
                      item.chair.suggestedDimensionKey != null ? `: ${item.chair.suggestedDimensionKey}` : ''
                    }`
                  : ''
              } — ${item.chair.reason}`}
      </ChainStep>
    </div>
  )
}

export function ConferenceThreadCard({ thread, experts, defaultOpen = false }: ConferenceThreadCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const accepted = acceptedCount(thread)

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
          <span className="kr-thts">{`${thread.items.length} állítás · ${accepted} elfogadva`}</span>
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
