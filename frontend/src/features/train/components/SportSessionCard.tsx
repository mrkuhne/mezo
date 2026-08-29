// ============================================================
// Mezo · SportSessionCard — one logged session (volleyball/cross/TRX) in
// the SportPage log list: a kind-correct stag type tag + date/time eyebrow,
// mono duration + setek/körök (branched by kind), a big RPE readout graded
// 7+ coral / 8+ amber (never red — ADR-aligned with the rest of Train), two
// MiniBars and optional notes.
// Ported from prototype sport.jsx SportSessionCard — the tag was previously
// a hardcoded `stag-sport RÖPI` that mislabeled cross/TRX rows (mezo-d20.3.4).
// ============================================================
import type { SportSession } from '@/data/types'
import { MiniBar } from '@/features/train/components/MiniBar'
import { sportOf, SPORT_TAGS, SPORT_TONE, type SportKind } from '@/features/train/logic/sportKinds'

interface SportSessionCardProps {
  session: SportSession
}

export function SportSessionCard({ session }: SportSessionCardProps) {
  const kind = sportOf({ sport: session.sport as SportKind })
  const isVolleyball = kind === 'volleyball'
  // RPE grading is off the RPE readout itself, never intensity — 7+ coral,
  // 8+ amber, and NEVER red (RPE grades stop at amber across Train).
  const rpeColor =
    session.rpe >= 8 ? 'var(--warning)' : session.rpe >= 7 ? 'var(--coral)' : 'var(--text-secondary)'

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col flex-1">
          <span className="row gap-sm" style={{ alignItems: 'center' }}>
            <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
            <span className="eyebrow" style={{ color: 'var(--tag-sport)' }}>
              {session.date} · {session.time}
            </span>
          </span>
          <div className="row gap-md mt-md" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
            <span>
              <span style={{ color: 'var(--text-tertiary)' }}>idő</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{session.duration}p</span>
            </span>
            {isVolleyball ? (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>setek</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{session.setsPlayed ?? '–'}</span>
              </span>
            ) : (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>körök</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{session.rounds ?? '–'}</span>
              </span>
            )}
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
              color: rpeColor,
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
          <MiniBar label="Intenzitás" val={session.intensity} max={10} color="var(--tag-sport)" />
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
