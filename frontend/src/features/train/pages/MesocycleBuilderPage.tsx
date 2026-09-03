// ============================================================
// Mezo · MesocycleBuilderPage — the ACTIVE RUN's own page (route
// /train/mesocycles/:id, full-screen sibling, no Train sub-nav).
// Mesocycle pages v2 (mezo-d20.15): status-FIRST, editing one level down.
// Source of truth is the prototype's #page-run (meso-body.html, px ×1.18):
//   hero (name + „Aktív · 3/6 hét · Rámpa · vége …")
//   „A blokk íve" card — week dots + the phase chip + the W1…deload line
//   Mezo's one decider sentence (why the volume moved), when there is one
//   two tiles — „Heti vizsgálat" (mini bar cluster → the week page) and
//     „Hétfőn jön" (what the rollover will do; NON-navigating, it is a forecast)
//   „A heted" day mosaic — one DayTile per training day → the day's own page
//   „Meso lezárása" (MesoCloseSheet)
// The three-view switcher (Áttekintés | Volumen | Gyakorlatok) is gone: Volumen
// lives on its own routes (MesoWeekPage → MesoMusclePage — MesoOverviewPage itself
// was retired and now redirects), and Gyakorlatok is now per-day (MesoDayPage) —
// a run page that opens on a form was the thing v2 set out to fix.
// A PLANNED run keeps its „Aktiválás" CTA; an ARCHIVED one has no builder at all
// and redirects to its frozen report (mezo-meyc.2).
// ============================================================
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import type { Mesocycle } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { MozaikPage, Mosaic, PageBody, PageHead, PageHero, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { huMonthDay } from '@/shared/lib/dates'
import { deciderSentence, nextRolloverChips, phaseChip, runBands, weekDotClass, weekDots } from '@/features/train/logic/mesoBands'
import { todayDayToken } from '@/features/train/logic/mesoDates'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { isOffDay } from '@/features/train/logic/offDay'
import { SESSION_MUSCLE_CAP } from '@/features/train/logic/setBudget'
import { DayTile } from '@/features/train/wizard/DayTile'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** The mini bar cluster's denominator — THIS block's own highest ceiling, so the bars stay
 *  comparable inside the tile whatever the plan's landmarks are (a fixed 22 flattened every
 *  bar of a block whose loudest muscle tops out at 12). */
function barCeiling(bands: { ceiling: number }[]): number {
  return Math.max(...bands.map((b) => b.ceiling), 1)
}

/** Mock fixtures carry HU display dates ('Jún 12'), the API ISO ones ('2026-06-12'). */
function huDate(value: string | undefined): string | null {
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? huMonthDay(value) : value
}

/** „W1 · W2 · **W3 · most** · W4 · W5 csúcs · deload" — the arc in one line. */
function arcLine(meso: Mesocycle) {
  return weekDots(meso).map((d) => {
    const label = d.deload ? 'deload' : meso.phaseCurve[d.week - 1] === 'MRV' ? `W${d.week} csúcs` : `W${d.week}`
    return { key: d.week, label: d.state === 'now' ? `${label} · most` : label, now: d.state === 'now' }
  })
}

