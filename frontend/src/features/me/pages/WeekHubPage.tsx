// ============================================================
// Mezo · WeekHubPage — the Heti hub (mezo-d20.6.10)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html — `#page-heti`
// plus the `hub()` function in the „Heti áttekintés" IIFE, x1.18.
//
// Replaces the long-scroll WeekPage: hero (animated score ring + delta pill +
// 8-week trend) → eight mini-cells → four view tiles, each opening its own page
// → the „Mezo · a következő heted" band → the honesty footnote. The four detail
// pages (/me/week/elemzes | tanulsagok | napok | felfedezesek) are owned by the
// sibling slices; this page only navigates to them.
//
// Honest states (handoff §4) are the point of the rewrite, not decoration:
// missing data is „—" and never a 0; a week with fewer than two measured days
// gets no score; a CLOSED week without an analysis says so (and offers to make
// one) instead of borrowing the running week's „Hétfő reggel érkezik" ghost;
// a failed load offers a retry instead of rendering as an empty week.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMeWeek, useWeeklyReview } from '@/data/hooks'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { localDateString } from '@/shared/lib/dates'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { weeklySuggestionApi, type WeeklySuggestion } from '@/data/insights/weeklySuggestionApi'
import { weeklySuggestion as mockWeeklySuggestion, weeklySuggestionId as mockWeeklySuggestionId } from '@/data/insights/insights'
import { MozaikPage, PageBody, PageHead, MCells } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { prevMonday, nextMonday, isCurrentWeek } from '@/features/me/logic/weekNav'
import { scoreBandClass, scoreBandColor, scoreDelta } from '@/features/me/logic/scoreBand'
import {
  analysisSnippet, dayScoreState, DAY_STATE_COPY, discoverySummary, generationStamp,
  loggedDayCount, resolveWeekStart, weekPhase, weekStatCells, weekSubline,
} from '@/features/me/logic/weekHub'
import { WeekScoreRing } from '@/features/me/components/week/WeekScoreRing'
import { WeekTrendSpark, type WeekTrendPoint } from '@/features/me/components/week/WeekTrendSpark'
import { WeekNextCard } from '@/features/me/components/WeekNextCard'
import type { MeWeekDay } from '@/data/me/meWeek'

/** The next-week card's source — the same W1 proactive suggestion the retired WeekPage read
 *  (unchanged endpoint, GET by the FE's local day, real-mode 404-tolerant), moved here verbatim.
 *
 *  `enabled` gates the card to the CURRENT week only: the suggestion is always about "today's"
 *  week regardless of `startIso` (there is no per-week variant of this endpoint), so showing it
 *  while browsing another week would put unrelated content under a „Mezo · a következő heted"
 *  label implying it belongs there. Disabled skips the fetch too, not just the render. */
