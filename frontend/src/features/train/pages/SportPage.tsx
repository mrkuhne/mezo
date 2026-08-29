// ============================================================
// Mezo · SportPage (Sport) — volleyball schedule + session log +
// cross-system load. A full-page sibling of the Edzés hub — it owns its own
// .pghead-np (over `Edzés · Sport`, h1 `Röplabda`, `+ Log` pgact-np chip).
// Ported from prototype sport.jsx (SportPage + SportWeekView +
// SportLogView + SportCrossloadView). All sport rose accents use the
// Napiv --tag-sport/--wash-sport tokens (rose vocabulary); the faint teal
// Coral card tints follow the existing Insights/Fuel slice convention.
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useTrain } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { isMockMode } from '@/data/_client/mode'
import type { SportSchedule, SportSession, CrossLoadRow as CrossLoadRowData } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { Display } from '@/shared/ui/Display'
import { Icon } from '@/shared/ui/Icon'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import type { Tool } from '@/shared/ui/ToolChip'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { DAY_ORDER } from '@/data/train/train'
import type { SportEventResponse } from '@/data/train/trainApi'
import { SportStat } from '@/features/train/components/SportStat'
import { SportSessionCard } from '@/features/train/components/SportSessionCard'
import { CrossLoadRow } from '@/features/train/components/CrossLoadRow'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import { SportEventSheet } from '@/features/train/sheets/SportEventSheet'
import SportSkeleton from '@/features/train/pages/SportSkeleton'
import { sportOf, SPORT_TAGS, type SportKind } from '@/features/train/logic/sportKinds'

type SportSubView = 'week' | 'log' | 'crossload'

const SUB_VIEWS: { id: SportSubView; label: string }[] = [
  { id: 'week', label: 'Heti terv' },
  { id: 'log', label: 'Napló' },
  { id: 'crossload', label: 'Cross-load' },
]

const RPE_EXPLAINER =
  '**RPE = Rate of Perceived Exertion** · 1-10 skála, amit te magad adsz meg a session után. ' +
  '**6-7 = közepes-jó tempó**, 8+ = kemény meccs, 9+ = teljes gáz. A Mezo ezt használja a ' +
  'regenerálódás + másnapi load számolásához.'

