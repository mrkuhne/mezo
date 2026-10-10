// ============================================================
// Mezo · WeekLoadPanel — a Heti terhelés SAJÁT OLDALA (mezo-yty6; Folyadék mezo-n4wf5.3,
// prototype vilagos/edzes.js `weekEd(r, 'het-terh')`). A hero a test két nézete: a világos
// folyadék a fókusz szerinti cél, a mély a mostani heti szettszám (weekMuscleLoad → sets,
// target, landmark.mrv). Alatta izmonként egy sor: fókusz-jelző + gyakoriság, `most ▲ cél`,
// az edény a két vízvonallal, és koppintásra a napokra bontott hozzájárulás — a „miért piros?"
// helyett „mit változtass?". Alul a jelzések: passzív tanács, sosem tilt.
// ============================================================
import { useState } from 'react'
import type { MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { ZoneBar } from '@/features/train/components/ZoneBar'
import { DuoBody, Mchp } from '@/features/train/components/folyadek'
import { adjacentDayConflicts, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { peakWeekFit } from '@/features/train/logic/peakWeekFit'
import { structureLint } from '@/features/train/logic/structureLint'
import { TIER_LABEL } from '@/features/train/logic/tierLabel'
import {
  Box, Card, Facts, FrameBack, Hero, Legend, Note, Page, Row, Section, St, Tags, useFrameTitle,
} from '@/shared/ui/folyadek'
import { clamp } from '@/shared/ui/folyadek/util'

const ARROW = { up: '▲', down: '▼', hold: '=' } as const

// The direction cue (mezo-yty6 final review, C2): amber is reserved for the one case that
// actually asks for a change.
//  • `up`   — still ramping toward the tier target. In week 1 EVERY grow/emphasize group is
//             below its target by design, so this is the normal, healthy state: plain ink.
//  • `down` — above the target: the only "consider trimming" case, so amber.
//  • `hold` — on target: plain ink as well.
const DIRECTION_CLASS = { up: 'ew-dir-up', down: 'ew-dir-dn', hold: 'ew-dir-eq' } as const

/** The tone of a focus tier's pill (prototype `TLK`); the words come from the shared `TIER_LABEL`. */
const TIER_TONE: Record<MuscleTier, 'ok' | 'plan' | 'q'> = { emphasize: 'ok', grow: 'plan', maintain: 'q' }

/** Percent is never rendered as text in this volume UI (spec §2). */
const PERCENT = /%/

/** Mirrors PeakFitCard's established copy for a peakWeekFit finding (mezo-yty6 fix round 1). */
function peakFitLine(f: { day: string; minutes: number; direction: 'over' | 'under' }): string {
  return f.direction === 'over'
    ? `${f.day}: csúcshéten ~${f.minutes} perc — vegyél el, vagy tedd át.`
    : `${f.day}: csúcshéten is csak ~${f.minutes} perc — férne még bele inger.`
}

interface WeekLoadPanelProps {
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  onBack: () => void
}

export function WeekLoadPanel({ days, priorities, volumePerMuscle, onBack }: WeekLoadPanelProps) {
  const rows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  const conflicts = adjacentDayConflicts(days)
  const peakFits = peakWeekFit(days, priorities ?? null, volumePerMuscle ?? null)
  // Spec §3 names structureLint alongside the adjacency check and peakWeekFit as this
  // page's lint sources (mezo-yty6 final review, I4). Soft observations only.
  //
  // This volume UI never renders percent as text (spec §2 — "a % szám nem mond semmit, a
  // szett igen"), but a couple of structureLint strings quote one: 'rep-zone' states a share
  // in its HEADLINE (so the whole finding stays behind here), and 'frequency' cites "~30%"
  // only in its explanatory detail (so the headline renders and the detail is dropped).
  // Filtering on the TEXT rather than on rule ids keeps this honest if the copy moves.
  const structure = structureLint(days, priorities ?? null)
    .filter((f) => !PERCENT.test(f.label))
    .map((f) => ({ ...f, detail: PERCENT.test(f.detail) ? null : f.detail }))
  const [open, setOpen] = useState<string | null>(null)

  // Raw working-set total, exactly like the row that opened this page and like each day row —
  // the headline the user reads must be the same quantity everywhere (mezo-yty6 final review,
  // I3). Summing `rows` would drop exempt work (plyo) and landmark-less groups (traps/core);
  // the per-muscle rows below stay that filtered view on purpose.
  const total = days.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const peak = rows.reduce((a, r) => a + Math.max(r.sets, r.target), 0)
  const moving = rows.filter((r) => r.direction !== 'hold').length
  const trainingDays = days.filter((d) => d.exercises.length > 0).length

  useFrameTitle({ title: 'Heti terhelés', eyebrow: 'Izmonként' })

  return (
    <Page className="ew-page">
      <FrameBack className="ew-back" onBack={onBack}>‹ A heted</FrameBack>
      <Hero
        className="ew-hero"
        label="Heti terhelés · izmonként"
        verdict={`${total} szett az 1. héten, a csúcson ${peak}.`}
        sub={`${trainingDays} edzésnap · ${moving} izom még a célja felé tart, ${rows.length - moving} a célon van.`}
      >
        <DuoBody
          size="md"
          entries={rows.map((r) => ({
            muscle: r.colorMuscle,
            done: clamp(r.sets / r.landmark.mrv, 0.12, 1),
            planned: clamp(r.target / r.landmark.mrv, 0.12, 1),
          }))}
        />
        <Facts items={[[total, 'szett · 1. hét'], [peak, 'szett · csúcs'], [moving, 'mozog'], [rows.length - moving, 'célon']]} />
      </Hero>

      <Section n={1} title="Csökkenő sorrendben · koppints a lebontásért" />
      <Card>
        <Legend
          className="ew-lg"
          items={[
            { label: 'ennyitől fejlődik', kind: 'line' },
            { label: 'a cél a fókusz szerint', kind: 'dash' },
            { label: 'az edény széle: legfeljebb', kind: 'vessel' },
          ]}
        />
        {rows.map((r) => {
          const expanded = open === r.group
          const dir = DIRECTION_CLASS[r.direction]
          return (
            <div
              key={r.group}
              data-testid="week-load-card"
              data-group={r.group}
              className={`ew-log${expanded ? ' open' : ''}`}
            >
              <Row
                left={<Mchp muscle={r.colorMuscle} sm />}
                title={<>{r.label}<St tone={TIER_TONE[r.tier]}>{TIER_LABEL[r.tier]}</St></>}
                sub={(
                  <>
                    <span>{r.frequency} nap / hét</span>{' · '}
                    <span className={dir}>
                      {r.direction === 'hold'
                        ? 'a célon'
                        : r.direction === 'up'
                          ? `még ${r.toTarget} szett a célig`
                          : `${r.toTarget} szettel a cél fölött`}
                    </span>
                  </>
                )}
                more={<ZoneBar landmark={r.landmark} value={r.sets} target={r.target} colorMuscle={r.colorMuscle} label={r.label} />}
                value={(
                  <>
                    <b>{r.sets}</b>{' '}
                    <i className={dir} aria-hidden="true">{ARROW[r.direction]}</i>{' '}
                    <b>{r.target}</b>
                    <small>cél</small>
                  </>
                )}
                right={false}
                aria-expanded={expanded}
                aria-label={`${r.label} · lebontás`}
                onClick={() => setOpen((cur) => (cur === r.group ? null : r.group))}
              />
              {expanded && (
                <div className="ew-sjp">
                  {r.contributions.map((c) => (
                    <div className="ew-sjl" key={c.day}>
                      <b>{c.day}</b>
                      <Tags items={c.exercises.map((e) => `${e.name} +${e.sets}`)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <Note>
          A hangsúlyos izom a legfelső értékig megy, az épülő a középsőig, a tartott az alsón marad. A jelzés sosem tilt.
        </Note>
      </Card>

      <Section n={2} title="Jelzések" />
      <Card>
        {conflicts.length > 0 ? conflicts.map((c) => (
          <div className="ew-alert" data-testid="week-conflict" key={`${c.fromDay}-${c.toDay}`}>
            <Box icon="t-info" color="var(--fo-warn)" title={`${c.groups.map((g) => g.label).join(' + ')} egymást követő napokon`}>
              <p>({c.fromDay} {c.fromType} → {c.toDay} {c.toType}) — pihenőnap ajánlott közéjük.</p>
            </Box>
          </div>
        )) : (
          <div className="ew-alert">
            <Box icon="t-tick" color="var(--fo-ok)" title="Nincs egymást követő napi átfedés">
              <p>Minden izom kap pihenőt két edzés között.</p>
            </Box>
          </div>
        )}

        {peakFits.length > 0 ? peakFits.map((f) => (
          <div className="ew-alert" key={f.day}>
            <Box icon="t-info" color="var(--fo-warn)" title={peakFitLine(f)} />
          </div>
        )) : (
          <div className="ew-alert">
            <Box icon="t-tick" color="var(--fo-ok)" title="A csúcshét is elfér">
              <p>Az edzésidő minden napon a sávon belül marad.</p>
            </Box>
          </div>
        )}

        {structure.map((f, i) => (
          <div className="ew-alert" data-testid="structure-lint" key={`${f.rule}-${f.day ?? ''}-${i}`}>
            <Box icon="t-info" color="var(--fo-warn)" title={f.label}>
              {f.detail ? <p>{f.detail}</p> : null}
            </Box>
          </div>
        ))}
      </Card>
    </Page>
  )
}
