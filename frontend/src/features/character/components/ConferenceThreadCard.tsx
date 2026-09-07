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
  /** Lefutott-e egyáltalán a kereszt-vita kör ezen a konzíliumon (a szál TÁROLT, nem visszafejtett).
   *  Ha nem, a fejléc nem mondhat "nem vitatták"-at — az azt sugallná, hogy volt kör és senki nem szólt. */
  crossTalkRan: boolean
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

function reactionCount(thread: ConferenceThread): number {
  return thread.items.reduce((sum, item) => sum + item.reactions.length, 0)
}

type ChipTone = 'sup' | 'cha' | 'nua' | 'acc' | 'rej' | 'non'

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

const STANCE_TONE: Record<string, ChipTone> = { SUPPORT: 'sup', CHALLENGE: 'cha', NUANCE: 'nua' }

function ItemChain({ item, experts }: { item: ConferenceItem; experts: CharacterExpertDto[] }) {
  const badge = outcomeBadge(item)
  const confidence = item.chair?.accepted === true && item.chair.confidence != null
    ? ` · ${confidenceWord(item.chair.confidence)}`
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
        chip={item.skeptic == null ? undefined : item.skeptic.verdict === 'KILL' ? 'kukázta' : 'meghagyta'}
        chipTone={item.skeptic?.verdict === 'KILL' ? 'cha' : 'sup'}
      >
        {item.skeptic == null ? NO_ANSWER : item.skeptic.argument}
      </ChainStep>
      <ChainStep
        expertKey="mezo"
        who="Mezo"
        chip={item.chair == null ? undefined : `${badge.label}${confidence}`}
        chipTone={badge.tone}
      >
        {item.chair == null ? NO_ANSWER : item.chair.reason}
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
