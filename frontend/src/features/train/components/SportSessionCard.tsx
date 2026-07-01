// ============================================================
// Mezo · SportSessionCard — one logged volleyball session in the
// SportPage log list: date/time eyebrow, mono duration/sets, a big
// RPE readout coloured by intensity, two MiniBars and optional notes.
// Ported from prototype sport.jsx SportSessionCard.
// ============================================================
import type { SportSession } from '@/data/types'
import { MiniBar } from '@/features/train/components/MiniBar'

interface SportSessionCardProps {
  session: SportSession
}

export function SportSessionCard({ session }: SportSessionCardProps) {
  // intensity is not captured by the T3 log sheet — colour falls back to the RPE
  // scale (same 1-10 semantics) and the Intenzitás bar hides when not present.
  const intensityScore = session.intensity ?? session.rpe
  const intensityColor =
    intensityScore >= 8
      ? 'var(--warning)'
      : intensityScore >= 7
        ? 'var(--brand-glow)'
        : 'var(--text-secondary)'

  return (
    <div className="card notch-4" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col flex-1">
          <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>
            {session.date} · {session.time}
          </span>
          <div className="row gap-md mt-md" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
            <span>
              <span style={{ color: 'var(--text-tertiary)' }}>idő</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{session.duration}p</span>
            </span>
            <span>
              <span style={{ color: 'var(--text-tertiary)' }}>setek</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{session.setsPlayed ?? '–'}</span>
            </span>
          </div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <span className="label-mono" style={{ fontSize: 8 }}>
            RPE
          </span>
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 22,
              fontWeight: 600,
              color: intensityColor,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {session.rpe}
          </span>
        </div>
      </div>

      {/* Mini stat row */}
      <div className="row gap-sm mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        {session.intensity != null && (
          <MiniBar label="Intenzitás" val={session.intensity} max={10} color="var(--cat-tendency)" />
        )}
        {session.shoulderStrain != null && (
          <MiniBar
            label="Váll terhelés"
            val={session.shoulderStrain}
            max={10}
            color={session.shoulderStrain >= 7 ? 'var(--warning)' : 'var(--text-secondary)'}
          />
        )}
      </div>

      {session.notes && (
        <p
          className="text-secondary mt-md"
          style={{ fontSize: 12, lineHeight: 1.5, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}
        >
          &ldquo;{session.notes}&rdquo;
        </p>
      )}
    </div>
  )
}
