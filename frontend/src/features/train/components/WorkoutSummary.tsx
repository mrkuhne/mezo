// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen,
// colorful pill/chip redesign (mezo-w943, spec 2026-08-10; supersedes the
// grey 2026-07-15 layout). One shell, two modes:
//   'closing': pre-finish — hero + halo(fire) + note + "Edzés lezárása ✓".
//   'closed':  the same shell read-only (post-finish + /train/review).
// All numbers come from logic/summaryStats (pure, table-tested).
// ============================================================
import type { CSSProperties } from 'react'
import type { Medal } from '@/data/train/medalTypes'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor, regionColor } from '@/features/train/logic/muscleColors'
import { MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel } from '@/features/train/logic/medalLabels'
import { deriveSummaryStats, type SummaryExerciseInput } from '@/features/train/logic/summaryStats'
import { Icon } from '@/shared/ui/Icon'

export type SummaryExercise = SummaryExerciseInput

export interface SummaryChallenge {
  id: string
  typeLabel: string
  exercise?: string
  target: string
  state: 'hit' | 'miss' | 'skipped' | 'inconclusive'
  detail?: string
}

const CHALLENGE_COPY: Record<SummaryChallenge['state'], { glyph: string; label: string; cls: string }> = {
  hit: { glyph: '✓', label: 'megcsináltad', cls: 'hit' },
  miss: { glyph: '◯', label: 'nem jött össze', cls: 'miss' },
  skipped: { glyph: '⊘', label: 'skippelted', cls: 'skip' },
  inconclusive: { glyph: '◌', label: 'nem értékelhető', cls: 'skip' },
}

