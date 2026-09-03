// ============================================================
// Mezo · SportPage (Sport) — Mozaik 2.0 re-face (mezo-d20.11).
// Source of truth: docs/design_2.0/prototypes/src/edzes-body.html #page-sport
// (p-rose tone, ×1.18): page-head (‹ Edzés + `＋ Log` pgact) → compact hero
// (page name, i-sport clay spot + a `logolt/tervezett` big number, no
// venue/team theater) → the live stat strip → the three segments
// (Heti terv · Napló · Cross-load) → a quiet principle line.
//
// The old face (an `Edzés · Sport` eyebrow + a `Röplabda` h1 over a big hero
// CARD carrying team/venue/season and the RPE explainer) is gone: the
// prototype's hero is the page name plus one number, and the court is already
// where it belongs — on each slot row's meta line.
//
// Dropped from the prototype's 4-cell strip: the `+XP e héten` cell. The
// prototype fakes it as `logged × 30`; no weekly sport-XP aggregate is on the
// wire, and XP is feedback, never invented. Three honest cells ship instead.
//
// All sport rose accents use the Mozaik rose wash/shadow/cell tokens.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useTrain } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { isMockMode } from '@/data/_client/mode'
import type { SportSchedule, SportSession, CrossLoadRow as CrossLoadRowData } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import type { Tool } from '@/shared/ui/ToolChip'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { DAY_ORDER } from '@/data/train/train'
import type { SportEventResponse } from '@/data/train/trainApi'
import { SportSessionCard } from '@/features/train/components/SportSessionCard'
import { CrossLoadRow } from '@/features/train/components/CrossLoadRow'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import { SportEventSheet } from '@/features/train/sheets/SportEventSheet'
import SportSkeleton from '@/features/train/pages/SportSkeleton'
import { sportOf, SPORT_TAGS, SPORT_TONE, type SportKind } from '@/features/train/logic/sportKinds'

type SportSubView = 'week' | 'log' | 'crossload'

const SUB_VIEWS: { id: SportSubView; label: string }[] = [
  { id: 'week', label: 'Heti terv' },
  { id: 'log', label: 'Napló' },
  { id: 'crossload', label: 'Cross-load' },
]

/** One decimal, Hungarian comma — the prototype's `d1()`. */
const d1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

