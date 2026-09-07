// ============================================================
// Mezo · WeekLoadPanel — a Heti terhelés SAJÁT OLDALA (mezo-yty6). Izmonként egy
// poszter-kártya: tier-chip + frekvencia, `most ▲ cél` számsor, ZoneBar a
// MEV/MAV/MRV zónákkal, és koppintásra a napokra bontott hozzájárulás — a
// „miért piros?" helyett „mit változtass?" (Liftosaur-minta, spec Prior art).
// Alul az egymást követő napok izom-átfedése: passzív tanács, sosem blokkol.
// ============================================================
import type { MesoDay, MusclePriorities } from '@/data/types'
import { ZoneBar } from '@/features/train/components/ZoneBar'
import { adjacentDayConflicts, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { TIER_LABELS } from '@/features/train/logic/musclePriorities'
import { peakWeekFit } from '@/features/train/logic/peakWeekFit'
import { structureLint } from '@/features/train/logic/structureLint'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useState } from 'react'

const ARROW = { up: '▲', down: '▼', hold: '=' } as const

// The direction cue's THREE colours (prototype `.arr.up/.dn/.eq`). Semantics — the whole
// point of this redesign was to delete the unexplained amber signal, so amber is reserved
// for the one case that actually asks for a change (mezo-yty6 final review, C2):
//  • `up`   — still ramping toward the tier target. In week 1 EVERY grow/emphasize group is
//             below its target by design, so this is the normal, healthy state: sage.
//  • `down` — above the target: the only "consider trimming" case, so amber.
//  • `hold` — on target: neutral/positive, sage as well.
const DIRECTION_CLASS = { up: 'mz-arr-up', down: 'mz-arr-dn', hold: 'mz-arr-eq' } as const

