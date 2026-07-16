// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen
// (spec 2026-07-15, mockups finish-screen + done-day-review).
// mode 'closing': pre-finish — stats + challenge outcome preview +
//   per-exercise recap + "Edzés lezárása ✓" (the ONLY thing that
//   completes the workout) + "← Vissza az edzéshez".
// mode 'closed': the same layout read-only (post-finish + review route).
// ============================================================
import type { LastWeekSet } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

export interface SummaryExercise {
  id: string
  name: string
  plannedSets: number
  sets: LastWeekSet[]
  skipped: boolean
}

export interface SummaryChallenge {
  id: string
  typeLabel: string
  exercise?: string
  target: string
  state: 'hit' | 'miss' | 'skipped' | 'inconclusive'
  detail?: string
}

const CHALLENGE_COPY: Record<SummaryChallenge['state'], { glyph: string; label: string; color: string }> = {
  hit: { glyph: '✓', label: 'megcsináltad', color: 'var(--success)' },
  miss: { glyph: '◯', label: 'nem jött össze', color: 'var(--warning)' },
  skipped: { glyph: '⊘', label: 'skippelted', color: 'var(--text-tertiary)' },
  inconclusive: { glyph: '◌', label: 'nem értékelhető', color: 'var(--text-tertiary)' },
}

function Stat({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex-1 card" style={{ padding: 14, textAlign: 'center', background: 'var(--surface-1)' }}>
      <div className="label-mono" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>{val}</div>
    </div>
  )
}

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, hadPR = false, showSetLines = false,
  onFinish, finishPending = false, onBack, onExit,
}: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  hadPR?: boolean
  showSetLines?: boolean
  onFinish?: () => void
  finishPending?: boolean
  onBack?: () => void
  onExit: () => void
}) {
  const doneSets = exercises.reduce((a, e) => a + e.sets.length, 0)
  const plannedSets = exercises.reduce((a, e) => a + e.plannedSets, 0)
  const volumeT = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0) / 1000
  const doneEx = exercises.filter((e) => e.sets.length > 0).length

  return (
    <div>
      <div style={{ padding: '20px 24px 8px' }}>
        <button className="row gap-sm" onClick={onExit} style={{ marginBottom: 16 }}>
          <Icon name="x" size={16} color="var(--text-secondary)" />
          <span className="eyebrow">{mode === 'closing' ? 'Bezárás' : 'Vissza'}</span>
        </button>
        <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{eyebrow}</span>
        <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, marginTop: 6, color: 'var(--text-primary)' }}>
          {title}{hadPR ? ' · PR ✨' : ''}
        </h2>
      </div>

      {/* Mai mérleg */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Mai mérleg</div>
        <div className="row gap-sm">
          <Stat label="Szett" val={`${doneSets}/${plannedSets}`} />
          <Stat label="Volumen" val={`${volumeT.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} t`} />
          <Stat label="Gyakorlat" val={`${doneEx}/${exercises.length}`} />
        </div>
      </div>

      {/* Kihívások */}
      {challenges.length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Kihívások</div>
          <div className="col gap-sm">
            {challenges.map((c) => {
              const copy = CHALLENGE_COPY[c.state]
              return (
                <div key={c.id} className="card row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
                  <span aria-hidden="true" style={{ color: copy.color, fontSize: 14, width: 20, textAlign: 'center' }}>{copy.glyph}</span>
                  <span className="col flex-1" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.typeLabel}{c.exercise ? ` · ${c.exercise}` : ''}</span>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.detail ?? c.target}</span>
                  </span>
                  <span className="label-mono" style={{ fontSize: 9, color: copy.color }}>{copy.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gyakorlatonként */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Gyakorlatonként</div>
        <div className="col gap-sm">
          {exercises.map((e) => {
            const best = e.sets.reduce<LastWeekSet | null>((b, s) => (s.weight > (b?.weight ?? -1) ? s : b), null)
            const abandoned = e.sets.length === 0
            return (
              <div key={e.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: abandoned ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, paddingRight: 8, textDecoration: abandoned ? 'line-through' : 'none' }}>
                    {e.name}
                  </span>
                  {abandoned ? (
                    <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>kihagyva</span>
                  ) : (
                    <span className="row gap-xs" style={{ alignItems: 'baseline' }}>
                      <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral-deep)' }}>{e.sets.length}/{e.plannedSets} szet</span>
                      {e.skipped && <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· kihagyva</span>}
                    </span>
                  )}
                </div>
                {showSetLines && e.sets.length > 0 ? (
                  <div className="label-mono" style={{ fontSize: 10, marginTop: 6, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {e.sets.map((s, i) => `${i + 1}: ${s.weight.toLocaleString('hu-HU')} × ${s.reps} @RIR ${s.rir}`).join(' · ')}
                  </div>
                ) : best ? (
                  <div className="row gap-md mt-sm" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
                    <span><span style={{ color: 'var(--text-tertiary)' }}>top</span> <span style={{ color: 'var(--text-primary)' }}>{best.weight.toLocaleString('hu-HU')}kg × {best.reps}</span></span>
                    <span><span style={{ color: 'var(--text-tertiary)' }}>RIR</span> <span style={{ color: 'var(--text-primary)' }}>{best.rir}</span></span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Note (presentational, as before) + actions */}
      {mode === 'closing' && (
        <div style={{ padding: '0 24px 16px' }}>
          <div className="card" style={{ padding: 14 }}>
            <span className="label-mono" style={{ fontSize: 9 }}>Edzés-jegyzet · opcionális</span>
            <textarea aria-label="Edzés-jegyzet · opcionális" placeholder='pl. "pumpa brutális volt"'
              style={{ width: '100%', marginTop: 8, minHeight: 52, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
          </div>
        </div>
      )}
      <div style={{ padding: '0 24px 28px' }}>
        <div className="col gap-sm">
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
    </div>
  )
}
