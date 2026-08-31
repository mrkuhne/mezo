// ============================================================
// Mezo · Karakter — CharacterFeedPage (mezo-1gim.13, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-feed` / `FEED.map()` —
// day-grouped rows (feedday header + a feedtile card of feedrows), CONFERENCE_CHANGE items
// rendered as the coral `.feeddiff` row.
//
// expertKey "user" (Daniel's OWN feedback observation can appear in the feed — the brief
// flags this explicitly): PersonaOrb has no orb for a "user" key and would silently fall back
// to Mezo's coral orb, misattributing Daniel's own words to the AI. DECISION: a distinct
// gold "Te" disc (kr-feeddisc.user) instead — never routed through PersonaOrb. Reported in
// task-4-report.md per the brief's "decide, comment, report."
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterExperts, useCharacterFeed } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { feedDayLabel } from '@/features/character/feedDayLabel'
import type { CharacterFeedItem } from '@/data/character/characterApi'

interface Group { day: string; items: CharacterFeedItem[] }

/** The feed is already newest-first (server + mock contract) — grouping just watches for the
 *  day label to change as it walks the list, never re-sorts. */
function groupByDay(items: CharacterFeedItem[]): Group[] {
  const groups: Group[] = []
  for (const item of items) {
    const day = feedDayLabel(item.at)
    const last = groups[groups.length - 1]
    if (last != null && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

export function CharacterFeedPage() {
  const navigate = useNavigate()
  const { items, isLoading } = useCharacterFeed()
  const { experts } = useCharacterExperts()

  if (isLoading) return null

  const groups = groupByDay(items)

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Amit mostanában megtudtam rólad</div>
        <div className="mz-hero-sb">a csapat friss megfigyelései, naponta</div>
      </div>
      <div className="mz-page-body">
        {items.length === 0 && <p className="kr-degraded">Egyelőre nincs friss megfigyelés.</p>}
        {groups.map((grp, gi) => {
          const observations = grp.items.filter((it) => it.kind === 'OBSERVATION')
          const diffs = grp.items.filter((it) => it.kind === 'CONFERENCE_CHANGE')
          return (
            <div key={`${grp.day}-${gi}`}>
              <div className="kr-feedday">{grp.day}</div>
              {observations.length > 0 && (
                <div className="kr-feedtile">
                  {observations.map((it, ii) => {
                    const isUser = it.expertKey === 'user'
                    const color = expertColor(it.expertKey)
                    const name = isUser ? 'Te' : (experts.find((e) => e.key === it.expertKey)?.displayName ?? it.expertKey)
                    return (
                      <div key={ii} className="kr-feedrow">
                        {isUser
                          ? <div className="kr-feeddisc user">Te</div>
                          : <div className="kr-feeddisc" style={{ '--dc': color } as React.CSSProperties}>
                              <PersonaOrb expertKey={it.expertKey ?? 'mezo'} size={22} />
                            </div>}
                        <div>
                          <div className="kr-fnm" style={{ '--dc': color } as React.CSSProperties}>{name}</div>
                          <div className="kr-ftxt">{it.text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {diffs.map((it, ii) => (
                <button
                  key={ii}
                  type="button"
                  className="kr-feeddiff"
                  onClick={() => navigate('/me/karakter/konzilium')}
                >
                  <span className="kr-ic" aria-hidden="true" />
                  <span className="kr-tx">{it.text}</span>
                  <span className="kr-chev" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
