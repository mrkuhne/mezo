// ============================================================
// Mezo · SportSessionCard — one logged session in the SportPage log list.
// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `sport('naplo')`
// `.ssc`): a rose glass card — the tag line (kind-correct stag + date · time),
// idő + setek/körök (branched by kind), a big light RPE numeral with a soft glow
// (graded 7+ coral / 8+ amber, never red — ADR-aligned with the rest of Train),
// two glowing mini bars (Intenzitás / Váll terhelés) and the note as Fraunces
// italic voice copy. Everything inside the glass is flat (bible §3.4).
// The tag was once a hardcoded `stag-sport RÖPI` that mislabeled cross/TRX rows
// (mezo-d20.3.4) — it stays kind-correct.
// ============================================================
import type { CSSProperties } from 'react'
import type { SportSession } from '@/data/types'
import { sportOf, SPORT_TAGS, SPORT_TONE, type SportKind } from '@/features/train/logic/sportKinds'

interface SportSessionCardProps {
  session: SportSession
}

/** One glowing kit bar (bible §5) with its label and value. */
function MiniBar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (val / max) * 100))
  return (
    <div className="uvs-mb" style={{ '--c': color } as CSSProperties}>
      <span>{label}</span>
      <span className="uv-bar" aria-hidden="true"><b style={{ '--w': `${pct}%` } as CSSProperties} /></span>
      <em>{val}</em>
    </div>
  )
}

export function SportSessionCard({ session }: SportSessionCardProps) {
  const kind = sportOf({ sport: session.sport as SportKind })
  const isVolleyball = kind === 'volleyball'
  // RPE grading is off the RPE readout itself, never intensity — 7+ coral,
  // 8+ amber, and NEVER red (RPE grades stop at amber across Train).
  const rpeColor =
    session.rpe >= 8 ? 'var(--dv-amber)' : session.rpe >= 7 ? 'var(--dv-coral)' : 'color-mix(in srgb, var(--dv-rose) 50%, #fff)'

  return (
    <article className="uvs-ssc glass" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}>
      <div className="uvs-ssc-top">
        <div className="uvs-ssc-l">
          <span className="uvs-tagl">
            <span className={`stag stag-${SPORT_TONE[kind]}`}>{SPORT_TAGS[kind]}</span>
            <em>{session.date} · {session.time}</em>
          </span>
          <div className="uvs-skv">
            <span><span className="k">idő</span> <b>{session.duration}p</b></span>
            {isVolleyball ? (
              <span><span className="k">setek</span> <b>{session.setsPlayed ?? '–'}</b></span>
            ) : (
              <span><span className="k">körök</span> <b>{session.rounds ?? '–'}</b></span>
            )}
          </div>
        </div>
        <span className="uvs-rpe" style={{ '--rc': rpeColor } as CSSProperties}>
          <b>{session.rpe}</b>
          <small>RPE</small>
        </span>
      </div>

      {(session.intensity != null || session.shoulderStrain != null) && (
        <div className="uvs-mbs">
          {session.intensity != null && (
            <MiniBar label="Intenzitás" val={session.intensity} max={10} color="var(--dv-rose)" />
          )}
          {session.shoulderStrain != null && (
            <MiniBar
              label="Váll terhelés"
              val={session.shoulderStrain}
              max={10}
              color={session.shoulderStrain >= 7 ? 'var(--dv-amber)' : 'var(--text-secondary)'}
            />
          )}
        </div>
      )}

      {session.notes && (
        <p className="uvs-q uv-voice">&bdquo;{session.notes}&rdquo;</p>
      )}
    </article>
  )
}
