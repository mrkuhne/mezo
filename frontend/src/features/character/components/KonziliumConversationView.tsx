// ============================================================
// Mezo · Karakter — KonziliumConversationView (mezo-sp9w)
// Ugyanaz a konzílium, időrendben: a négy kör a fő szerkezet. Az Áttekintés arra válaszol,
// MI történt; ez arra, HOGYAN.
//
// Őszinteség: mind a négy szekció MINDIG látszik. Egy kör, ami nem hozott semmit, a saját
// magyarázatával jelenik meg — sosem tűnik el némán, és a kereszt-vita kör "nem volt ilyen kör"
// és "senki nem szólt hozzá" esete külön szöveget kap.
// ============================================================
import type { CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { confidenceWord } from '@/data/character/characterApi'
import type { CharacterExpertDto, ConferenceItem, ConferenceThread } from '@/data/character/characterApi'

const STANCE_LABEL: Record<string, string> = {
  SUPPORT: 'támogatja',
  CHALLENGE: 'vitatja',
  NUANCE: 'árnyalja',
}
const STANCE_TONE: Record<string, string> = { SUPPORT: 'sup', CHALLENGE: 'cha', NUANCE: 'nua' }

const ACCEPTED_LABEL: Record<string, string> = {
  NEW: 'Bekerült',
  UP: 'Megerősítve',
  DOWN: 'Gyengítve',
  RETIRE: 'Nyugdíjazva',
}

const EMPTY_PROPOSALS = 'Ez a konzílium nem tartalmaz felvetést.'
const EMPTY_CROSSTALK_RAN = 'Ebben a körben senki nem szólt hozzá más felvetéséhez.'
const EMPTY_CROSSTALK_ABSENT = 'Ez a konzílium a kereszt-vita kör bevezetése előtt zajlott.'
const EMPTY_SKEPTIC = 'A Szkeptikus ebben a körben nem adott választ.'
const EMPTY_CHAIR = 'Ebben a körben nem született döntés.'

function displayName(experts: CharacterExpertDto[], key: string): string {
  return experts.find((e) => e.key === key)?.displayName ?? key
}

function Turn({ expertKey, name, chip, chipTone, children }: {
  expertKey: string
  name: string
  chip?: string
  chipTone?: string
  children: React.ReactNode
}) {
  return (
    <div className="kr-cvturn" style={{ '--c': expertColor(expertKey) } as CSSProperties}>
      <span className="kr-cvorb"><PersonaOrb expertKey={expertKey} size={23} /></span>
      <div>
        <div className="kr-thwho">
          {name}
          {chip != null && <span className={`kr-thchip ${chipTone ?? 'non'}`}>{chip}</span>}
        </div>
        <div className="kr-thsaid">{children}</div>
      </div>
    </div>
  )
}

function Section({ n, label, hot, empty, children }: {
  n: number
  label: string
  hot?: boolean
  empty?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <div className={`kr-cvlbl${hot === true ? ' hot' : ''}`}>
        <span className="kr-rn">{n}</span>{label}
      </div>
      {empty != null ? <div className="kr-cvempty">{empty}</div> : children}
    </>
  )
}

export function KonziliumConversationView({ threads, experts, crossTalkRan }: {
  threads: ConferenceThread[]
  experts: CharacterExpertDto[]
  crossTalkRan: boolean
}) {
  const items: ConferenceItem[] = threads.flatMap((thread) => thread.items)
  const debated = items.filter((item) => item.reactions.length > 0)
  const audited = items.filter((item) => item.skeptic != null)
  const ruled = items.filter((item) => item.chair != null)

  return (
    <div className="kr-cv">
      <Section n={1} label="Javaslatok" empty={items.length === 0 ? EMPTY_PROPOSALS : undefined}>
        {items.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`p-${item.index}`}>
            <Turn expertKey={item.expertKey} name={displayName(experts, item.expertKey)}>{item.text}</Turn>
          </div>
        ))}
      </Section>

      <Section
        n={2}
        label="Kereszt-vita"
        hot={debated.length > 0}
        empty={debated.length > 0 ? undefined : crossTalkRan ? EMPTY_CROSSTALK_RAN : EMPTY_CROSSTALK_ABSENT}
      >
        {debated.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`x-${item.index}`}>
            <div className="kr-cvquote">{`„${item.text}" — ${displayName(experts, item.expertKey)}`}</div>
            {item.reactions.map((reaction, i) => (
              <Turn
                key={i}
                expertKey={reaction.expertKey}
                name={displayName(experts, reaction.expertKey)}
                chip={STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}
                chipTone={STANCE_TONE[reaction.stance]}
              >
                {reaction.argument}
              </Turn>
            ))}
          </div>
        ))}
      </Section>

      <Section n={3} label="Szkeptikus" empty={audited.length === 0 ? EMPTY_SKEPTIC : undefined}>
        {audited.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`s-${item.index}`}>
            <Turn
              expertKey="szkeptikus"
              name="Szkeptikus"
              chip={item.skeptic!.verdict === 'KILL' ? 'kukázta' : 'meghagyta'}
              chipTone={item.skeptic!.verdict === 'KILL' ? 'cha' : 'sup'}
            >
              {item.skeptic!.argument}
            </Turn>
          </div>
        ))}
      </Section>

      <Section n={4} label="Mezo dönt" empty={ruled.length === 0 ? EMPTY_CHAIR : undefined}>
        {ruled.map((item) => {
          const chair = item.chair!
          const label = chair.accepted
            ? `${(item.kind != null && ACCEPTED_LABEL[item.kind]) || 'Elfogadva'}${
                chair.confidence != null ? ` · ${confidenceWord(chair.confidence)}` : ''}`
            : 'Elvetve'
          return (
            <div className="kr-konzcard kr-cvcard kr-cvmezo" key={`r-${item.index}`}>
              <Turn expertKey="mezo" name="Mezo" chip={label} chipTone={chair.accepted ? 'acc' : 'rej'}>
                {chair.reason}
              </Turn>
            </div>
          )
        })}
      </Section>
    </div>
  )
}
