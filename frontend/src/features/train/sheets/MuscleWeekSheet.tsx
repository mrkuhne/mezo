// ============================================================
// Mezo · MuscleWeekSheet — weekly per-muscle load detail for the GymPage
// meta card (mezo-ly27, spec 2026-07-24-muscle-week-sheet-design.md).
// ① per-muscle sets/reps/exercises/stimulus (muscleWeek), ② planned
// sport+run events → muscle load (sportMuscleLoad heuristic), ③ Growth
// athletic-skill XP forecast (growthForecast, "~ becslés"). The sheet owns
// the lazy queries (useRunning/useProgressionProfile) so GymPage's mount
// stays cheap; meso + sport slots arrive as props from useTrain data the
// page already holds.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { useProgressionProfile, useRunning } from '@/data/hooks'
import type { Mesocycle, VolleyballSession } from '@/data/types'
import { DAY_LABELS, MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor, regionColor } from '@/features/train/logic/muscleColors'
import { muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { growthForecast } from '@/features/train/logic/growthForecast'
import { ATHLETIC_META } from '@/features/progression/logic/levelUpMeta'

interface MuscleWeekSheetProps {
  meso: Mesocycle
  /** The weekly sport schedule slots ([] when no schedule). */
  sportSlots: VolleyballSession[]
  onClose: () => void
}

const tri = (n: number) => '▲'.repeat(n)

function SectionHead({ color, title, sub }: { color: string; title: string; sub: string }) {
  return (
    <div style={{ margin: '26px 0 12px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span style={{ width: 14, height: 3, borderRadius: 2, background: color }} />
        {/* textTransform keeps the DOM text mixed-case (testable) while rendering uppercase. */}
        <span className="label-mono" style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', margin: '4px 0 0 21px' }}>{sub}</div>
    </div>
  )
}

export function MuscleWeekSheet({ meso, sportSlots, onClose }: MuscleWeekSheetProps) {
  const { activeRunningBlock } = useRunning()
  const { data: profile } = useProgressionProfile()

  const days = meso.days ?? []
  const runSessions = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []
  const rows = muscleWeekFromMeso(days)
  const load = sportLoadForWeek(sportSlots, runSessions)
  const forecast = growthForecast({ days, slots: sportSlots, runSessions, athletic: profile?.athletic ?? [] })
  const phase = meso.phaseCurve[meso.currentWeek - 1]

  return (
    <Sheet onClose={onClose} labelledBy="muscle-week-title">
      {() => (
        <>
          <div className="eyebrow brand">Gym · W{meso.currentWeek} / {meso.weeks}{phase ? ` · ${phase}` : ''}</div>
          <h2 id="muscle-week-title" style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 800, margin: '3px 0 0' }}>
            Heti izomterhelés
          </h2>

          {/* ① Izomcsoportok */}
          <SectionHead color="var(--tag-gym)" title="Izomcsoportok" sub="szett · rep · gyakorlat · stimulus — a heti splitből" />
          <div className="col" style={{ gap: 8 }}>
            {rows.map((r) => {
              const fam = muscleColor(r.muscle)
              const sources = load.perMuscle[r.muscle] ?? []
              const xp = forecast.muscleXp[r.muscle]
              return (
                <div key={r.muscle} className="row" style={{
                  gap: 12, borderRadius: 14, background: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)', borderLeft: `5px solid ${fam.rail}`,
                  padding: '12px 14px', alignItems: 'flex-start',
                }}>
                  <div className="col flex-1" style={{ minWidth: 0, gap: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: fam.deep }}>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {r.repMinTotal}–{r.repMaxTotal} rep · {r.exerciseCount} gyakorlat
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 9, alignItems: 'center' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: fam.wash, color: fam.deep }}>
                        {r.gymFrequency}×/hét gym
                      </span>
                      {sources.map((s) => (
                        <span key={s.kind} style={{
                          fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                          background: s.kind.startsWith('run') ? 'var(--wash-run)' : 'var(--wash-sport)',
                          color: s.kind.startsWith('run') ? 'var(--tag-run)' : 'var(--tag-sport)',
                        }}>
                          {tri(s.load)} {s.label}{s.count > 1 ? ` ×${s.count}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 62, paddingTop: 2 }}>
                    <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{r.workingSets}</div>
                    <div className="label-mono text-tertiary" style={{ fontSize: 8.5, marginTop: 3 }}>SZETT</div>
                    {xp ? <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--tag-gym)', marginTop: 8 }}>+~{xp} XP</div> : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 10, textAlign: 'center' }}>
            ▲ = sport/futás plusz-stimulus · XP = becslés a tervezett hétből
          </div>

          {/* ② Sport & futás terhelés */}
          <SectionHead color="var(--tag-sport)" title="Sport & futás terhelés" sub="a hét tervezett eseményei izomcsoportokra vetítve" />
          {load.events.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Nincs tervezett sport/futás esemény ezen a héten.</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {load.events.map((e, i) => (
                <div key={`${e.kind}-${e.day}-${i}`} style={{
                  borderRadius: 14, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '12px 14px',
                }}>
                  <div className="row" style={{ alignItems: 'center', gap: 9 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999, letterSpacing: '.06em',
                      background: e.tag === 'FUTÁS' ? 'var(--wash-run)' : 'var(--wash-sport)',
                      color: e.tag === 'FUTÁS' ? 'var(--tag-run)' : 'var(--tag-sport)',
                    }}>{e.tag}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{e.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                      {DAY_LABELS[e.day] ?? e.day}{e.time ? ` · ${e.time}` : ''}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                    {e.regionLoads.map((rl) => {
                      const fam = regionColor(rl.region)
                      return (
                        <span key={rl.region} style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: fam.wash, color: fam.deep }}>
                          {rl.label} {tri(rl.load)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ③ Growth előrejelzés */}
          <SectionHead color="var(--lav-deep)" title="Growth előrejelzés" sub="várható skill-fejlődés a tervezett hét alapján" />
          {forecast.skills.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Még nincs előrejelzés ehhez a héthez.</div>
          ) : (
            <div className="col" style={{ gap: 0 }}>
              {forecast.skills.map((s, i) => {
                const meta = ATHLETIC_META[s.skillKey]
                return (
                  <div key={s.skillKey} className="row" style={{
                    alignItems: 'center', gap: 12, padding: '11px 2px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: '50%', background: 'var(--wash-lav)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none',
                    }}>{meta?.icon ?? '✨'}</span>
                    <div className="col flex-1" style={{ minWidth: 0, gap: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{meta?.name ?? s.skillKey}</div>
                      <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${s.progressPct}%`, background: 'var(--lav)', borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 800, color: 'var(--tag-gym)' }}>+~{s.xpEst}</div>
                      {s.willLevelUp && (
                        <span style={{
                          display: 'inline-block', fontSize: 9, fontWeight: 800, color: 'var(--sage-deep)',
                          background: 'var(--wash-sage)', padding: '2px 7px', borderRadius: 999, marginTop: 4,
                        }}>Lv {s.level} → {s.level + 1} ↗</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
            ~ becslés a tervezett hét alapján — a valós XP a logolt teljesítményből számolódik
          </div>
        </>
      )}
    </Sheet>
  )
}
