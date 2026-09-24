// ============================================================
// Mezo · SportPage (Sport) — Mozaik 2.0 re-face (mezo-d20.11), üveg re-dress
// (mezo-me75u.4, prototype docs/design_2.0/prototypes/src/uveg-edzes-body.html
// `sport()`): glass back pill + a lit rose `＋ Log` pill → the frameless rose halo
// hero (t-volley, the logged/scheduled numeral) → three flat stat cells → the flat
// segmented control (active segment filled rose) → the segment.
//
// Ranking (bible §3.4): Heti terv day rows with a slot = rose `.glass`, free days
// dashed; the independence note, the one-off events and the stat cells flat; Napló
// = one rose glass card per session; Cross-load = ONE lavender glass card with flat
// impact rows inside. Empty states dashed (`.uv-empty`), never glass.
//
// Dropped from the prototype's 4-cell strip: the `+XP e héten` cell. The
// prototype fakes it as `logged × 30`; no weekly sport-XP aggregate is on the
// wire, and XP is feedback, never invented. Three honest cells ship instead.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useTrain } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { SportSchedule, SportSession, CrossLoadRow as CrossLoadRowData } from '@/data/types'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody, StatCell } from '@/shared/ui/mozaik'
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
import { SportEventSheet } from '@/features/train/sheets/SportEventSheet'
import SportSkeleton from '@/features/train/pages/SportSkeleton'
import { sportOf, SPORT_TAGS, SPORT_TONE, type SportKind } from '@/features/train/logic/sportKinds'

const ROSE = { '--c': 'var(--dv-rose)' } as CSSProperties

/** The dashed empty state (bible §3 rank 4): no glass, no glow — art, one line, an optional CTA. */
function UvEmpty({ art, message, ctaLabel, onCta, c = 'var(--dv-rose)' }: {
  art: Icon3DName
  message: string
  ctaLabel?: string
  onCta?: () => void
  c?: string
}) {
  return (
    <div className="uvs-ghost uv-empty rise" style={{ '--c': c } as CSSProperties}>
      <Icon3D name={art} size={56} />
      <p className="uv-voice">{message}</p>
      {ctaLabel && onCta && (
        <button type="button" className="uvs-pill" onClick={onCta}>{ctaLabel}</button>
      )}
    </div>
  )
}

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
  const { sport, sportEvents, logSportSession, addSportEvent, deleteSportEvent, sportPending } =
    useTrain()
  const { showLevelUp } = useLevelUp()
  // Sticky so returning here restores the segment the user left from — see useStickyTab.
  const [view, setView] = useStickyTab<SportSubView>('train.sport.view', 'week')
  const [logOpen, setLogOpen] = useState(false)
  const [logInitialSport, setLogInitialSport] = useState<SportKind | undefined>(undefined)
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

  // Hero big number = logged this week / scheduled slots (prototype `4/5`).
  // With no schedule there is nothing to be "out of" — the number renders `—`
  // rather than inventing a denominator.
  const slotCount = volleyball?.sessions.length ?? 0
  const bigNum = volleyball
    ? <>{week?.sessions ?? 0}<small>/{slotCount}</small></>
    : '—'
  const loggedThisWeek = week != null && week.sessions > 0

  // The prototype's per-segment principle lines (`habnote`), verbatim.
  const principle =
    view === 'week'
      ? 'A heti ritmus független a mezociklustól — új blokk indításakor a sport cross-load automatikusan beépül a volumen-tervbe.'
      : view === 'crossload'
        ? 'A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.'
        : undefined

  return (
    <MozaikPage tone="rose" className="uvs-page uvs-sport">
      <PageHead glass onBack={() => navigate('/train')} label="Edzés">
        {/* The header's own log CTA opens the full-screen sport flow (mezo-88iwa.9, T8
            Task 4) — pick the sport, then only the fields that sport actually asks. The
            inline "Logold ›" on a SCHEDULED slot still opens the sheet below: it carries
            the slot's own preselected sport, which the new flow does not take yet. */}
        <button type="button" onClick={() => navigate('/train/sport/log')} className="mz-pgact uvs-act" style={ROSE}>
          ＋ Log
        </button>
      </PageHead>
      {/* One-shot entrance choreography; the segment switch re-arms it so the
          swapped view stages in rather than snapping (replayKey = the view). */}
      <EntranceGroup replayKey={view}>
        <PageHero
          art="t-volley"
          accent="var(--dv-rose)"
          name="Sport"
          big={bigNum}
          sub={volleyball ? 'session a héten' : undefined}
        />
        <PageBody principle={principle}>
          {/* Stat strip — three honest flat cells (the prototype's 4th, `+XP e héten`,
              has no wire source; see the module note). A null statistic renders
              `—`, never a fabricated 0. */}
          <div className="mz-statstrip uvs-strip rise" style={{ '--d': '30ms' } as CSSProperties}>
            <StatCell value={week ? `${d1(week.hoursPlayed)} ó` : '—'} label="pályán e héten" />
            <StatCell value={loggedThisWeek ? d1(week.avgRPE) : '—'} label="RPE átlag · 1–10" />
            <StatCell value={loggedThisWeek ? d1(week.avgShoulderStrain) : '—'} label="váll-terhelés" />
          </div>

          {/* View switcher — the flat segmented control; the active segment is filled
              in the page accent with a glow (üveg U4). */}
          <div className="segtabs uvs-seg rise" data-kalauz-anchor="sport-tabs" style={{ '--d': '60ms', ...ROSE } as CSSProperties}>
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
                  loggedTodayKinds={sport.sessions
                    .filter((s) => s.isoDate === localDateString())
                    .map((s) => s.sport)}
                  onLogSlot={openLog}
                />
              ) : (
                <UvEmpty
                  art="t-calendar"
                  message="A heti rended itt jelenik majd meg."
                  ctaLabel="+ Állítsd be a heti rended"
                  onCta={() => navigate('/settings/train/sport')}
                />
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
              <UvEmpty art="t-chain" c="var(--dv-lav)" message="A cross-load elemzés itt jelenik majd meg." />
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
      {eventOpen && (
        <SportEventSheet
          onClose={() => setEventOpen(false)}
          onSave={(req, done) => addSportEvent(req, { onSettled: done })}
        />
      )}
    </MozaikPage>
  )
}

