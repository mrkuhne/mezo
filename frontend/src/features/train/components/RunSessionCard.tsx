// ============================================================
// Mezo · RunSessionCard — pure presentational card for ONE prescribed
// running session (sprint / pyramid / steady). Mirrors the .seg-pill +
// .rpe-tag look from the Futás mockup (futas-app-faithful.html). Running
// accent is the Napiv --tag-run/--wash-run pair; a stag-run FUTÁS tag marks
// the session type. No hooks, no data fetching — props in, markup out.
// ============================================================
import type { RunPrescribedSession, RunSegment } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'

const RUN = 'var(--tag-run)'

// Mockup's .seg-pill: mono, small, tinted by role. work = --tag-run, warmup/
// cooldown = --warning, rest/other = neutral surface-2.
function Pill({ text, tone }: { text: string; tone: 'work' | 'warm' | 'rest' }) {
  const style =
    tone === 'work'
      ? { color: RUN, borderColor: 'color-mix(in srgb, var(--tag-run) 35%, transparent)', background: 'var(--wash-run)' }
      : tone === 'warm'
        ? { color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'var(--surface-2)' }
        : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        border: '1px solid',
        borderRadius: 2,
        ...style,
      }}
    >
      {text}
    </span>
  )
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
  // High-intensity sprint targets (min >= 9) get the terracotta --error tag (light
  // theme's --error-base IS terracotta, #C4634B — never a true alarm red); otherwise amber --warning.
  const hot = session.kind === 'sprint' && min >= 9
  const rpeStyle = hot
    ? { color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--error) 35%, transparent)' }
    : { color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.35)' }

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: RUN }} />
      <div style={{ padding: '13px 14px 13px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span className="stag stag-run">FUTÁS</span>
            <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{dayLabel}</span>
            {session.timeOfDay && (
              <span style={{ fontSize: 11, color: RUN }}>{session.timeOfDay}</span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{session.label}</span>
            {ctaState === 'today' && (
              <span className="excat-tag" style={{ background: 'var(--wash-run)', color: RUN }}>MA</span>
            )}
          </div>
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '2px 8px',
              borderRadius: 10,
              border: '1px solid',
              ...rpeStyle,
            }}
          >
            RPE {min}–{max}
          </span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {segmentPills(session).map((p) => (
            <Pill key={p.key} text={p.text} tone={p.tone} />
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          {ctaState === 'done' ? (
            <span
              className="excat-tag"
              style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)', color: 'var(--success)' }}
            >
              KÉSZ ✓
            </span>
          ) : ctaState === 'future' ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              Naplózás ▸
            </span>
          ) : (
            <button
              type="button"
              onClick={onLog}
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: RUN,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {ctaState === 'today' ? 'Naplózd ›' : 'Pótold ›'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
