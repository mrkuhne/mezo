// ============================================================
// Mezo · RunSessionCard — pure presentational card for ONE prescribed
// running session (sprint / pyramid / steady). Üveg re-dress (mezo-me75u.4,
// prototype uveg-edzes-body.html `futas('het')` `.rsc`): a sky glass card —
// the tag line (stag-run FUTÁS + day · time, the RPE target as a flat chip),
// the session name (+ a lit MA pill), flat segment chips tinted by role, and
// the CTA: a lit sky „Naplózd ›"/„Pótold ›" pill, a quiet „Naplózás ›" for a
// future day, or KÉSZ with the 3D tick. No hooks — props in, markup out.
// ============================================================
import type { CSSProperties } from 'react'
import type { RunPrescribedSession, RunSegment } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { Icon3D } from '@/shared/ui/clay'

// Segment chips are flat (they sit inside the glass): work = sky-tinted,
// warmup/cooldown = amber-tinted, rest/notes = neutral.
function Pill({ text, tone }: { text: string; tone: 'work' | 'warm' | 'rest' }) {
  return <span className={`uvs-chip is-${tone}`}>{text}</span>
}

const secLabel = (sec: number) => `${Math.round(sec / 60)}p`
const find = (segs: RunSegment[], type: RunSegment['type']) => segs.find((s) => s.type === type)

// Build the summary pills for a session from its segments + kind.
function segmentPills(session: RunPrescribedSession): { key: string; text: string; tone: 'work' | 'warm' | 'rest' }[] {
  const segs = session.segments
  const warmup = find(segs, 'warmup')
  const cooldown = find(segs, 'cooldown')
  const pills: { key: string; text: string; tone: 'work' | 'warm' | 'rest' }[] = []

  if (warmup) pills.push({ key: 'warm', text: `${secLabel(warmup.durationSec)} bemelegítés`, tone: 'warm' })

  if (session.kind === 'pyramid') {
    const work = segs.filter((s) => s.type === 'work')
    if (work.length) pills.push({ key: 'work', text: `${work.map((s) => s.durationSec).join('／')} mp`, tone: 'work' })
  } else {
    const work = find(segs, 'work')
    const rest = find(segs, 'rest')
    if (work) pills.push({ key: 'work', text: `${session.rounds ?? ''}${session.rounds ? '× · ' : ''}${work.durationSec}mp`, tone: 'work' })
    if (rest) pills.push({ key: 'rest', text: `${rest.durationSec}mp séta`, tone: 'rest' })
  }

  // Pyramid rest is derived (segment × 2, wired into the block draft) — the
  // card surfaces that as an honest note pill instead of restating a number.
  if (session.kind === 'pyramid' && segs.some((s) => s.type === 'rest')) {
    pills.push({ key: 'restnote', text: 'pihenő = szakasz × 2', tone: 'rest' })
  }
  if (cooldown) pills.push({ key: 'cool', text: `${secLabel(cooldown.durationSec)} levezetés`, tone: 'warm' })
  return pills
}

/** MA → Naplózd (today, not yet logged) · múlt → Pótold · jövő → disabled grey · done → KÉSZ. */
export type RunCtaState = 'today' | 'past' | 'future' | 'done'

export function RunSessionCard({ session, ctaState, onLog }: {
  session: RunPrescribedSession
  ctaState: RunCtaState
  onLog?: () => void
}) {
  const dayLabel = DAY_ORDER[session.dayOfWeek] ?? ''
  const { min, max } = session.rpeTarget
  // High-intensity sprint targets (min >= 9) get the coral chip; otherwise amber.
  const hot = session.kind === 'sprint' && min >= 9

  return (
    <article className="uvs-rsc glass" style={{ '--c': 'var(--dv-sky)' } as CSSProperties}>
      <div className="uvs-rsc-top">
        <span className="uvs-tagl">
          <span className="stag stag-run">FUTÁS</span>
          <em>{dayLabel}{session.timeOfDay ? ` · ${session.timeOfDay}` : ''}</em>
        </span>
        <span className={hot ? 'uvs-chip is-rpe is-hot' : 'uvs-chip is-rpe'}>RPE {min}–{max}</span>
      </div>
      <div className="uvs-rsc-name">
        <strong>{session.label}</strong>
        {ctaState === 'today' && <span className="uvs-tag is-lit">MA</span>}
      </div>
      <div className="uvs-chips">
        {segmentPills(session).map((p) => (
          <Pill key={p.key} text={p.text} tone={p.tone} />
        ))}
      </div>
      <div className="uvs-rsc-cta">
        {ctaState === 'done' ? (
          <span className="uvs-ok"><Icon3D name="t-tick" size={18} />KÉSZ</span>
        ) : ctaState === 'future' ? (
          <span className="uvs-later">Naplózás ›</span>
        ) : (
          <button type="button" className="uvs-pill" onClick={onLog}>
            {ctaState === 'today' ? 'Naplózd ›' : 'Pótold ›'}
          </button>
        )}
      </div>
    </article>
  )
}
