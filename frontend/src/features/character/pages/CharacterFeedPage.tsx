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
//
// Final review (mezo-1gim.14, I1) — the join key is NOT an exact date match. `CharacterFeedItem.at`
// is the observation's CREATED timestamp (CharacterService#feed uses `obs.getCreatedAt()`), but
// the nightly job runs after midnight and writes `CharacterRunEntity.day` as the day it OBSERVED
// (yesterday), not the day it ran. A run that observed Aug 30 is written with `day = 2026-08-30`
// but `createdAt` (and therefore every observation's `at`) around Aug 31 02:50 — so an exact
// `nightlyRunByDay.get(localDayIso(it.at))` lookup misses it entirely (or worse, silently matches
// a LATER day's run that happens to share the exact date, which never existed in the old mock
// because its `at` was faked to equal the observed day — see the MOCK_FEED comment in
// characterMock.ts). The robust fix: resolve to the NIGHTLY run whose `day` is the LATEST day
// ≤ the item's local date (never a run that observed AFTER the item was created), and additionally
// require the item's date to be within 1 day of that run's `day` — this covers both the ordinary
// same-day case (an item created same-day, before the 02:50 job) and the 02:50-next-day write,
// while still refusing to silently match a run several days stale (a genuine gap, not a write-lag).
// A better LONG-TERM fix — serving the observation's own `day` directly on the feed item, so the
// FE never has to infer it from `at` — is out of scope here; filed as a bd note (see final fix
// report, mezo-1gim.14).
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
  // Hooks can't be called conditionally, so this runs even for an empty feed (falls back to a
  // harmless 1-day query anchored on the current week's Monday — NOT "today": `mondayIso()`
  // returns the ISO Monday of the current week, so an honest name matters here, per fix round 1).
  const fallbackIso = mondayIso()
  const toIso = items.length > 0 ? localDayIso(items[0].at) : fallbackIso
  const oldestIso = items.length > 0 ? localDayIso(items[items.length - 1].at) : fallbackIso
  const fromIso = oldestIso < addDays(toIso, -61) ? addDays(toIso, -61) : oldestIso
  const { runs } = useCharacterRuns(fromIso, toIso)
  // I1: sorted ascending by day so `resolveNightlyRunId` can walk it for "latest day <= itemDay".
  const nightlyRuns = runs.filter((r) => r.kind === 'NIGHTLY').sort((a, b) => (a.day < b.day ? -1 : 1))

  /** The latest NIGHTLY run whose `day` is <= `itemDayIso`, but only if that run's `day` is
   *  within 1 calendar day of `itemDayIso` (see the header comment's I1 write-up) — a run more
   *  than a day stale is an honest gap, not a write-lag, and must not be silently matched. */
  function resolveNightlyRunId(itemDayIso: string): string | undefined {
    let best: (typeof nightlyRuns)[number] | undefined
    for (const r of nightlyRuns) {
      if (r.day <= itemDayIso && (best == null || r.day > best.day)) best = r
    }
    if (best == null) return undefined
    const diffDays = Math.round(
      (new Date(itemDayIso).getTime() - new Date(best.day).getTime()) / (24 * 60 * 60 * 1000),
    )
    return diffDays <= 1 ? best.id : undefined
  }

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
                    const runId = resolveNightlyRunId(localDayIso(it.at))
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