function useWeekNextSuggestion(enabled: boolean): WeeklySuggestion | null {
  const mock = isMockMode()
  const { data } = useQuery<WeeklySuggestion | null>({
    queryKey: ['weeklySuggestion', localDateString()],
    queryFn: async () => {
      try {
        return await weeklySuggestionApi.get(localDateString())
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    enabled: enabled && !mock,
    retry: false,
  })
  if (!enabled) return null
  if (mock) return { id: mockWeeklySuggestionId, prose: mockWeeklySuggestion }
  return data ?? null
}

const d = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)

/** The analysis tile's seven day bars — `.wk-minibars` from the Heti foundation.
 *  A day with no score gets the minimum stub, never a bar pretending to be a low score. */
function MiniBars({ days }: { days: readonly MeWeekDay[] }) {
  return (
    <div className="wk-minibars" aria-hidden="true">
      {days.map((day, i) => (
        <i
          key={day.date}
          className={scoreBandClass(day.score)}
          style={{
            height: `${day.score == null ? 4 : Math.max(5, Math.round((day.score / 100) * 24))}px`,
            '--d': `${400 + i * 45}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

export function WeekHubPage() {
  const [params, setParams] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  const navigate = useNavigate()

  const { week, isPending, isError, refetch } = useMeWeek(start)
  const { review, digest, regenerate, regenerating } = useWeeklyReview(start)

  const phase = weekPhase(start, mondayIso())
  const running = phase === 'running'
  const nextSuggestion = useWeekNextSuggestion(running)
  const todayIso = localDateString()

  const goWeek = (iso: string) => setParams({ start: iso }, { replace: true })
  const goPage = (slug: string) => navigate(`/me/week/${slug}?start=${start}`)

  const head = (
    <PageHead label="‹ Én" onBack={() => navigate('/me')}>
      <div className="wkh-nav">
        <button type="button" aria-label="Előző hét" onClick={() => goWeek(prevMonday(start))}>‹</button>
        <button type="button" aria-label="Következő hét" disabled={isCurrentWeek(start)}
          onClick={() => goWeek(nextMonday(start))}>›</button>
      </div>
    </PageHead>
  )

  // A genuinely failed fetch is NOT an empty week — say so and offer the retry
  // (`useMeWeek` used to throw both isPending and isError away).
  if (isError && week == null) {
    return (
      <MozaikPage tone="lav" className="wkh-page">
        {head}
        <div className="mz-page-hero"><div className="mz-hero-nm">{deriveWeekTitle(start)}</div></div>
        <PageBody>
          <GhostState message="Nem sikerült betölteni a hetet." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }

  // Real mode, unresolved (including every week switch): a skeleton, not a blank page.
  if (week == null) {
    return (
      <MozaikPage tone="lav" className="wkh-page">
        {head}
        <div className="mz-page-hero">
          <div className="mz-hero-nm">{deriveWeekTitle(start)}</div>
          <div className="wkh-skel ring" data-testid="wkh-skeleton" aria-hidden="true" />
          <div className="mz-hero-sb">{isPending ? 'töltöm a hetet…' : ''}</div>
        </div>
        <PageBody>
          <div className="wkh-skel" style={{ height: 48 }} aria-hidden="true" />
          <div className="wkh-skel" style={{ height: 48 }} aria-hidden="true" />
          <div className="wkh-skel" style={{ height: 132 }} aria-hidden="true" />
          <div className="wkh-skel" style={{ height: 106 }} aria-hidden="true" />
        </PageBody>
      </MozaikPage>
    )
  }

  const weekly = week.weekly
  const score = weekly.score ?? null
  const prev = weekly.prevWeekScore ?? null
  const delta = scoreDelta(score, prev)
  const cells = weekStatCells(weekly)
  const logged = loggedDayCount(week.days)
  const stamp = generationStamp(review, phase)
  const snippet = analysisSnippet(review, phase)
  const discoveries = discoverySummary(digest)
  const dayStates = week.days.map((day) => dayScoreState(day, todayIso))

  // The 8-week score series is the F6.6 backend slice (no `/api/me/week/trend` yet). Until it
  // exists the spark is honestly absent — the delta pill carries the longitudinal signal.
  // Wired here, not stubbed with a fabricated series.
  const trendPoints: WeekTrendPoint[] = []

  const showRepair = review == null && phase === 'closed'

  return (
    <MozaikPage tone="lav" className="wkh-page">
      {head}

      <div className="mz-page-hero">
        <div className="mz-hero-nm">{deriveWeekTitle(start)}</div>
        <div className="wkh-herorow">
          <WeekScoreRing score={score} />
          <div className="wkh-heroside">
            {delta && (
              <div>
                <span className={`wk-delta${delta.direction === 'down' ? ' is-down' : delta.direction === 'flat' ? ' is-flat' : ''}`}>
                  {delta.text}
                </span>
                <span className="wkh-prev">előző hét {prev}</span>
              </div>
            )}
            {trendPoints.length > 0 && (
              <>
                <div className="wkh-trendlbl">8 hét · pontszám</div>
                <WeekTrendSpark points={trendPoints} currentWeekStart={start} />
              </>
            )}
          </div>
        </div>
        <div className="mz-hero-sb">{weekSubline(phase, review != null, score)}</div>
      </div>

      <PageBody>
        <EntranceGroup replayKey={start} className="mz-panel-stack">
          <div className="wkh-cellstack">
            <MCells className="wkh-cells rise" cells={cells.slice(0, 4).map((c) => ({
              tone: c.tone, label: c.label,
              value: <>{c.value}{c.unit && <span className="wkh-cellunit"> {c.unit}</span>}</>,
            }))} />
            <MCells className="wkh-cells rise" cells={cells.slice(4).map((c) => ({
              tone: c.tone, label: c.label,
              value: <>{c.value}{c.unit && <span className="wkh-cellunit"> {c.unit}</span>}</>,
            }))} />
          </div>

          <div className="wkh-lsec rise" style={d(80)}>
            <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>A hét négy nézete</span>
          </div>

          {/* 1 · Heti elemzés — the wide, lavender-ringed tile */}
          <button type="button" className="wkh-wide rev rise" style={d(110)} onClick={() => goPage('elemzes')}>
            <div className="wkh-row">
              <ClaySpot name="s-orb" size={31} />
              <span className="wkh-grow mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Mezo · heti elemzés</span>
              <span className={`wkh-stch ${stamp.tone}`}>{stamp.text}</span>
              <span className="wkh-chev" aria-hidden="true">›</span>
            </div>
            <div className="wkh-snip">{snippet}</div>
            <MiniBars days={week.days} />
            <div className="wkh-widefoot">
              <span>{review == null && running ? `${logged} / 7 nap logolva` : `napi pontszám · ${logged} / 7 nap`}</span>
              <span className="wkh-open">nyisd ki ›</span>
            </div>
          </button>

          {/* The closed-week repair action. A sibling of the tile, never nested inside it. */}
          {showRepair && (
            <button type="button" className="wkh-genbtn rise" style={d(130)} disabled={regenerating}
              onClick={() => void regenerate()}>
              {regenerating ? 'Készül…' : '✦ Készítsd el most'}
            </button>
          )}

          <div className="wkh-duo rise" style={d(150)}>
            {/* 2 · A hét tanulságai */}
            <button type="button" className="wkh-sm less" onClick={() => goPage('tanulsagok')}>
              <div className="picrow">
                <ClayIcon name="i-kristaly" size={26} />
                <span className="wkh-chev" style={{ marginLeft: 'auto' }} aria-hidden="true">›</span>
              </div>
              {/* No week-scoped candidate source exists yet (F6.5) — „—", never a borrowed count. */}
              <div className="big">—</div>
              <div className="lb less">A hét tanulságai</div>
              <div className="sub">{running ? 'a hét közben még gyűlik' : 'nincs javaslat ehhez a héthez'}</div>
            </button>

            {/* 3 · A hét napjai */}
            <button type="button" className="wkh-sm days" onClick={() => goPage('napok')}>
              <div className="picrow">
                <ClayIcon name="i-nap" size={26} />
                <span className="wkh-chev" style={{ marginLeft: 'auto' }} aria-hidden="true">›</span>
              </div>
              <div className="big">{logged}<span> / 7 nap</span></div>
              <div className="lb days">A hét napjai</div>
              <div className="wkh-miniring" role="img"
                aria-label={`${logged} mért nap · ${dayStates.filter((s) => s === 'learning').length} tanulom · ${dayStates.filter((s) => s === 'nodata').length} nincs adat`}>
                {week.days.map((day, i) => {
                  const state = dayStates[i]
                  return (
                    <i
                      key={day.date}
                      className={state === 'nodata' ? 'is-nodata' : state === 'future' ? 'is-future' : undefined}
                      title={DAY_STATE_COPY[state] ?? undefined}
                      style={{ '--c': scoreBandColor(day.score), '--v': day.score ?? 0 } as CSSProperties}
                    />
                  )
                })}
              </div>
              <div className="sub">nézd meg egyesével</div>
            </button>
          </div>

          {/* 4 · Heti felfedezések */}
          <button type="button" className="wkh-wide disc rise" style={d(190)} onClick={() => goPage('felfedezesek')}>
            <div className="wkh-row">
              <span className="wkh-pic"><ClayIcon name="i-retegek" size={21} /></span>
              <span className="wkh-grow">
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sky-ink)' }}>Heti felfedezések</span>
                <span className="wkh-disctitle" style={{ display: 'block' }}>
                  {discoveries.count > 0 ? `${discoveries.count} új nyom a memóriában` : 'Csendes hét volt'}
                </span>
              </span>
              <span className="wkh-chev" aria-hidden="true">›</span>
            </div>
            {discoveries.count > 0 ? (
              <div className="wkh-widefoot">
                <span className="wkh-discparts">{discoveries.parts.join(' · ')}</span>
                <span className="wkh-dots" aria-hidden="true">
                  {discoveries.dots.map((dot, i) => <i key={`${dot}-${i}`} className={dot} />)}
                </span>
              </div>
            ) : (
              <div className="wkh-discempty">nem született új minta vagy tudás</div>
            )}
          </button>

          {/* „Mezo · a következő heted" — running week only, gating unchanged. */}
          {running && <WeekNextCard suggestion={nextSuggestion} />}

          <p className="wkh-foot rise" style={d(270)}>
            A pontszám a hat mért területből áll össze — ha kettőnél kevesebb van, „tanulom" áll a szám
            helyén. A Mezo sosem talál ki számot: az elemzés csak a logolt adatokból dolgozik.
          </p>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