// === Week view: 7-day schedule — a day with a slot is a rose glass row, a free day dashed ===
function SportWeekView({ schedule, loggedTodayKinds = [], onEdit, onLogSlot }: {
  schedule: SportSchedule['volleyball']
  /** Sports already logged TODAY (mezo-i6q2b) — today's slot of such a sport swaps its
   *  „Logold ›" for a done chip. Matched by day AND sport, like the Mai hero. */
  loggedTodayKinds?: string[]
  onEdit?: () => void
  /** Inline "Logold ›" on today's slot — preselects that slot's sport in the log sheet. */
  onLogSlot?: (initial: SportKind) => void
}) {
  return (
    <div className="uvs-sec">
      <div className="uvs-sechead rise" style={{ '--d': '30ms' } as CSSProperties}>
        <span className="uv-eyebrow">Heti ritmus · {schedule.weeklyHours} ó</span>
        {onEdit && (
          <button type="button" className="uvs-flatbtn" onClick={onEdit}>
            Szerkesztés
          </button>
        )}
      </div>
      {/* Every day of the week renders — a day with no slot is the prototype's
          dashed „nincs session" row, not an omission. */}
      <div className="uvs-list">
        {DAY_ORDER.map((d, di) => {
          const daySlots = schedule.sessions.filter((s) => s.day === d)
          const isToday = daySlots.some((s) => s.today)
          return (
            <div
              key={d}
              className={[
                'spw-day rise',
                daySlots.length ? 'has glass' : 'empty uv-empty',
                isToday ? 'today' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--d': `${50 + di * 40}ms`, '--i': di, ...ROSE } as CSSProperties}
            >
              <span className="spw-dlbl">{d}</span>
              {daySlots.length ? (
                <div className="spw-slots">
                  {daySlots.map((session, i) => {
                    const kind = sportOf(session)
                    return (
                      <div key={`${session.time}-${i}`} className="spw-slot">
                        <div className="spw-main">
                          <div className="spw-l1">
                            {/* The type tag rides EVERY slot, RÖPI included — it is how a
                                row says which sport it is. */}
                            <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
                            <b>{session.time}</b>
                            <span className="dur">· {session.duration}p</span>
                            {session.today && <span className="spw-ma">MA</span>}
                            {session.oneOff && <span className="spw-one">EGYSZERI</span>}
                          </div>
                          {[session.court, session.role, session.intensity].filter(Boolean).length > 0 && (
                            <div className="spw-l2">
                              {[session.court, session.role, session.intensity].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        {session.today && loggedTodayKinds.includes(kind) ? (
                          // mezo-i6q2b: today's slot once logged — a sage done chip, no CTA.
                          <span className="spw-done"><Icon3D name="t-tick" size={16} />Kész</span>
                        ) : session.today && onLogSlot && (
                          <button
                            type="button"
                            className="spw-logbtn"
                            onClick={() => onLogSlot(kind)}
                          >
                            Logold ›
                          </button>
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

      {/* The independence note — secondary copy, so a flat cell (not glass). */}
      <div className="uvs-note uv-flat rise" style={{ '--d': '340ms' } as CSSProperties}>
        <Icon3D name="t-repeat" size={30} />
        <div>
          <span className="uv-eyebrow">Heti ritmus · független</span>
          <p>
            A röplabda recurring · független a gym mesociklustól. Új meso indításakor a Mezo automatikusan beleépíti a
            volleyball cross-load-ot a volumen-tervbe.
          </p>
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
    <div className="uvs-sec">
      {upcoming.length > 0 && (
        <>
          <div className="uvs-sechead rise" style={{ '--d': '340ms' } as CSSProperties}>
            <span className="uv-eyebrow">Egyszeri események</span>
          </div>
          <div className="uvs-evl">
            {upcoming.map((e) => {
              // The event's sport is CHECK-constrained server-side; sportOf normalizes it
              // through the same guard every other surface uses.
              const kind = sportOf({ sport: e.sport as SportKind })
              return (
                <div key={e.id} className="uvs-ev uv-flat rise" style={{ '--d': '370ms' } as CSSProperties}>
                  <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
                  <div className="uvs-ev-copy">
                    <strong>{huMonthDayDow(e.date)} · {e.time}</strong>
                    <small>
                      {[`${e.durationMin}p`, e.kind === 'match' ? 'meccs' : 'edzés', e.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="uvs-evdel"
                    aria-label={`${huMonthDayDow(e.date)} esemény törlése`}
                    onClick={() => onDelete(e.id)}
                  >
                    törlés
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
      {/* The dashed "add one more" CTA (free space, bible §3 rank 4). */}
      <button
        type="button"
        className="uvs-dashadd uv-empty rise"
        onClick={onAdd}
        style={{ '--d': '400ms', ...ROSE } as CSSProperties}
      >
        ＋ Egyszeri esemény
      </button>
    </div>
  )
}

// === Session log ===
function SportLogView({ sessions }: { sessions: SportSession[] }) {
  if (sessions.length === 0) {
    return <UvEmpty art="t-journal" message="Még nincs logolt session." />
  }
  // Jump counts are not captured by the T3 log sheet — average only the sessions
  // that carry one, and hide the chip entirely when none do.
  const withJumps = sessions.filter((s) => s.jumpCount != null)
  const avgJumps = withJumps.length
    ? Math.round(withJumps.reduce((acc, s) => acc + (s.jumpCount ?? 0), 0) / withJumps.length)
    : null
  return (
    <div className="uvs-sec">
      <div className="uvs-sechead rise" style={{ '--d': '60ms' } as CSSProperties}>
        <span className="uv-eyebrow">Utolsó {sessions.length} session</span>
        {avgJumps != null && <span className="uv-eyebrow">avg {avgJumps} ugrás</span>}
      </div>
      <div className="uvs-list">
        {sessions.map((s, i) => (
          <div key={s.id} className="rise" style={{ '--d': `${90 + i * 45}ms`, '--i': i } as CSSProperties}>
            <SportSessionCard session={s} />
          </div>
        ))}
      </div>
    </div>
  )
}

// === Cross-load view: ONE lavender glass card; intro, tool chips and the impact rows flat inside ===
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
    <div className="uvs-sec">
      <article className="uvs-xl glass rise" style={{ '--d': '30ms', '--c': 'var(--dv-lav)' } as CSSProperties}>
        <div className="uvs-chead">
          <Icon3D name="t-chain" size={40} />
          <div>
            <span className="uv-eyebrow">Mezo · keresztrendszer hatások</span>
            <p className="uvs-xl-intro"><SafeMarkdown text={CROSSLOAD_INTRO} /></p>
          </div>
        </div>
        {/* Tool transparency — the prototype puts the tool chips ABOVE the rows. */}
        <div className="uvs-xl-tools">
          <ToolChipRow tools={CROSSLOAD_TOOLS} />
        </div>
        <div className="uvs-xl-lines">
          {crossLoad.map((c, i) => (
            <CrossLoadRow key={`${c.system}-${i}`} item={c} />
          ))}
        </div>
      </article>
    </div>
  )
}
