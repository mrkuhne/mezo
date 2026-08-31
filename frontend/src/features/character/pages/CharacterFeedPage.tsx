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
//
// Task 5 (mezo-1gim.14) — the ⚙ retarget: each observation row gains a `.kr-gepq` button that
// navigates to the RunPage for the NIGHTLY run that produced it. There is no `runId` on
// `CharacterFeedItem` (the feed contract never carried one — it is a merged observation+
// conference-diff view, not a run-scoped one), so the run is resolved client-side by DATE:
// the item's local calendar day is looked up against `useCharacterRuns` for the window
// spanning every item currently in the feed (clamped to the 62-day `CHARACTER_RUN_RANGE_INVALID`
// cap — see FutasokPage's identical clamp), matching only `kind === 'NIGHTLY'` rows (the
// binding ruling: only nightly runs are calendar-day-addressable; WEEKLY/MONTHLY/BOOTSTRAP rows
// don't correspond 1:1 to an observation's own day). When no NIGHTLY row exists for a day (the
// run genuinely never executed, or a fixture/seam gap), the ⚙ is simply ABSENT — never a dead
// button, per the Global Constraints' honest-states rule.
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterExperts, useCharacterFeed, useCharacterRuns } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { feedDayLabel } from '@/features/character/feedDayLabel'
import { addDays } from '@/shared/lib/dates'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import type { CharacterFeedItem } from '@/data/character/characterApi'

/** The feed only carries an ISO timestamp per item (same gap `feedDayLabel` already works
 *  around) — this derives the LOCAL calendar day (`YYYY-MM-DD`) an item's `at` falls on, the
 *  same local-date construction `feedDayLabel` uses, so a run's `day` (a `LocalDate`) and a
 *  feed item's day always compare on the same calendar. */
function localDayIso(atIso: string): string {
  const at = new Date(atIso)
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

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

  // The run-lookup window spans every item currently in the feed, clamped to the 62-day
  // CHARACTER_RUN_RANGE_INVALID cap (FutasokPage's identical clamp) — items are already
  // newest-first (feed contract), so items[0] is the newest day and the last item the oldest.
  // Hooks can't be called conditionally, so this runs even for an empty feed (falls back to
  // today, a harmless 1-day query).
  const today = mondayIso()
  const toIso = items.length > 0 ? localDayIso(items[0].at) : today
  const oldestIso = items.length > 0 ? localDayIso(items[items.length - 1].at) : today
  const fromIso = oldestIso < addDays(toIso, -61) ? addDays(toIso, -61) : oldestIso
  const { runs } = useCharacterRuns(fromIso, toIso)
  const nightlyRunByDay = new Map(runs.filter((r) => r.kind === 'NIGHTLY').map((r) => [r.day, r.id]))

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
                    const runId = nightlyRunByDay.get(localDayIso(it.at))
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
                        {runId != null && (
                          <button
                            type="button"
                            className="kr-gepq"
                            aria-label="A futáshoz"
                            title="A futáshoz →"
                            onClick={() => navigate(`/me/karakter/gepterem/futas/${runId}`)}
                          >
                            ⚙
                          </button>
                        )}
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
