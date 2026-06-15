// ============================================================
// Mezo · RunSessionCard — pure presentational card for ONE prescribed
// running session (sprint / pyramid / steady). Mirrors the .seg-pill +
// .rpe-tag look from the Futás mockup (futas-app-faithful.html). Running
// accent is --info. No hooks, no data fetching — props in, markup out.
// ============================================================
import type { RunPrescribedSession, RunSegment } from '@/lib/runningApi'
import { DAY_ORDER } from '@/data/train'

const RUN = 'var(--info)'

// Mockup's .seg-pill: mono, small, tinted by role. work = --info, warmup/
// cooldown = --warning, rest/other = neutral surface-2.
function Pill({ text, tone }: { text: string; tone: 'work' | 'warm' | 'rest' }) {
  const style =
    tone === 'work'
      ? { color: RUN, borderColor: 'color-mix(in srgb, var(--info) 35%, transparent)', background: 'color-mix(in srgb, var(--info) 8%, transparent)' }
      : tone === 'warm'
        ? { color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'var(--surface-2)' }
        : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--ff-mono)',
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

  if (cooldown) pills.push({ key: 'cool', text: `${secLabel(cooldown.durationSec)} levezetés`, tone: 'warm' })
  return pills
}

export function RunSessionCard({ session, onLog }: { session: RunPrescribedSession; onLog?: () => void }) {
  const dayLabel = DAY_ORDER[session.dayOfWeek] ?? ''
  const { min, max } = session.rpeTarget
  // High-intensity sprint targets (min >= 9) get the red --error tag; otherwise amber --warning.
  const hot = session.kind === 'sprint' && min >= 9
  const rpeStyle = hot
    ? { color: 'var(--error)', background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.35)' }
    : { color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.35)' }

  return (
    <div
      className="card notch-4"
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: RUN }} />
      <div style={{ padding: '13px 14px 13px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span className="label-mono" style={{ color: 'var(--text-primary)' }}>{dayLabel}</span>
            {session.timeOfDay && (
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: RUN }}>{session.timeOfDay}</span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{session.label}</span>
          </div>
          <span
            style={{
              fontFamily: 'var(--ff-mono)',
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
          {onLog ? (
            <button
              type="button"
              onClick={onLog}
              style={{
                fontFamily: 'var(--ff-mono)',
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
              Naplózás ▸
            </button>
          ) : (
            <span
              style={{
                fontFamily: 'var(--ff-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              Naplózás ▸
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
