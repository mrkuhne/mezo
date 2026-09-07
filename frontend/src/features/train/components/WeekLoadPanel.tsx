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
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useState } from 'react'

const ARROW = { up: '▲', down: '▼', hold: '=' } as const

interface WeekLoadPanelProps {
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  onBack: () => void
}

export function WeekLoadPanel({ days, priorities, volumePerMuscle, onBack }: WeekLoadPanelProps) {
  const rows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  const conflicts = adjacentDayConflicts(days)
  const [open, setOpen] = useState<string | null>(null)

  const total = rows.reduce((a, r) => a + r.sets, 0)
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
                    <span className="mz-tchip">{TIER_LABELS[r.tier]}</span>
                    <span className="mz-grow" />
                    <span className="mz-lcard-freq">{r.frequency} nap / hét</span>
                  </span>
                  <span className="mz-lcard-head" style={{ marginTop: 2 }}>
                    <span className="mz-lcard-num" style={{ color: fam.deep }}>
                      <b>{r.sets}</b> <i aria-hidden="true">{ARROW[r.direction]}</i> <b>{r.target}</b>
                      <small>cél</small>
                    </span>
                    <span className="mz-grow" />
                    <span className="mz-lcard-stat" style={{ color: r.direction === 'hold' ? 'var(--sage-deep)' : 'var(--amber-deep)' }}>
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
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
