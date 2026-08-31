// ============================================================
// Mezo · Karakter — FutasokPage (mezo-1gim.14, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-futasok` (`renderWeek`,
// `runRowHTML`, `rareList`) — a week-stepped, day-grouped run timeline. Week navigation is
// the WeekHubPage `?start=` ISO-Monday idiom (frontend/src/features/me/pages/WeekHubPage.tsx,
// `resolveWeekStart`/`prevMonday`/`nextMonday`). The prototype's `weekLbl` quick-jump menu
// becomes a plain chip list of the last 8 Mondays (this week + 7 back) — the closest honest
// analog without a "which weeks actually have runs" backend index.
//
// Honest states (plan's Global Constraints): a day inside the browsed week with NO run row AT
// ALL renders "nincs adat erről az éjszakáról" — never a fabricated quiet night. A REAL
// zero-count NIGHTLY row is a different thing entirely and renders as its own proud row.
//
// M8 (final review): the missing-day line above is only honest for a day whose night has
// already happened. TODAY and every later day in the browsed (current) week cannot have a
// NIGHTLY row yet — the nightly job processes YESTERDAY (see CharacterFeedPage.tsx's I1 write-up
// for the same lag), so a run for today's own `day` is only written tomorrow ~02:50. Those days
// render "még nem jött el" instead — a missing row there is expected, not a pipeline failure.
// Today's day-group header also gets the "MA" marker in place of the weekday abbreviation.
//
// "Ritkább futások" (MONTHLY/BOOTSTRAP): GET /api/character/runs caps a query span at 62 days
// (Task 2 contract, CHARACTER_RUN_RANGE_INVALID) — the rare-runs window is the 62 days ending
// at the browsed week, the widest single query the endpoint allows, not an unbounded lookback.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@/features/character/character.css'
import { PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { useCharacterRuns } from '@/data/hooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { isCurrentWeek, nextMonday, prevMonday, resolveWeekStart } from '@/features/me/logic/weekNav'
import { addDays, huDow, localDateString } from '@/shared/lib/dates'
import {
  FUTURE_DAY_LINE,
  isQuietNightly,
  KIND_BADGE,
  KIND_LABEL,
  MISSING_DAY_LINE,
  runRowSubline,
} from '@/features/character/runLabels'
import type { CharacterRunSummary } from '@/data/character/characterApi'

const WEEKS_BACK = 7
const RARE_KINDS: CharacterRunSummary['kind'][] = ['MONTHLY', 'BOOTSTRAP']

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

function weekLabel(startIso: string): string {
  return `${shortDate(startIso)} – ${shortDate(addDays(startIso, 6))}`
}

export function FutasokPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const start = resolveWeekStart(params.get('start'))
  const end = addDays(start, 6)
  const { runs, isLoading } = useCharacterRuns(start, end)

  // The 62-day-capped rare-runs window (see the header comment) — ends at this week's Sunday.
  const rareFrom = addDays(end, -61)
  const { runs: rareWindowRuns, isLoading: rareLoading } = useCharacterRuns(rareFrom, end)
  const rareRuns = rareWindowRuns.filter((r) => RARE_KINDS.includes(r.kind))

  const [menuOpen, setMenuOpen] = useState(false)
  const weeklblRef = useRef<HTMLDivElement>(null)
  const goWeek = (iso: string) => { setParams({ start: iso }, { replace: true }); setMenuOpen(false) }

  // Fix round 1 (minor): the jump menu had no outside-click/Escape dismissal — the
  // AppHeader.tsx popover contract (Escape + a "click outside the popover's own root"
  // listener, subscribed only while open), applied here instead of duplicated ad hoc.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent) => {
      if (!weeklblRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen])

  const currentMonday = mondayIso()
  const recentMondays = Array.from({ length: WEEKS_BACK + 1 }, (_, i) => addDays(currentMonday, -7 * (WEEKS_BACK - i)))

  const todayIso = localDateString()
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const runsByDay = new Map<string, CharacterRunSummary[]>()
  runs.forEach((r) => {
    const list = runsByDay.get(r.day) ?? []
    list.push(r)
    runsByDay.set(r.day, list)
  })
  if (isLoading || rareLoading) return null

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter/gepterem')} label="‹ Gépterem" />
      <PageHero name="Futások" sub="a pipeline futásai, hetekre bontva" />
      <PageBody>
        <div className="kr-weeknav">
          <button type="button" className="kr-wstep" aria-label="Előző hét" onClick={() => goWeek(prevMonday(start))}>‹</button>
          {/* Fix round 1 (a11y): dropped the `aria-label="Hét választása"` that used to override
             this button's accessible name down to a bare "week picker" label, hiding the
             actual browsed week range + status ("legutóbbi futások" / "korábbi hét") — the
             row's only live datum — from screen-reader users while sighted users still saw
             it. The button's own text content is now the accessible name. */}
          <div className="kr-weeklbl" ref={weeklblRef}>
            <button
              type="button"
              className="kr-weeklbl-btn"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span>{weekLabel(start)}</span>
              <small>{isCurrentWeek(start) ? 'legutóbbi futások' : 'korábbi hét'}</small>
            </button>
            {menuOpen && (
              <div className="kr-weekmenu">
                {recentMondays.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    className={iso === start ? 'kr-weekchip on' : 'kr-weekchip'}
                    onClick={() => goWeek(iso)}
                  >
                    {weekLabel(iso)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="kr-wstep"
            aria-label="Következő hét"
            disabled={isCurrentWeek(start)}
            onClick={() => goWeek(nextMonday(start))}
          >
            ›
          </button>
        </div>

        <div className="kr-runlist">
          {days.map((dayIso) => {
            const dayRuns = runsByDay.get(dayIso) ?? []
            const isToday = dayIso === todayIso
            // M8 (final review): TODAY's own day, and every day after it, cannot have a NIGHTLY
            // run row yet — the nightly job processes YESTERDAY (I1's write-lag), so a run whose
            // `day` equals today is only written tomorrow ~02:50. Treating today as "future" too
            // (not just strictly-after) keeps this honest: a missing row for today is the
            // expected fact that tonight's processing hasn't happened, not a pipeline failure.
            // Rendering MISSING_DAY_LINE there would read as "the pipeline failed to run last
            // night" for a night that hasn't come. The stepper already disables navigating past
            // the current week, so a future day can only appear inside the current week.
            const isFuture = dayIso >= todayIso
            return (
              <div key={dayIso}>
                <div className={isToday ? 'kr-daygrouphd today' : 'kr-daygrouphd'}>
                  <span className="kr-dg-dow">{isToday ? 'MA' : huDow(dayIso).toUpperCase()}</span>
                  <span className="kr-dg-date">{shortDate(dayIso)}</span>
                </div>
                {dayRuns.length === 0 && !isFuture && (
                  <div className="kr-runrow-missing">{MISSING_DAY_LINE}</div>
                )}
                {dayRuns.length === 0 && isFuture && (
                  <div className="kr-runrow-future">{FUTURE_DAY_LINE}</div>
                )}
                {dayRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    className={isQuietNightly(run) ? 'kr-runrow quiet' : 'kr-runrow'}
                    onClick={() => navigate(`/me/karakter/gepterem/futas/${run.id}`)}
                  >
                    <div className="kr-runrow-tx">
                      <div className="kr-runrow-title">
                        {KIND_LABEL[run.kind]} <span className={`kr-run-badge ${run.kind.toLowerCase()}`}>{KIND_BADGE[run.kind]}</span>
                      </div>
                      <div className="kr-runrow-sub">{runRowSubline(run)}</div>
                    </div>
                    <span className="kr-rchev" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="kr-secttl">Ritkább futások</div>
        <div className="kr-rarelist">
          {rareRuns.length === 0 && (
            <p className="kr-sectnote">Ebben az ablakban nincs havi vagy bootstrap futás.</p>
          )}
          {rareRuns.map((run) => (
            <button
              key={run.id}
              type="button"
              className="kr-raretile"
              onClick={() => navigate(`/me/karakter/gepterem/futas/${run.id}`)}
            >
              <div className="kr-runrow-tx">
                <div className="kr-runrow-title">{KIND_LABEL[run.kind]}</div>
                <div className="kr-runrow-sub">{shortDate(run.day)} · {runRowSubline(run)}</div>
              </div>
              <span className="kr-rchev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </PageBody>
    </div>
  )
}