export function SportPage() {
  const navigate = useNavigate()
  const { sport, sportEvents, logSportSession, saveSportSchedule, addSportEvent, deleteSportEvent, sportPending } =
    useTrain()
  const { showLevelUp } = useLevelUp()
  // Sticky so returning here restores the segment the user left from — see useStickyTab.
  const [view, setView] = useStickyTab<SportSubView>('train.sport.view', 'week')
  const [logOpen, setLogOpen] = useState(false)
  const [logInitialSport, setLogInitialSport] = useState<SportKind | undefined>(undefined)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const openLog = (initial?: SportKind) => {
    setLogInitialSport(initial)
    setLogOpen(true)
  }

  // Loading skeleton (real mode): while the sport-sessions query (sportPending) is
  // unresolved, render the layout-matched skeleton before the first render. Placed
  // after all hook calls so the hook order is render-stable.
  if (sportPending) return <SportSkeleton />

  // T3: schedule comes from the DB slots and week derives from the logged
  // sessions; only crossLoad stays null (Phase 3) — ghost-guard each facet.
  const volleyball = sport.schedule?.volleyball ?? null
  const week = sport.week

  // Hero big number = logged this week / scheduled slots (prototype `2/4`).
  // With no schedule there is nothing to be "out of" — the number renders `—`
  // rather than inventing a denominator.
  const slotCount = volleyball?.sessions.length ?? 0
  const bigNum = volleyball ? `${week?.sessions ?? 0}/${slotCount}` : '—'
  const loggedThisWeek = week != null && week.sessions > 0

  // The prototype's per-segment principle lines (`habnote`), verbatim.
  const principle =
    view === 'week'
      ? 'A heti ritmus független a mezociklustól — új blokk indításakor a sport cross-load automatikusan beépül a volumen-tervbe.'
      : view === 'crossload'
        ? 'A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.'
        : undefined

  return (
    <MozaikPage tone="rose">
      <PageHead onBack={() => navigate('/train')} label="‹ Edzés">
        <button type="button" onClick={() => openLog()} className="mz-pgact">
          ＋ Log
        </button>
      </PageHead>
      {/* One-shot entrance choreography; the segment switch re-arms it so the
          swapped view stages in rather than snapping (replayKey = the view). */}
      <EntranceGroup replayKey={view}>
        <div className="mz-page-hero">
          <div className="mz-hero-nm">Sport</div>
          <div className="mz-hero-row">
            <ClayIcon name="i-sport" size={85} />
            <span className="mz-bignum">{bigNum}</span>
          </div>
        </div>
        <PageBody principle={principle}>
          {/* Stat strip — three honest cells (the prototype's 4th, `+XP e héten`,
              has no wire source; see the module note). A null statistic renders
              `—`, never a fabricated 0. */}
          <div className="mz-statstrip rise" style={{ '--d': '30ms' } as React.CSSProperties}>
            <StatCell value={week ? `${d1(week.hoursPlayed)} ó` : '—'} label="pályán e héten" />
            <StatCell value={loggedThisWeek ? d1(week.avgRPE) : '—'} label="RPE átlag · 1–10" />
            <StatCell value={loggedThisWeek ? d1(week.avgShoulderStrain) : '—'} label="váll-terhelés" />
          </div>

          {/* View switcher */}
          {/* The selected segment speaks PRIMARY, not the sport rose: ADR 0018 D5
              keeps the domain accents in the data-viz band, off buttons. */}
          <div className="segtabs rise" data-kalauz-anchor="sport-tabs" style={{ '--d': '60ms', marginTop: 12 } as React.CSSProperties}>
            {SUB_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className="segtab"
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'week' && (
            <>
              {volleyball ? (
                <SportWeekView
                  schedule={volleyball}
                  onEdit={isMockMode() ? undefined : () => setScheduleOpen(true)}
                  onLogSlot={openLog}
                />
              ) : (
                <div style={{ paddingTop: 8 }}>
                  <GhostState
                    lines={2}
                    message="A heti rended itt jelenik majd meg."
                    ctaLabel="+ Állítsd be a heti rended"
                    onCta={() => setScheduleOpen(true)}
                  />
                </div>
              )}
              <SportEventsSection
                events={sportEvents}
                onAdd={() => setEventOpen(true)}
                onDelete={deleteSportEvent}
              />
            </>
          )}
          {view === 'log' && <SportLogView sessions={sport.sessions} />}
          {view === 'crossload' &&
            (sport.crossLoad ? (
              <SportCrossloadView crossLoad={sport.crossLoad} />
            ) : (
              <div style={{ paddingTop: 8 }}>
                <GhostState lines={2} message="A cross-load elemzés itt jelenik majd meg." />
              </div>
            ))}
        </PageBody>
      </EntranceGroup>

      {logOpen && (
        <SportLogSheet
          initialSport={logInitialSport}
          onClose={() => setLogOpen(false)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
      {scheduleOpen && (
        <SportScheduleSheet
          initial={volleyball?.sessions.filter((s) => !s.oneOff) ?? []}
          onSave={saveSportSchedule}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      {eventOpen && (
        <SportEventSheet
          onClose={() => setEventOpen(false)}
          onSave={(req, done) => addSportEvent(req, { onSettled: done })}
        />
      )}
    </MozaikPage>
  )
}

// === Week view: 7-day schedule with volleyball slots ===
function SportWeekView({ schedule, onEdit, onLogSlot }: {
  schedule: SportSchedule['volleyball']
  onEdit?: () => void
  /** Inline "Logold ›" on today's slot — preselects that slot's sport in the log sheet. */
  onLogSlot?: (initial: SportKind) => void
}) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div
        className="row rise"
        style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, '--d': '30ms' } as React.CSSProperties}
      >
        <span className="mz-eyebrow">Heti ritmus · {schedule.weeklyHours} ó</span>
        {onEdit && (
          <button type="button" className="chip tapchip" onClick={onEdit}>
            Szerkesztés
          </button>
        )}
      </div>
      {/* Every day of the week renders — a day with no slot is the prototype's
          dashed „nincs session" row, not an omission (edzes-body `.sday.empty`). */}
      <div>
        {DAY_ORDER.map((d, di) => {
          const daySlots = schedule.sessions.filter((s) => s.day === d)
          const isToday = daySlots.some((s) => s.today)
          return (
            <div
              key={d}
              className={[
                'spw-day rise',
                daySlots.length ? 'has' : 'empty',
                isToday ? 'today' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--d': `${50 + di * 40}ms` } as React.CSSProperties}
            >
              <span className="spw-dlbl">{d}</span>
              {daySlots.length ? (
                <div className="flex-1">
                  {daySlots.map((session, i) => {
                    const kind = sportOf(session)
                    return (
                      <div key={`${session.time}-${i}`} className="spw-slot">
                        <div className="spw-l1">
                          {/* The type tag rides EVERY slot, RÖPI included — the
                              prototype's `.stag` is how a row says which sport it is. */}
                          <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
                          <b>{session.time}</b>
                          <span className="dur">· {session.duration}p</span>
                          {session.today && <span className="spw-ma">MA</span>}
                          {session.oneOff && <span className="spw-one">EGYSZERI</span>}
                          {session.today && onLogSlot && (
                            <button
                              type="button"
                              className="chip tapchip spw-logbtn"
                              onClick={() => onLogSlot(kind)}
                            >
                              Logold ›
                            </button>
                          )}
                        </div>
                        {[session.court, session.role, session.intensity].filter(Boolean).length > 0 && (
                          <div className="spw-l2">
                            {[session.court, session.role, session.intensity].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="spw-none">nincs session</span>
              )}
            </div>
          )
        })}
      </div>

      <div
        className="card mt-lg rise"
        style={{ padding: 'var(--sp-4)', background: 'var(--wash-sport)', '--d': '340ms' } as React.CSSProperties}
      >
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={16} color="var(--primary-base)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Heti ritmus · független</span>
            <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              A röplabda recurring · független a gym mesociklustól. Új meso indításakor a Mezo automatikusan beleépíti a
              volleyball cross-load-ot a volumen-tervbe.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// === One-off events (mezo-e1sp): upcoming list + the single add entry point ===
// A saved event lands on its day in `Heti terv`/`Mai` via the trainHooks schedule
// merge; this section manages the standing list (today + future, with delete) and
// works in mock mode too (cache-emulated writes).
function SportEventsSection({ events, onAdd, onDelete }: {
  events: SportEventResponse[]
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const today = localDateString()
  const upcoming = events.filter((e) => e.date >= today)
  return (
    <div style={{ paddingTop: 4 }}>
      {upcoming.length > 0 && (
        <>
          <span
            className="mz-eyebrow rise"
            style={{ display: 'block', margin: '8px 0', '--d': '340ms' } as React.CSSProperties}
          >
            Egyszeri események
          </span>
          <div className="col gap-sm" style={{ marginBottom: 8 }}>
            {upcoming.map((e) => {
              // The event's sport is CHECK-constrained server-side; sportOf normalizes it
              // through the same guard every other surface uses.
              const kind = sportOf({ sport: e.sport as SportKind })
              return (
                <div
                  key={e.id}
                  className="card row rise"
                  style={{ padding: '10px 12px', alignItems: 'center', gap: 10, '--d': '370ms' } as React.CSSProperties}
                >
                  <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
                  <div className="col flex-1">
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {huMonthDayDow(e.date)} · {e.time}
                    </span>
                    <span className="text-tertiary" style={{ fontSize: 14, marginTop: 2 }}>
                      {[`${e.durationMin}p`, e.kind === 'match' ? 'meccs' : 'edzés', e.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="chip"
                    aria-label={`${huMonthDayDow(e.date)} esemény törlése`}
                    onClick={() => onDelete(e.id)}
                    style={{ padding: '6px 8px' }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
      {/* Same dashed "add one more" CTA the Mai/Heti lists close with. */}
      <button
        type="button"
        className="card dashedcta rise"
        onClick={onAdd}
        style={{ color: 'var(--text-secondary)', '--d': '400ms' } as React.CSSProperties}
      >
        ＋ Egyszeri esemény
      </button>
    </div>
  )
}

// === Session log ===
function SportLogView({ sessions }: { sessions: SportSession[] }) {
  if (sessions.length === 0) {
    return (
      <div style={{ paddingTop: 8 }}>
        <span className="text-meta-sm text-tertiary">
          Még nincs logolt session.
        </span>
      </div>
    )
  }
  // Jump counts are not captured by the T3 log sheet — average only the sessions
  // that carry one, and hide the chip entirely when none do.
  const withJumps = sessions.filter((s) => s.jumpCount != null)
  const avgJumps = withJumps.length
    ? Math.round(withJumps.reduce((acc, s) => acc + (s.jumpCount ?? 0), 0) / withJumps.length)
    : null
  return (
    <div style={{ paddingTop: 8 }}>
      <div
        className="row rise"
        style={{ justifyContent: 'space-between', marginBottom: 12, '--d': '60ms' } as React.CSSProperties}
      >
        <span className="mz-eyebrow">Utolsó {sessions.length} session</span>
        {avgJumps != null && <span className="mz-eyebrow">avg {avgJumps} ugrás</span>}
      </div>
      <div className="col gap-sm">
        {sessions.map((s, i) => (
          <div key={s.id} className="rise" style={{ '--d': `${90 + i * 45}ms` } as React.CSSProperties}>
            <SportSessionCard session={s} />
          </div>
        ))}
      </div>
    </div>
  )
}

// === Cross-load view ===
const CROSSLOAD_INTRO =
  'A röplabda load automatikusan beleszámolódik **minden alrendszerbe**: edzés-volumen, étkezés-ablakok, ' +
  'alvás-impact, súly-fluktuáció, pattern engine.'

const CROSSLOAD_TOOLS: Tool[] = [
  { type: 'read', name: 'get_sport_load', args: '28d' },
  { type: 'compute', name: 'computeMuscleLoadCarryover' },
  { type: 'compute', name: 'applySportTransferRule' },
  { type: 'write', name: 'updateCrossSystemTargets' },
]

function SportCrossloadView({ crossLoad }: { crossLoad: CrossLoadRowData[] }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div
        className="card rise"
        style={{ padding: 'var(--sp-4)', background: 'var(--wash-sport)', marginBottom: 14, '--d': '30ms' } as React.CSSProperties}
      >
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={16} color="var(--primary-base)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Mezo · keresztrendszer hatások</span>
            <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              <SafeMarkdown text={CROSSLOAD_INTRO} />
            </p>
          </div>
        </div>
      </div>

      {/* Tool transparency — the prototype puts the tool chips ABOVE the rows
          (`toolchips` at --d:60ms, the impact rows from 90ms). */}
      <div className="rise" style={{ '--d': '60ms' } as React.CSSProperties}>
        <ToolChipRow tools={CROSSLOAD_TOOLS} />
      </div>

      <div className="col gap-sm" style={{ marginBottom: 12 }}>
        {crossLoad.map((c, i) => (
          <div key={`${c.system}-${i}`} className="rise" style={{ '--d': `${90 + i * 45}ms` } as React.CSSProperties}>
            <CrossLoadRow item={c} />
          </div>
        ))}
      </div>
    </div>
  )
}
