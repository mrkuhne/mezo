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
// "Ritkább futások" (MONTHLY/BOOTSTRAP): GET /api/character/runs caps a query span at 62 days
// (Task 2 contract, CHARACTER_RUN_RANGE_INVALID) — the rare-runs window is the 62 days ending
// at the browsed week, the widest single query the endpoint allows, not an unbounded lookback.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@/features/character/character.css'
import { PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { useCharacterRuns } from '@/data/hooks'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { isCurrentWeek, nextMonday, prevMonday, resolveWeekStart } from '@/features/me/logic/weekNav'
import { addDays, huDow } from '@/shared/lib/dates'
import { KIND_BADGE, KIND_LABEL, MISSING_DAY_LINE, runRowSubline } from '@/features/character/runLabels'
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
  const goWeek = (iso: string) => { setParams({ start: iso }, { replace: true }); setMenuOpen(false) }

  const currentMonday = mondayIso()
  const recentMondays = Array.from({ length: WEEKS_BACK + 1 }, (_, i) => addDays(currentMonday, -7 * (WEEKS_BACK - i)))

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
          <div className="kr-weeklbl">
            <button
              type="button"
              className="kr-weeklbl-btn"
              aria-label="Hét választása"
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
            return (
              <div key={dayIso}>
                <div className="kr-daygrouphd">
                  <span className="kr-dg-dow">{huDow(dayIso).toUpperCase()}</span>
                  <span className="kr-dg-date">{shortDate(dayIso)}</span>
                </div>
                {dayRuns.length === 0 && (
                  <div className="kr-runrow-missing">{MISSING_DAY_LINE}</div>
                )}
                {dayRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    className={run.observationCount === 0 && run.kind === 'NIGHTLY' ? 'kr-runrow quiet' : 'kr-runrow'}
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