export function MesocycleBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mesocycles, activateMesocycle, mesoMutationPending } = useTrain()
  const [closing, setClosing] = useState(false)

  const meso = mesocycles.find((m) => m.id === id)
  const backToLibrary = () => navigate('/train/mesocycles')

  // A closed run has no builder — its plan is history, and the thing worth opening is the
  // frozen report (mezo-meyc.2). Deep links / back-nav land here too, so redirect rather
  // than render a read-only builder nobody can act on.
  if (meso?.status === 'archived') {
    return <Navigate to={`/train/mesocycles/${meso.id}/report`} replace />
  }

  if (!meso) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={backToLibrary} label="‹ Mezociklus" />
        <PageBody>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Ez a mesociklus nem található.
          </p>
          <div className="mt-lg">
            <CtaGhost onClick={backToLibrary}>← Mezociklusok</CtaGhost>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }

  const active = meso.status === 'active'
  const phase = phaseChip(meso)
  const endsOn = huDate(meso.endDate)
  const startsOn = huDate(meso.startDate)
  const sub = active
    ? [`Aktív · ${meso.currentWeek}/${meso.weeks} hét`, phase, endsOn && `vége ${endsOn}`].filter(Boolean).join(' · ')
    : [`Tervezett · ${meso.weeks} hét`, startsOn && `indul ${startsOn}`].filter(Boolean).join(' · ')

  const bands = active ? runBands(meso) : []
  const totalSets = bands.reduce((a, b) => a + b.current, 0)
  const ramping = bands.filter((b) => b.step === 'up').length
  const holding = bands.length - ramping
  const decider = active ? deciderSentence(meso) : null
  const rollover = active ? nextRolloverChips(meso) : []

  // Training days only — Rest and the sport/off days carry no plan to edit.
  const trainingDays = (meso.days ?? []).filter((d) => d.type !== 'Rest' && !isOffDay(d))
  // `now` is the only honest status here: `useTrain()` exposes this week's COMPLETED
  // instances for TODAY alone (completedTodayWorkout), never a per-day list — so a
  // „✓ kész" on Monday's tile would be invented. It lands when the data does.
  const today = todayDayToken()

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={backToLibrary} label="‹ Mezociklus" />
      <EntranceGroup>
        <PageHero icon="i-meso" name={meso.title} sub={sub} />
        <PageBody>
          {active && (
            <div className="mz-card rise" style={{ ...delay(30), padding: '10px 12px' }}>
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="mz-eyebrow mz-grow">A blokk íve</span>
                <span className="mz-phchip">{phase}</span>
              </div>
              <div className="mz-wdots">
                {weekDots(meso).map((d) => (
                  <i key={d.week} className={weekDotClass(d)} />
                ))}
              </div>
              <div className="mz-arcline">
                {arcLine(meso).map((w, i) => (
                  <span key={w.key}>
                    {i > 0 && ' · '}
                    {w.now ? <b>{w.label}</b> : w.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {decider && (
            <div className="mz-coach rise" style={delay(60)}>
              <span className="dot" aria-hidden="true" />
              <span>{decider}</span>
            </div>
          )}

          {active && (
            <div style={{ marginTop: 11 }}>
              <Mosaic>
                <Tile
                  wash="coral"
                  eyebrow="Heti vizsgálat"
                  delayMs={90}
                  onClick={() => navigate(`/train/mesocycles/${meso.id}/week`)}
                >
                  <span className="mz-wmini" aria-hidden="true">
                    {bands.slice(0, 5).map((b, i) => (
                      <b
                        key={b.group}
                        style={{
                          ...delay(300 + i * 60),
                          height: `${Math.max(15, Math.round((b.current / barCeiling(bands)) * 100))}%`,
                          background: muscleColor(b.group).deep,
                        }}
                      />
                    ))}
                  </span>
                  <span className="mz-tile-line">
                    {`${totalSets} szett · ${ramping} rámpázik · ${holding} tart`}
                  </span>
                </Tile>
                {/* A FORECAST, not a destination — the rollover runs on its own, so this
                    tile deliberately has no onClick (prototype: cursor:default). */}
                <Tile wash="sage" eyebrow="Hétfőn jön" delayMs={120}>
                  <span className="mz-rollchips">
                    {/* Five muscles, then a „+N" — the tile is a forecast at a glance, and a
                        10-muscle block wrapped it into an unreadable chip wall. */}
                    {rollover.slice(0, 5).map((c) => (
                      <span key={c.label} className={c.tone === 'sage' ? 'mz-mband up' : 'mz-mband'}>{c.text}</span>
                    ))}
                    {rollover.length > 5 && <span className="mz-mband">{`+${rollover.length - 5}`}</span>}
                  </span>
                  <span className="mz-tile-note">a heti görgetés hajnalban fut</span>
                </Tile>
              </Mosaic>
            </div>
          )}

          {trainingDays.length > 0 && (
            <>
              <div className="mz-eyebrow rise" style={{ ...delay(120), padding: '11px 2px 6px' }}>
                A heted · koppints egy napra a szerkesztéshez
              </div>
              <Mosaic>
                {trainingDays.map((d, i) => {
                  const tile = dayTileData(d)
                  return (
                    <div className="rise" key={d.day} style={delay(150 + i * 50)}>
                      <DayTile
                        day={d.day}
                        type={d.type}
                        sets={tile.sets}
                        minutes={tile.minutes}
                        muscles={tile.muscles}
                        tone={tile.tone}
                        cap={SESSION_MUSCLE_CAP}
                        status={active && d.day === today ? 'now' : null}
                        onOpen={() => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(d.day)}`)}
                      />
                    </div>
                  )
                })}
              </Mosaic>
            </>
          )}

          <div className="mz-wfoot rise" style={delay(230)}>
            {active && (
              // Closing freezes a report — MesoCloseSheet owns the confirm + the optional
              // self-eval note and lands on the report (mezo-meyc.2).
              <CtaGhost
                style={{ color: 'var(--mz-cell-coral-ink)' }}
                onClick={() => setClosing(true)}
                disabled={mesoMutationPending}
              >
                Meso lezárása
              </CtaGhost>
            )}
            {meso.status === 'planned' && (
              <CtaPrimary onClick={() => activateMesocycle(meso.id)} disabled={mesoMutationPending}>
                <Icon name="check" size={16} /> Aktiválás · {startsOn ?? meso.startDate}
              </CtaPrimary>
            )}
          </div>
        </PageBody>
      </EntranceGroup>

      {closing && (
        <MesoCloseSheet mesoId={meso.id} title={meso.title} onClose={() => setClosing(false)} />
      )}
    </MozaikPage>
  )
}
