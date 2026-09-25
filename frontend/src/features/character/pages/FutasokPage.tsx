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
//
// Üveg re-dress (U9, mezo-me75u.9) — uveg-mezo-teljes-u9.js `futasok()`: the csapatfal's slate
// dev-door head, a glass week pill between flat steppers, day headers, and each run as a
// `tf-case` ranked by `runRank` (glass = it produced something, flat = quiet / catch-up, flat +
// amber = processing not verifiably finished); missing and future days are dashed.
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@/features/insights/boop-world.css'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GepteremHead } from '@/features/character/components/GepteremHead'
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
    <div className="tf-page tf-c-slate gtm-page gtm-futasok">
      <GepteremHead small="Gépterem · a pipeline futásai, hetekre bontva" title="Futások"
        onBack={() => navigate('/mezo/karakter/gepterem')} />
      <div className="gtm-week">
        <button type="button" className="gtm-wstep" aria-label="Előző hét" onClick={() => goWeek(prevMonday(start))}>‹</button>
        {/* Fix round 1 (a11y): no `aria-label` override on the week button — its own text (the
           browsed range + "legutóbbi futások" / "korábbi hét") is the accessible name. */}
        <div className="gtm-wlwrap" ref={weeklblRef}>
          <button
            type="button"
            className="glass tf-c-slate gtm-wl"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <strong>{weekLabel(start)}</strong>
            <small>{isCurrentWeek(start) ? 'legutóbbi futások' : 'korábbi hét'} <span aria-hidden="true">⌄</span></small>
          </button>
          {menuOpen && (
            <div className="glass tf-c-slate gtm-wmenu">
              {recentMondays.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  className={iso === start ? 'gtm-wchip on' : 'gtm-wchip'}
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
          className="gtm-wstep"
          aria-label="Következő hét"
          disabled={isCurrentWeek(start)}
          onClick={() => goWeek(nextMonday(start))}
        >
          ›
        </button>
      </div>

      <div className="gtm-runlist">
        {days.map((dayIso, di) => {
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
            <div key={dayIso} className="gtm-daygroup">
              <div className={isToday ? 'gtm-day today' : 'gtm-day'}>
                <b>{isToday ? 'MA' : huDow(dayIso).toUpperCase()}</b>
                <span>{shortDate(dayIso)}</span>
              </div>
              <div className="tf-rows">
                {dayRuns.length === 0 && !isFuture && (
                  <div className="tf-dash gtm-free" data-state="missing">
                    <Icon3D name="t-info" size={22} /><span>{MISSING_DAY_LINE}</span>
                  </div>
                )}
                {dayRuns.length === 0 && isFuture && (
                  <div className="tf-dash gtm-free gtm-future" data-state="future">
                    <Icon3D name="t-clock" size={22} /><span>{FUTURE_DAY_LINE}</span>
                  </div>
                )}
                {dayRuns.map((run) => (
                  <RunRow key={run.id} run={run} index={di}
                    onOpen={() => navigate(`/mezo/karakter/gepterem/futas/${run.id}`)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="tf-sec"><h2>Ritkább futások</h2></div>
      <div className="tf-rows gtm-rare">
        {rareRuns.length === 0 && (
          <p className="gtm-lede gtm-rare-empty">Ebben az ablakban nincs havi vagy bootstrap futás.</p>
        )}
        {rareRuns.map((run) => (
          <button
            key={run.id}
            type="button"
            className={`tf-case tf-flatc tf-c-${KIND_ACCENT[run.kind]} gtm-run`}
            onClick={() => navigate(`/mezo/karakter/gepterem/futas/${run.id}`)}
          >
            <span className="tf-cmain">
              <Icon3D name={KIND_ICON[run.kind]} size={36} />
              <span className="tf-ctxt">
                <span className="tf-ctitle">{KIND_LABEL[run.kind]}</span>
                <span className="tf-csub">{shortDate(run.day)} · {runRowSubline(run)}</span>
              </span>
              <span className="tf-chev" aria-hidden="true">›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Each run kind's csapatfal accent + 3D icon (uveg-mezo-teljes-u9.js `futasok()`): nightly
 *  lavender moon, the weekly konzílium gold, the esti kiadás rose scroll. */
const KIND_ACCENT: Record<CharacterRunSummary['kind'], 'lav' | 'gold' | 'rose' | 'sage'> = {
  NIGHTLY: 'lav', WEEKLY: 'gold', MONTHLY: 'gold', BOOTSTRAP: 'sage', EDITION: 'rose',
}
const KIND_ICON: Record<CharacterRunSummary['kind'], Icon3DName> = {
  NIGHTLY: 't-moon', WEEKLY: 't-calendar', MONTHLY: 't-calendar', BOOTSTRAP: 't-sprout', EDITION: 't-scroll',
}

/** The row's rank (bible §3.4): a run that produced something is a glass case; a quiet or
 *  catch-up run is a flat one; a NIGHTLY run whose processing did not verifiably finish is flat
 *  with an amber state — the same `status !== 'SUCCESS'` split `runRowSubline` words. */
function runRank(run: CharacterRunSummary): 'glass' | 'flat' | 'incomplete' {
  if (run.kind === 'NIGHTLY' && run.status !== 'SUCCESS') return 'incomplete'
  return run.observationCount > 0 ? 'glass' : 'flat'
}

function RunRow({ run, index, onOpen }: { run: CharacterRunSummary; index: number; onOpen: () => void }) {
  const rank = runRank(run)
  const accent = KIND_ACCENT[run.kind]
  const material = rank === 'glass' ? 'glass tf-case' : 'tf-case tf-flatc'
  return (
    <button
      type="button"
      className={`${material} tf-c-${accent} gtm-run${isQuietNightly(run) ? ' quiet' : ''}${rank === 'incomplete' ? ' gtm-incomplete' : ''} rise`}
      data-rank={rank}
      style={{ '--d': `${Math.min(index, 8) * 40}ms` } as CSSProperties}
      onClick={onOpen}
    >
      <span className="tf-crow">
        <span className={`tf-st tf-s-${rank === 'incomplete' ? 'gold' : accent}`}>{KIND_BADGE[run.kind]}</span>
        {rank === 'incomplete' && <em><Icon3D name="t-info" size={18} /></em>}
      </span>
      <span className="tf-cmain">
        <Icon3D name={KIND_ICON[run.kind]} size={36} />
        <span className="tf-ctxt">
          <span className="tf-ctitle">{KIND_LABEL[run.kind]}</span>
          <span className="tf-csub">{runRowSubline(run)}</span>
        </span>
        <span className="tf-chev" aria-hidden="true">›</span>
      </span>
    </button>
  )
}
