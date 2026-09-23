import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import { Boop } from '@/shared/ui/clay'

/** A story-sáv sorrendje: az öt posztoló karakter (a Szkeptikusnak nincs köre, spec §2.2). */
const CAST: TeamCharacterId[] = ['szunya', 'mocor', 'falat', 'deru', 'mezo']

const seenKey = (id: TeamCharacterId, day: string) => `tf-seen:${id}:${day}`

/** Böngésző-tár csak kényelemre: kiesésekor minden gyűrű „új” marad — ártalmatlan alapállás. */
function readSeen(id: TeamCharacterId, day: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(id, day)) === '1'
  } catch {
    return false
  }
}

function writeSeen(id: TeamCharacterId, day: string) {
  try {
    window.localStorage.setItem(seenKey(id, day), '1')
  } catch {
    /* privát ablak / tiltott tár — a gyűrű a munkamenetben így is láttra vált */
  }
}

/**
 * A story-sáv (spec §2.4): színes gyűrű = MA posztolt és még nem nézted meg; koral pötty =
 * rád vár nála valami. A kör a karakter szobájába visz, és a gyűrűt aznapra láttra kapcsolja.
 */
export function StoryStrip({ today, fresh, waiting }: {
  today: string
  fresh: Record<TeamCharacterId, boolean>
  waiting: Partial<Record<TeamCharacterId, boolean>>
}) {
  const [seen, setSeen] = useState(() => Object.fromEntries(CAST.map(id => [id, readSeen(id, today)])) as Record<TeamCharacterId, boolean>)
  return (
    <nav className="tf-cast" aria-label="A csapat">
      {CAST.map(id => {
        const who = TEAM[id]
        const isNew = fresh[id] && !seen[id]
        return (
          <Link
            key={id}
            to={`/mezo/csapat/${id}`}
            className="tf-castb"
            aria-label={`${who.name} · ${who.area}${isNew ? ' · új bejegyzés' : ''}${waiting[id] ? ' · rád vár' : ''}`}
            data-new={isNew || undefined}
            onClick={() => {
              writeSeen(id, today)
              setSeen(s => ({ ...s, [id]: true }))
            }}
          >
            <span className={`tf-ring${isNew ? ' is-new' : ''}`}>
              <i><Boop domain={who.boop} size={48} alive={isNew} /></i>
            </span>
            {waiting[id] && <span className="tf-dot" aria-hidden="true" />}
            <span className="tf-castname">{who.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