export function SportPage() {
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

  // Venue = the most frequent slot location (schedule-derived; the mock fixture
  // yields the same 'BVSC csarnok' string the prototype hardcoded).
  const venue = (() => {
    const counts = new Map<string, number>()
    for (const s of volleyball?.sessions ?? []) if (s.court) counts.set(s.court, (counts.get(s.court) ?? 0) + 1)
    let best = 'Volleyball'
    let bestN = 0
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n }
    return best
  })()

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Sport</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Röplabda</PageTitle>
        </div>
        <button type="button" onClick={() => openLog()} className="pgact">
          + Log
        </button>
      </div>

      {/* Hero card — stats need a schedule + computed week (T3); ghost until then */}
      <div style={{ padding: '0 24px 16px' }}>
        {!week || !volleyball ? (
          <GhostState lines={3} message="A statisztikáid az első logolt session után jelennek meg." />
        ) : (
        <div
          className="card"
          style={{
            padding: 'var(--sp-4)',
            background:
              'linear-gradient(165deg, var(--wash-sport), var(--surface-card) 72%)',
            borderColor: 'color-mix(in srgb, var(--tag-sport) 16%, transparent)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--tag-sport)' }} />
          <span
            style={{
              position: 'absolute',
              right: -50,
              top: -50,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--wash-sport), transparent 70%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col">
                <span className="eyebrow" style={{ color: 'var(--tag-sport)' }}>
                  {volleyball.team || 'Volleyball'}
                </span>
                <div style={{ marginTop: 6 }}>
                  <Display size="lg">{venue}</Display>
                </div>
                {volleyball.season && (
                  <span className="text-secondary mt-sm" style={{ fontSize: 14 }}>
                    {volleyball.season}
                  </span>
                )}
              </div>
            </div>

            {/* Week stats */}
            <div className="statstrip mt-lg">
              <SportStat label="Sessions" val={week.sessions} sub={`/${volleyball.sessions.length} heti`} />
              <SportStat label="Idő" val={`${week.hoursPlayed}h`} sub="court" highlight />
              <SportStat label="RPE" val={week.avgRPE.toFixed(1)} sub="átlag · 1-10" />
              <SportStat label="Váll" val={week.avgShoulderStrain.toFixed(1)} sub="terhelés" />
            </div>

            {/* RPE explainer */}
            <div
              className="row gap-sm mt-md"
              style={{ padding: '10px 12px', borderRadius: 'var(--r-lg)', background: 'var(--surface-recess)', alignItems: 'flex-start' }}
            >
              <Icon name="sparkle" size={14} color="var(--primary-base)" />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                <SafeMarkdown text={RPE_EXPLAINER} />
              </span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* View switcher */}
      {/* The selected segment speaks PRIMARY, not the sport rose: ADR 0018 D5
          keeps the domain accents in the data-viz band, off buttons. */}
      <div className="segtabs" style={{ padding: '0 24px 12px' }}>
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
            <div style={{ padding: '8px 24px 16px' }}>
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
          <div style={{ padding: '8px 24px 16px' }}>
            <GhostState lines={2} message="A cross-load elemzés itt jelenik majd meg." />
          </div>
        ))}

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
    </>
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
    <div style={{ padding: '8px 24px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="eyebrow">Heti ritmus · {schedule.weeklyHours}h</span>
        {onEdit && (
          <button type="button" className="chip tapchip" onClick={onEdit}>
            Szerkesztés
          </button>
        )}
      </div>
      <div className="col gap-sm">
        {DAY_ORDER.map((d) => {
          const daySlots = schedule.sessions.filter((s) => s.day === d)
          const isToday = daySlots.some((s) => s.today)
          return (
            <div
              key={d}
              className="card"
              style={{
                padding: 0,
                borderColor: isToday ? 'color-mix(in srgb, var(--tag-sport) 40%, transparent)' : 'var(--divider)',
                background: isToday
                  ? 'var(--wash-sport)'
                  : daySlots.length
                    ? 'var(--surface-1)'
                    : 'transparent',
                borderStyle: daySlots.length ? 'solid' : 'dashed',
                position: 'relative',
                overflow: 'hidden',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              }}
            >
              {isToday && (
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--tag-sport)' }} />
              )}
              <div
                className="row"
                style={{ padding: '12px 14px', alignItems: 'center', gap: 12, paddingLeft: isToday ? 16 : 14 }}
              >
                <span
                  className="label-mono"
                  style={{
                    width: 40,
                    fontSize: 12,
                    color: isToday ? 'var(--tag-sport)' : daySlots.length ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                >
                  {d}
                </span>
                {daySlots.length ? (
                  <>
                    <div className="col flex-1 gap-sm">
                      {daySlots.map((session, i) => {
                        const kind = sportOf(session)
                        return (
                          <div key={`${session.time}-${i}`} className="col">
                            <div className="row gap-sm" style={{ alignItems: 'center' }}>
                              {kind !== 'volleyball' && (
                                <span className="stag stag-sport">{SPORT_TAGS[kind]}</span>
                              )}
                              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{session.time}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--text-tertiary)' }}>
                                · {session.duration}p
                              </span>
                              {session.today && (
                                <span
                                  className="excat-tag"
                                  style={{ background: 'var(--wash-sport)', color: 'var(--tag-sport)' }}
                                >
                                  MA
                                </span>
                              )}
                              {session.oneOff && (
                                <span
                                  className="excat-tag"
                                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                                >
                                  EGYSZERI
                                </span>
                              )}
                              {session.today && onLogSlot && (
                                <button
                                  type="button"
                                  className="chip tapchip"
                                  style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => onLogSlot(kind)}
                                >
                                  Logold ›
                                </button>
                              )}
                            </div>
                            <span
                              className="text-tertiary"
                              style={{ fontSize: 14, marginTop: 2 }}
                            >
                              {[session.court, session.role, session.intensity].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
                  </>
                ) : (
                  <span className="text-meta-sm text-tertiary">
                    nincs session
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card mt-lg" style={{ padding: 'var(--sp-4)', background: 'var(--wash-sport)' }}>
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
    <div style={{ padding: '0 24px 16px' }}>
      {upcoming.length > 0 && (
        <>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>
            Egyszeri események
          </span>
          <div className="col gap-sm" style={{ marginBottom: 8 }}>
            {upcoming.map((e) => {
              // The event's sport is CHECK-constrained server-side; sportOf normalizes it
              // through the same guard every other surface uses.
              const kind = sportOf({ sport: e.sport as SportKind })
              return (
                <div key={e.id} className="card row" style={{ padding: '10px 12px', alignItems: 'center', gap: 10 }}>
                  <span className="stag stag-sport">{SPORT_TAGS[kind]}</span>
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
      <button type="button" className="card dashedcta" onClick={onAdd} style={{ color: 'var(--text-secondary)' }}>
        + Egyszeri esemény
      </button>
    </div>
  )
}

// === Session log ===
function SportLogView({ sessions }: { sessions: SportSession[] }) {
  if (sessions.length === 0) {
    return (
      <div style={{ padding: '8px 24px 16px' }}>
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
    <div style={{ padding: '8px 24px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="eyebrow">Utolsó {sessions.length} session</span>
        {avgJumps != null && <span className="eyebrow text-tertiary">avg {avgJumps} ugrás</span>}
      </div>
      <div className="col gap-sm">
        {sessions.map((s) => (
          <SportSessionCard key={s.id} session={s} />
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
    <div style={{ padding: '8px 24px 16px' }}>
      <div
        className="card"
        style={{ padding: 'var(--sp-4)', background: 'var(--wash-sport)', marginBottom: 14 }}
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

      <div className="col gap-sm" style={{ marginBottom: 12 }}>
        {crossLoad.map((c, i) => (
          <CrossLoadRow key={`${c.system}-${i}`} item={c} />
        ))}
      </div>

      {/* Tool transparency */}
      <ToolChipRow tools={CROSSLOAD_TOOLS} />
    </div>
  )
}
