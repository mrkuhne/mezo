// ============================================================
// Mezo · ExerciseRecordSheet — per-exercise records (mockup variant A):
// hero best set → 2×2 stat grid (e1RM, best session volume, total volume,
// sets·reps) → rep-PR table (top 3 weights) → last-5 sparkline. Bodyweight
// records (no weighted sets) hero the total-rep counter and dash the
// weight-based cells. Pure read view — data comes in as a prop.
// ============================================================
import { MUSCLE_LABELS } from '@/data/train/train'
import { huMonthDay } from '@/shared/lib/dates'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { VideoDemo, youTubeId } from '@/features/train/components/VideoDemo'

// 102.5 -> "102.5", 100.0 -> "100"
const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')
// whole-kg volumes get HU thousands grouping (NNBSP from toLocaleString is
// normalized to a plain space for stable copy); >= 10 t switches to tonnes
const fmtVolume = (kg: number) =>
  kg >= 10000
    ? `${(Math.round(kg / 100) / 10).toFixed(1).replace('.', ',')} t`
    : `${Math.round(kg).toLocaleString('hu-HU').replace(/[\u00A0\u202F]/g, ' ')} kg`

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card notch-4" style={{ padding: 12 }}>
      <span className="eyebrow">{label}</span>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 600, marginTop: 6 }}>
        {value}
      </div>
      {sub && (
        <span className="label-mono text-tertiary" style={{ fontSize: 8, display: 'block', marginTop: 3 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

interface ExerciseRecordSheetProps {
  record: ExerciseRecordResponse
  videoUrl?: string | null
  onClose: () => void
}

export function ExerciseRecordSheet({ record, videoUrl, onClose }: ExerciseRecordSheetProps) {
  const r = record
  const maxRecent = Math.max(...r.recentTopSets.map((s) => s.weightKg ?? s.reps), 1)

  return (
    <Sheet onClose={onClose} labelledBy="exercise-record-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div className="col">
              <span className="eyebrow brand">Rekordok</span>
              <span
                role="heading"
                aria-level={2}
                id="exercise-record-title"
                style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 4, lineHeight: 1.15 }}
              >
                {r.name}
              </span>
              <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                {[MUSCLE_LABELS[r.muscle] ?? r.muscle, r.type, `${r.sessionCount} alkalom`].join(' · ')}
              </span>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Hero — best set, or the rep counter for bodyweight exercises */}
          <div
            className="card notch-12"
            style={{
              padding: 16, margin: '12px 0',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--coral) 7%, transparent) 0%, var(--surface-1) 100%)',
              borderColor: 'var(--border-brand)',
            }}
          >
            <span className="eyebrow brand">{r.bestSet ? 'Legjobb szett' : 'Összes rep'}</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 600, margin: '6px 0 2px' }}>
              {r.bestSet ? `${num(r.bestSet.weightKg!)} kg × ${r.bestSet.reps}` : `${r.totalReps} rep`}
            </div>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
              {r.bestSet ? huMonthDay(r.bestSet.date) : `${r.sessionCount} alkalom alatt`}
            </span>
          </div>

          {/* Inline demo video (catalog-resolved) — the wrapper renders only when a real
              YouTube id is extractable, so a stored non-YouTube url leaves no empty gap. */}
          {videoUrl && youTubeId(videoUrl) && (
            <div style={{ marginBottom: 12 }}>
              <VideoDemo url={videoUrl} />
            </div>
          )}

          {/* 2×2 stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Stat
              label="Becsült 1RM"
              value={r.bestE1rm ? `${num(r.bestE1rm.value)} kg` : '—'}
              sub={r.bestE1rm ? `EPLEY · ${huMonthDay(r.bestE1rm.set.date)}` : undefined}
            />
            <Stat
              label="Legjobb session"
              value={r.bestSessionVolume ? fmtVolume(r.bestSessionVolume.volumeKg) : '—'}
              sub={r.bestSessionVolume ? `VOLUMEN · ${huMonthDay(r.bestSessionVolume.date)}` : undefined}
            />
            <Stat label="Össz-volumen" value={r.totalVolume > 0 ? fmtVolume(r.totalVolume) : '—'} sub="ALL-TIME" />
            <Stat label="Szett · rep" value={`${r.totalSets} · ${r.totalReps}`} sub="ALL-TIME" />
          </div>

          {/* Rep records (weighted exercises only) */}
          {r.repRecords.length > 0 && (
            <>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                Rep-rekord · top súlyok
              </span>
              <div className="card notch-4" style={{ marginBottom: 12 }}>
                {r.repRecords.map((rr, i) => (
                  <div
                    key={i}
                    className="row"
                    style={{
                      justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px',
                      borderBottom: i < r.repRecords.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span className="label-mono" style={{ fontSize: 12 }}>{num(rr.weightKg!)} kg</span>
                    <span className="label-mono" style={{ fontSize: 11, color: 'var(--brand-glow)' }}>{rr.reps} REP</span>
                    <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{huMonthDay(rr.date)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Last-5 sparkline */}
          {r.recentTopSets.length > 0 && (
            <>
              <span className="eyebrow" style={{ display: 'block' }}>
                Utolsó {r.recentTopSets.length} alkalom · top szett
              </span>
              <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 42, padding: '0 4px', marginTop: 8 }}>
                {r.recentTopSets.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(18, Math.round(((s.weightKg ?? s.reps) / maxRecent) * 100))}%`,
                      background: 'color-mix(in srgb, var(--brand-glow) 30%, transparent)',
                      borderTop: '2px solid var(--brand-glow)',
                    }}
                  />
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '4px 4px 0' }}>
                {r.recentTopSets.map((s, i) => (
                  <span key={i} className="label-mono text-tertiary" style={{ fontSize: 8 }}>{huMonthDay(s.date)}</span>
                ))}
              </div>
            </>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
