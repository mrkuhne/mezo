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

function keptCount(thread: ConferenceThread): number {
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
          : `${item.skeptic.verdict === 'KILL' ? 'Kukázta' : 'Meghagyta'} — ${item.skeptic.argument}`}
      </ChainStep>
      <ChainStep who="Mezo" color={expertColor('mezo')}>
        {item.chair == null
          ? NO_ANSWER
          : `${item.chair.accepted ? 'Elfogadva' : 'Elvetve'}${
              item.chair.accepted && item.chair.confidence != null
                ? ` · ${confidenceWord(item.chair.confidence)}`
                : ''
            } — ${item.chair.reason}`}
      </ChainStep>
    </div>
  )
}

export function ConferenceThreadCard({ thread, experts, defaultOpen = false }: ConferenceThreadCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const kept = keptCount(thread)

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
          <span className="kr-thts">{`${thread.items.length} állítás · ${kept} maradt meg`}</span>
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
              {thread.items.map((item) => (
                <div key={item.index} className="kr-throw">
                  <span className={`kr-thb ${item.chair?.accepted === true ? 'acc' : 'rej'}`}>
                    {item.chair == null ? 'Nincs döntés' : item.chair.accepted ? 'Bekerült' : 'Elvetve'}
                  </span>
                  <span className={`kr-thtx${item.chair?.accepted === true ? '' : ' dim'}`}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
    </div>
  )
}