/** Percent is never rendered as text in this redesign's volume UI (spec §2). */
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
  // page's lint sources; it was wired nowhere in the new editor path (mezo-yty6 final
  // review, I4). Soft observations only — same passive visual language as the rows above.
  //
  // This redesign's volume UI never renders percent as text (spec §2 — "a % szám nem mond
  // semmit, a szett igen"), but a couple of structureLint strings quote one: 'rep-zone'
  // states a share in its HEADLINE (so the whole finding stays behind here — it still shows
  // on the legacy StructureLintCard), and 'frequency' cites "~30%" only in its explanatory
  // detail (so the headline renders and the detail is dropped). Filtering on the TEXT rather
  // than on rule ids keeps this honest if the copy moves.
  const structure = structureLint(days, priorities ?? null)
    .filter((f) => !PERCENT.test(f.label))
    .map((f) => ({ ...f, detail: PERCENT.test(f.detail) ? null : f.detail }))
  const [open, setOpen] = useState<string | null>(null)

  // Raw working-set total, exactly like the tile that opened this page and like each day
  // tile — the headline the user reads must be the same quantity everywhere (mezo-yty6 final
  // review, I3). Summing `rows` would drop exempt work (plyo) and landmark-less groups
  // (traps/core); the per-muscle cards below stay that filtered view on purpose.
  const total = days.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const peak = rows.reduce((a, r) => a + Math.max(r.sets, r.target), 0)
  const moving = rows.filter((r) => r.direction !== 'hold').length

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={onBack} label="‹ A blokkod" />
      <EntranceGroup>
        <PageHero
          icon="i-meso"
          big={total}
          name="Heti terhelés · izmonként"
          sub={`szett · 1. hét · ${days.filter((d) => d.exercises.length > 0).length} edzésnap`}
        />
        <PageBody principle="Emphasize→MRV · Grow→MAV · Maintain→MEV. A sáv mutatja, hol állsz a zónákban — a jelzés borostyán, és sosem blokkol.">
          <div className="rise" style={{ marginBottom: 11 }}>
            <StatStrip>
              <StatCell value={total} label="szett · W1" />
              <StatCell value={peak} label="szett · csúcs" />
              <StatCell value={moving} label="mozog" />
              <StatCell value={rows.length - moving} label="célon" />
            </StatStrip>
          </div>
          <div className="mz-eyebrow rise" style={{ padding: '0 2px 6px' }}>
            Csökkenő sorrendben · a nyíl a tier-cél felé · koppints a lebontásért
          </div>

          {rows.map((r, i) => {
            const fam = muscleColor(r.colorMuscle)
            const expanded = open === r.group
            return (
              <div
                key={r.group}
                data-testid="week-load-card"
                data-group={r.group}
                className={`mz-lcard rise${expanded ? ' open' : ''}`}
                style={{ background: fam.wash, ['--d' as string]: `${90 + i * 70}ms` }}
              >
                <button
                  type="button"
                  className="mz-lcard-open"
                  aria-expanded={expanded}
                  aria-label={`${r.label} · lebontás`}
                  onClick={() => setOpen((cur) => (cur === r.group ? null : r.group))}
                >
                  <span className="mz-lcard-head">
                    <span className="mz-lcard-pill" style={{ background: fam.wash, color: fam.deep }}>{r.label}</span>
                    <span className="mz-lcard-tier">{TIER_LABELS[r.tier]}</span>
                    <span className="mz-grow" />
                    <span className="mz-lcard-freq">{r.frequency} nap / hét</span>
                  </span>
                  <span className="mz-lcard-head" style={{ marginTop: 2 }}>
                    <span className="mz-lcard-num" style={{ color: fam.deep }}>
                      <b>{r.sets}</b>{' '}
                      <i className={DIRECTION_CLASS[r.direction]} aria-hidden="true">{ARROW[r.direction]}</i>{' '}
                      <b>{r.target}</b>
                      <small>cél</small>
                    </span>
                    <span className="mz-grow" />
                    <span className={`mz-lcard-stat ${DIRECTION_CLASS[r.direction]}`}>
                      {r.direction === 'hold'
                        ? 'a célon'
                        : r.direction === 'up'
                          ? `még ${r.toTarget} szett a célig`
                          : `${r.toTarget} szettel a cél fölött`}
                    </span>
                  </span>
                  <ZoneBar landmark={r.landmark} value={r.sets} target={r.target} colorMuscle={r.colorMuscle} label={r.label} />
                </button>
                <div className="mz-lcard-body">
                  {r.contributions.map((c) => (
                    <div className="mz-lcard-cline" key={c.day}>
                      <b>{c.day}</b>
                      <span className="mz-lcard-chips" style={{ marginTop: 0 }}>
                        {c.exercises.map((e) => (
                          <span className="mz-lcard-chip" key={e.exerciseId}>{e.name} +{e.sets}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {conflicts.length > 0 ? conflicts.map((c) => (
            <div className="mz-lint rise" key={`${c.fromDay}-${c.toDay}`}>
              <span aria-hidden="true">⚠️</span>
              <span>
                <b>{c.groups.map((g) => g.label).join(' + ')}</b> egymást követő napokon
                ({c.fromDay} {c.fromType} → {c.toDay} {c.toType}) — pihenőnap ajánlott közéjük.
              </span>
            </div>
          )) : (
            <div className="mz-lint mz-lint-ok rise">
              <span aria-hidden="true">✓</span>
              <span><b>Nincs egymást követő napi átfedés</b> — minden izom kap pihenőt két edzés között.</span>
            </div>
          )}

          {peakFits.length > 0 ? peakFits.map((f) => (
            <div className="mz-lint rise" key={f.day}>
              <span aria-hidden="true">⚠️</span>
              <span>{peakFitLine(f)}</span>
            </div>
          )) : (
            <div className="mz-lint mz-lint-ok rise">
              <span aria-hidden="true">✓</span>
              <span><b>A csúcshét is elfér</b> — az edzésidő minden napon a sávon belül marad.</span>
            </div>
          )}

          {structure.map((f, i) => (
            <div className="mz-lint rise" data-testid="structure-lint" key={`${f.rule}-${f.day ?? ''}-${i}`}>
              <span aria-hidden="true">⚠️</span>
              <span><b>{f.label}</b>{f.detail ? ` ${f.detail}` : ''}</span>
            </div>
          ))}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