const hu = (n: number, digits = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: digits })

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, medals = [], durationMin = null,
  onFinish, finishPending = false, onBack, onExit,
}: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  medals?: Medal[]
  durationMin?: number | null
  onFinish?: () => void
  finishPending?: boolean
  onBack?: () => void
  onExit: () => void
}) {
  const s = deriveSummaryStats(exercises, medals)
  const chalHit = challenges.filter((c) => c.state === 'hit').length
  const chalMiss = challenges.filter((c) => c.state !== 'hit').length

  return (
    <div>
      <div className="wsum-top">
        <button onClick={onExit}>
          <span className="wsum-xi" aria-hidden="true">{mode === 'closing' ? '✕' : '←'}</span>
          {mode === 'closing' ? 'Bezárás' : 'Vissza'}
        </button>
      </div>

      <div className="wsum-hero">
        <div className={`wsum-halo ${mode === 'closing' ? 'fire' : 'calm'}`} aria-hidden="true" />
        <div className={`wsum-over${mode === 'closed' ? ' closed' : ''}`}>{eyebrow}</div>
        <h2>{title}</h2>
        <div className="wsum-num" aria-label={`${s.doneSets} / ${s.plannedSets} szett`}>
          <span aria-hidden="true">
            {s.doneSets}<span className="of">/{s.plannedSets}</span><span className="unit">szett</span>
          </span>
        </div>
        <div className="wsum-sub">
          <b>{hu(s.volumeT)} t</b> összvolumen · <b>{s.doneEx}/{s.totalEx}</b> gyakorlat
          {durationMin ? <> · ~{durationMin} perc</> : null}
        </div>
      </div>

      {s.regions.length > 0 && (
        <div className="wsum-regrow">
          {s.regions.map((r) => {
            const fam = regionColor(r.region)
            return (
              <span key={r.region} className={`wsum-reg${r.off ? ' off' : ''}`}
                style={r.off ? undefined : { '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties}>
                {r.label}{r.off ? null : <span className="n">{r.sets} szett</span>}
              </span>
            )
          })}
        </div>
      )}

      <div className="wsum-stripwrap">
        <div className="wsum-strip">
          <div className="cell"><div className="v">{hu(s.volumeT)}<span className="u">t</span></div><div className="l">Volumen</div></div>
          <div className="cell"><div className={`v${s.records.length ? ' gold' : ''}`}>{s.records.length}<span className="u">🏅</span></div><div className="l">Rekord</div></div>
          <div className="cell"><div className={`v${s.targetCount ? ' green' : ''}`}>{s.targetCount}<span className="u">✓</span></div><div className="l">Célszett</div></div>
          <div className="cell"><div className="v">{s.avgRir == null ? '–' : hu(s.avgRir)}</div><div className="l">Ø RIR</div></div>
        </div>
      </div>

      {medals.length > 0 && (
        <div className="wsum-sec">
          <div className="wsum-slabel">Medálok <span className="cnt">{s.records.length} rekord · {s.targetCount} cél</span></div>
          {s.records.map((m, i) => (
            <div key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} className="wsum-medal">
              <div className="disc" aria-hidden="true">🏅</div>
              <div className="tx">
                <div className="t">{MEDAL_TYPE_LABEL[m.type] ?? m.type}</div>
                <div className="m">{m.exerciseName}{m.type === 'E1RM' && m.weightKg != null && m.reps != null ? ` · ${formatMedalNumber(m.weightKg)} × ${m.reps}-ből becsülve` : ''}</div>
              </div>
              <div className="val">
                <div className="now">{medalValueLabel(m)}</div>
                {m.previousValue != null && (
                  <div className="prev">előző: {formatMedalNumber(m.previousValue)} {MEDAL_UNIT_LABEL[m.unit] ?? ''}</div>
                )}
              </div>
            </div>
          ))}
          {s.targetCount > 0 && (
            <div className="wsum-targets">
              <div className="tick" aria-hidden="true">✓</div>
              <div style={{ flex: 1 }}>
                <div className="t">{s.targetCount} célszett teljesítve</div>
                <div className="chips">
                  {s.targetGroups.map((g) => <span key={g.exerciseName}>{g.exerciseName} ×{g.count}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {challenges.length > 0 && (
        <div className="wsum-sec">
          <div className="wsum-slabel">Kihívások <span className="cnt">{chalHit} megvan · {chalMiss} kimaradt</span></div>
          {challenges.map((c) => {
            const copy = CHALLENGE_COPY[c.state]
            return (
              <div key={c.id} className={`wsum-chal ${copy.cls}`}>
                <div className="st" aria-hidden="true">{copy.glyph}</div>
                <div className="tx">
                  <div className="t">{c.typeLabel}{c.exercise ? ` · ${c.exercise}` : ''}</div>
                  <div className="m">{c.detail ?? c.target}</div>
                </div>
                <div className="out">{copy.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="wsum-sec">
        <div className="wsum-slabel">Gyakorlatonként <span className="cnt">szett-térkép</span></div>
        {s.exercises.map((e) => {
          const fam = muscleColor(e.muscle)
          const famStyle = { '--fam-rail': fam.rail, '--fam-wash': fam.wash, '--fam-deep': fam.deep } as CSSProperties
          return (
            <div key={e.id} className={`wsum-exc${e.abandoned ? ' dead' : ''}`} style={famStyle}>
              <div className="hd">
                <span className="nm">{e.name}</span>
                <span className="mus">{MUSCLE_LABELS[e.muscle] ?? e.muscle}</span>
                {e.abandoned
                  ? <span className="setn dead">kihagyva</span>
                  : (
                    <span className={`setn${e.partial ? ' part' : ''}`}>
                      {e.doneSets}/{e.plannedSets}
                      {e.skipped && <span className="skipmark"> · kihagyva</span>}
                    </span>
                  )}
              </div>
              {e.chips.length > 0 && (
                <div className="chips">
                  {e.chips.map((c, i) => (
                    <span key={i} className={`wsum-chip${c.record ? ' rec' : c.top ? ' top' : ''}`}>
                      {c.record ? '🏅 ' : ''}{hu(c.weight)} × {c.reps}
                      {c.rir != null && <span className="rir"> @{c.rir}</span>}
                    </span>
                  ))}
                  {e.missing > 0 && <span className="wsum-chip ghost">— kimaradt</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mode === 'closing' && (
        <div className="wsum-sec">
          <div className="wsum-note">
            <div className="l">Edzés-jegyzet · opcionális</div>
            <textarea aria-label="Edzés-jegyzet · opcionális" placeholder='pl. "pumpa brutális volt"' />
          </div>
        </div>
      )}

      <div className="wsum-ctas">
        {mode === 'closing' ? (
          <>
            <button className="cta-primary" disabled={finishPending} onClick={onFinish}>
              <Icon name="check" size={16} />
              <span>Edzés lezárása ✓</span>
            </button>
            <button type="button" className="cta-ghost" style={{ padding: 12 }} onClick={onBack}>
              ← Vissza az edzéshez
            </button>
          </>
        ) : (
          <button className="cta-ghost" style={{ padding: 12 }} onClick={onExit}>
            ← Vissza
          </button>
        )}
      </div>
    </div>
  )
}
