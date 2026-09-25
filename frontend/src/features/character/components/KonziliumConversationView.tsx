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
import { personaName } from '@/features/character/personaCharacter'
import { confidenceWord } from '@/data/character/characterApi'
import type { CharacterExpertDto, ConferenceThread } from '@/data/character/characterApi'
import { ACCEPTED_LABEL, STANCE_LABEL, STANCE_TONE } from '@/features/character/deliberationLabels'
import { partitionDeliberation } from '@/features/character/deliberationStats'

const EMPTY_PROPOSALS = 'Ez a konzílium nem tartalmaz felvetést.'
const EMPTY_CROSSTALK_RAN = 'Ebben a körben senki nem szólt hozzá más felvetéséhez.'
// C1 (mezo-sp9w branch-review): true both for a meeting that predates the cross-talk round and
// for a kind (MONTHLY/BOOTSTRAP) that never has one — neither claims a round ran and stayed
// silent, which is what the old copy said.
const EMPTY_CROSSTALK_ABSENT = 'Ezen a tanácskozáson nem volt kereszt-vita kör.'
const EMPTY_SKEPTIC = 'A Szkeptikus ebben a körben nem adott választ.'
const EMPTY_CHAIR = 'Ebben a körben nem született döntés.'

/** Egy megszólalás: lapos komment-panel a szereplő akcentusával (a csapatfal `tcmt` idiómája). */
function Turn({ expertKey, name, chip, chipTone, children }: {
  expertKey: string
  name: string
  chip?: string
  chipTone?: string
  children: React.ReactNode
}) {
  return (
    <div className="kz-cmt" style={{ '--c': expertColor(expertKey) } as CSSProperties}>
      <div className="kz-cmth">
        <PersonaOrb expertKey={expertKey} size={30} className="kz-cmtorb" />
        <b className="kz-who">{name}</b>
        {chip != null && <span className={`kz-chip ${chipTone ?? 'non'}`}>{chip}</span>}
      </div>
      <p className="kz-said">{children}</p>
    </div>
  )
}

/** Számozott kör-fejléc; egy kör, ami nem hozott semmit, a saját őszinte mondatát mutatja
 *  szaggatott keretben (bible §3: az üres állapot szaggatott), sosem tűnik el. */
function Section({ n, label, hot, empty, children }: {
  n: number
  label: string
  hot?: boolean
  empty?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <div className={`tf-sec kz-cvsec${hot === true ? ' hot' : ''}`}>
        <h2><span className="kz-rn">{`${n} ·`}</span> <span className="kz-cvlbl">{label}</span></h2>
      </div>
      {empty != null ? <div className="kz-cvempty">{empty}</div> : <div className="kz-cvlist">{children}</div>}
    </>
  )
}

export function KonziliumConversationView({ threads, crossTalkRan }: {
  threads: ConferenceThread[]
  /** Megtartva az API stabilitásáért; a kiírt nevek U9 óta a szereplő-leképezésből jönnek (personaName). */
  experts: CharacterExpertDto[]
  crossTalkRan: boolean
}) {
  const { items, debated, audited, ruled } = partitionDeliberation(threads)

  return (
    <div className="kz-cv">
      <Section n={1} label="Javaslatok" empty={items.length === 0 ? EMPTY_PROPOSALS : undefined}>
        {items.map((item) => (
          <Turn key={`p-${item.index}`} expertKey={item.expertKey} name={personaName(item.expertKey)}>{item.text}</Turn>
        ))}
      </Section>

      <Section
        n={2}
        label="Kereszt-vita"
        hot={debated.length > 0}
        empty={debated.length > 0 ? undefined : crossTalkRan ? EMPTY_CROSSTALK_RAN : EMPTY_CROSSTALK_ABSENT}
      >
        {debated.map((item) => (
          <div className="kz-cvcard" key={`x-${item.index}`}>
            <div className="kz-cvquote">{`„${item.text}" — ${personaName(item.expertKey)}`}</div>
            {item.reactions.map((reaction, i) => (
              <Turn
                key={i}
                expertKey={reaction.expertKey}
                name={personaName(reaction.expertKey)}
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
          <Turn
            key={`s-${item.index}`}
            expertKey="szkeptikus"
            name={personaName('szkeptikus')}
            chip={item.skeptic!.verdict === 'KILL' ? 'kukázta' : 'meghagyta'}
            chipTone={item.skeptic!.verdict === 'KILL' ? 'cha' : 'sup'}
          >
            {item.skeptic!.argument}
          </Turn>
        ))}
      </Section>

      <Section n={4} label="Mezo dönt" empty={ruled.length === 0 ? EMPTY_CHAIR : undefined}>
        {ruled.map((item) => {
          const chair = item.chair!
          const label = chair.accepted
            ? `${(item.kind != null && ACCEPTED_LABEL[item.kind]) || 'Elfogadva'}${
                chair.confidence != null ? ` · ${confidenceWord(chair.confidence)}` : ''}`
            : 'Elvetve'
          // Mezo döntése az elsődleges tárgy ebben a nézetben: üveg-kártya (arany), benne a
          // megszólalás lapos marad — nincs üveg az üvegben.
          return (
            <div className="glass tf-c-gold kz-ruling" key={`r-${item.index}`}>
              <div className="kz-rulinghd">
                <PersonaOrb expertKey="mezo" size={30} className="kz-cmtorb" />
                <b className="kz-who">{personaName('mezo')}</b>
                <span className={`kz-chip ${chair.accepted ? 'acc' : 'rej'}`}>{label}</span>
              </div>
              <p className="kz-said">{chair.reason}</p>
            </div>
          )
        })}
      </Section>
    </div>
  )
}
