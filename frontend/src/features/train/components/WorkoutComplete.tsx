// ============================================================
// Mezo · WorkoutComplete — the closing screen of a workout. Companion
// celebration card (coral tint + radial glow on a PR), "Mai mérleg"
// stats, per-exercise recap, post-workout fuel window, optional note,
// and the save / share actions. Ported from prototype train.jsx
// (WorkoutComplete + CompleteStat).
// ============================================================
import type { WorkoutPlan, LastWeekSet } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { ToolChip } from '@/shared/ui/ToolChip'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'

type CompletedSets = Record<string, LastWeekSet[]>

function CompleteStat({
  label,
  val,
  unit,
  highlight = false,
}: {
  label: string
  val: number | string
  unit?: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex-1 card notch-4"
      style={{
        padding: 14,
        textAlign: 'center',
        borderColor: highlight ? 'var(--border-brand)' : 'var(--border-subtle)',
        background: highlight
          ? 'color-mix(in srgb, var(--coral) 4%, transparent)'
          : 'var(--surface-1)',
      }}
    >
      <div className="label-mono" style={{ fontSize: 9 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 28,
          fontWeight: 600,
          marginTop: 4,
          color: highlight ? 'var(--coral)' : 'var(--text-primary)',
          textShadow: highlight ? '0 0 12px var(--coral)' : 'none',
        }}
      >
        {val}
        {unit && (
          <span
            style={{
              fontFamily: 'var(--ff-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginLeft: 2,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

export function WorkoutComplete({
  workout,
  completedSets,
  hadPR,
  onExit,
  skippedExerciseIds = [],
}: {
  workout: WorkoutPlan
  completedSets: CompletedSets
  hadPR: boolean
  onExit: () => void
  /** Exercise ids the user skipped — marked "kihagyva" in the recap (vs. a 0/n count). */
  skippedExerciseIds?: string[]
}) {
  const totalSets = Object.values(completedSets).reduce((a, arr) => a + arr.length, 0)
  const totalVolume = Object.values(completedSets).reduce(
    (a, arr) => a + arr.reduce((b, s) => b + s.weight * s.reps, 0),
    0,
  )
  const setsByEx = workout.exercises.map((e, i) => ({
    name: e.name,
    sets: completedSets['ex' + i] ?? [],
  }))

  const prCopy =
    'Március 4 óta vártuk ezt a momentumot — most a Chest Supported Row új csúcson van. Ezt jegyezzük meg jövő vasárnapra, amikor a heti memoir-t írom. **Büszke vagyok rád.**'
  const noPrCopy =
    'Lezártuk a Pull Day-t, és a Reta D3 ablakot nézve ez a volumen most pont elég. Holnap péntek volleyball lesz — a regenerálódás az igazi munka most.'

  return (
    <div>
      {/* Hero */}
      <div style={{ padding: '20px 24px 8px' }}>
        <button className="row gap-sm" onClick={onExit} style={{ marginBottom: 16 }}>
          <Icon name="x" size={16} color="var(--text-secondary)" />
          <span className="eyebrow">Bezárás</span>
        </button>
        <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Edzés vége · {workout.title}</span>
      </div>

      {/* Companion celebration */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          style={{
            padding: 22,
            background: hadPR
              ? 'linear-gradient(180deg, color-mix(in srgb, var(--coral) 8%, transparent) 0%, var(--surface-1) 100%)'
              : 'var(--surface-1)',
            borderColor: hadPR ? 'var(--border-brand)' : 'var(--border-subtle)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {hadPR && (
            <div
              style={{
                position: 'absolute',
                right: -40,
                top: -40,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--coral) 18%, transparent), transparent 70%)',
              }}
            />
          )}
          <div className="row gap-sm" style={{ position: 'relative' }}>
            <Icon name={hadPR ? 'sparkle' : 'check'} size={14} color="var(--coral)" />
            <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Mezo · most</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 26,
              fontWeight: 600,
              lineHeight: 1.15,
              marginTop: 12,
              color: 'var(--text-primary)',
              position: 'relative',
            }}
          >
            {hadPR ? 'Megdöntöttük.' : 'Lezártuk együtt.'}
          </div>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              marginTop: 10,
              color: 'var(--text-primary)',
              position: 'relative',
            }}
          >
            <SafeMarkdown text={hadPR ? prCopy : noPrCopy} />
          </p>

          {/* Tool transparency */}
          <div
            className="row gap-xs flex-wrap mt-lg"
            style={{
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              position: 'relative',
            }}
          >
            <ToolChip type="read" name="get_workout_history(7d)" />
            <ToolChip type="compute" name="computeVolumeDelta()" />
            {hadPR && <ToolChip type="write" name="writePR(chest_row)" />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Mai mérleg
        </div>
        <div className="row gap-sm">
          <CompleteStat label="Szet" val={totalSets} />
          <CompleteStat label="Volumen" val={Math.round(totalVolume / 100) / 10} unit="kt" />
          <CompleteStat label="PR" val={hadPR ? 1 : 0} highlight={hadPR} />
        </div>
      </div>

      {/* Per-exercise recap */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Gyakorlatonként
        </div>
        <div className="col gap-sm">
          {setsByEx.map((e, i) => {
            const best = e.sets.reduce<LastWeekSet | null>(
              (b, s) => (s.weight > (b?.weight ?? 0) ? s : b),
              null,
            )
            const isSkipped = skippedExerciseIds.includes(workout.exercises[i].id)
            const hasSets = e.sets.length > 0
            return (
              <div key={i} className="card notch-4" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, paddingRight: 8 }}>
                    {e.name}
                  </span>
                  {isSkipped && !hasSets ? (
                    // Fully skipped — never logged a set: struck "kihagyva", no count.
                    <span
                      className="label-mono"
                      style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}
                    >
                      kihagyva
                    </span>
                  ) : (
                    // Has logged sets (incl. partially-done-then-skipped): real count,
                    // counted in the totals. A muted marker flags the skipped remainder.
                    <span className="row gap-xs" style={{ alignItems: 'baseline' }}>
                      <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral-deep)' }}>
                        {e.sets.length}/{workout.exercises[i].sets} szet
                      </span>
                      {isSkipped && (
                        <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          · kihagyva
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {best && (
                  <div
                    className="row gap-md mt-sm"
                    style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}
                  >
                    <span>
                      <span style={{ color: 'var(--text-tertiary)' }}>top</span>{' '}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {best.weight}kg × {best.reps}
                      </span>
                    </span>
                    <span>
                      <span style={{ color: 'var(--text-tertiary)' }}>RIR</span>{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{best.rir}</span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Post-workout window */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          style={{ padding: 16, background: 'color-mix(in srgb, var(--coral) 3%, transparent)' }}
        >
          <div className="row gap-sm">
            <Icon name="fuel" size={14} color="var(--coral)" />
            <div className="col flex-1">
              <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Most · post-workout window</span>
              <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                30 perc múlva 40g whey + 60g szénhidrát logikus. A volleyball előtti vacsora-ablak
                18:00.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="card notch-12" style={{ padding: 14 }}>
          <span className="label-mono" style={{ fontSize: 9 }}>
            Edzés-jegyzet · opcionális
          </span>
          <textarea
            aria-label="Edzés-jegyzet · opcionális"
            placeholder={'pl. "Chest row súly jobb mint vártam · pumpa brutális volt"'}
            style={{ width: '100%', marginTop: 8, minHeight: 60, resize: 'none', fontSize: 13, lineHeight: 1.45 }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="col gap-sm">
          <button className="cta-primary notch-8" onClick={onExit}>
            <Icon name="check" size={16} />
            <span>Mentés · vissza a Today-re</span>
          </button>
          <button type="button" className="cta-ghost notch-4" style={{ padding: 12 }}>
            <Icon name="bookmark" size={12} /> Megosztom Mezo-val
          </button>
        </div>
      </div>
    </div>
  )
}
