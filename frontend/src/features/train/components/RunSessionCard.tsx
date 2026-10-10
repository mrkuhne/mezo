// ============================================================
// Mezo · RunSessionCard — pure presentational block for ONE prescribed
// running session (sprint / pyramid / steady). No hooks — props in, markup out.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `futas('het')` `.vs-log` + `ivl`):
// a row (run glyph, the session's name + a „Ma" pill, day · time · RPE target, and the
// state on the right: „Kész", a quiet „Naplózás ›" for a future day, or the
// „Naplózd ›" / „Pótold ›" link), then the interval tube — the session as one vessel
// whose level follows the pace — and the segment tags.
// ============================================================
import type { CSSProperties } from 'react'
import type { RunPrescribedSession, RunSegment } from '@/data/train/runningApi'
import { DAY_ORDER } from '@/data/train/train'
import { Lk, Row, St, Tags } from '@/shared/ui/folyadek'

const secLabel = (sec: number) => `${Math.round(sec / 60)}p`
const find = (segs: RunSegment[], type: RunSegment['type']) => segs.find((s) => s.type === type)

/** How high the liquid stands per segment kind (prototype `ivSprint` / `ivPyr`): the sprint is full, the walk a sliver. */
const LEVEL: Record<string, number> = { warmup: 0.4, work: 1, rest: 0.18, cooldown: 0.3 }
const KIND: Record<string, 'w' | 's' | 'r'> = { warmup: 'w', work: 's', rest: 'r', cooldown: 'w' }
/** Warm-up and cool-down are minutes long; in the tube they take the width of a minute so the intervals stay readable. */
const EDGE_SEC = 60

/**
 * The interval tube (prototype `ivl`): one flex cell per segment, width = its seconds, level = its pace.
 * A sprint stores ONE work + rest pair and a round count — `rounds` repeats the pair.
 */
export function IntervalTube({ segments, rounds }: { segments: RunSegment[]; rounds?: number | null }) {
  const edge = (g: RunSegment) => g.type === 'warmup' || g.type === 'cooldown'
  const lead = segments.filter((g, i) => edge(g) && i === 0)
  const tail = segments.filter((g, i) => edge(g) && i > 0)
  const mid = segments.filter((g) => !edge(g))
  const body = rounds && rounds > 1 && mid.length <= 2 ? Array.from({ length: rounds }, () => mid).flat() : mid
  const cells = [...lead, ...body, ...tail]
  if (cells.length === 0) return null
  return (
    <span className="es-ivl" aria-hidden="true">
      {cells.map((g, i) => (
        <i key={i} className={KIND[g.type] ?? 'r'}
          style={{ flex: Math.max(1, edge(g) ? Math.min(g.durationSec, EDGE_SEC) : g.durationSec), '--h': `${(LEVEL[g.type] ?? 0.18) * 100}%` } as CSSProperties} />
      ))}
    </span>
  )
}

// Build the summary tags for a session from its segments + kind.
function segmentTags(session: RunPrescribedSession): string[] {
  const segs = session.segments
  const warmup = find(segs, 'warmup')
  const cooldown = find(segs, 'cooldown')
  const tags: string[] = []

  if (warmup) tags.push(`${secLabel(warmup.durationSec)} bemelegítés`)

  if (session.kind === 'pyramid') {
    const work = segs.filter((s) => s.type === 'work')
    if (work.length) tags.push(`${work.map((s) => s.durationSec).join('／')} mp`)
  } else {
    const work = find(segs, 'work')
    const rest = find(segs, 'rest')
    if (work) tags.push(`${session.rounds ?? ''}${session.rounds ? '× · ' : ''}${work.durationSec}mp`)
    if (rest) tags.push(`${rest.durationSec}mp séta`)
  }

  // Pyramid rest is derived (segment × 2, wired into the block draft) — the
  // card surfaces that as an honest note tag instead of restating a number.
  if (session.kind === 'pyramid' && segs.some((s) => s.type === 'rest')) tags.push('pihenő = szakasz × 2')
  if (cooldown) tags.push(`${secLabel(cooldown.durationSec)} levezetés`)
  return tags
}

/** MA → Naplózd (today, not yet logged) · múlt → Pótold · jövő → quiet text · done → Kész. */
export type RunCtaState = 'today' | 'past' | 'future' | 'done'

export function RunSessionCard({ session, ctaState, onLog }: {
  session: RunPrescribedSession
  ctaState: RunCtaState
  onLog?: () => void
}) {
  const dayLabel = DAY_ORDER[session.dayOfWeek] ?? ''
  const { min, max } = session.rpeTarget
  const sub = [dayLabel, session.timeOfDay, `RPE ${min}–${max}`].filter(Boolean).join(' · ')

  return (
    <div className="es-log">
      <Row
        icon="t-run"
        title={<>{session.label}{ctaState === 'today' && <> <St tone="plan">Ma</St></>}</>}
        sub={sub}
        right={ctaState === 'done' ? <St tone="ok">Kész</St>
          : ctaState === 'future' ? <span className="es-later">Naplózás ›</span>
          : <Lk onClick={onLog}>{ctaState === 'today' ? 'Naplózd ›' : 'Pótold ›'}</Lk>}
      />
      <IntervalTube segments={session.segments} rounds={session.kind === 'sprint' ? session.rounds : null} />
      <Tags items={segmentTags(session)} />
    </div>
  )
}
