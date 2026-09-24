// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Train's Mai (mezo-9bbc).
// ÜVEG (mezo-me75u.4, prototypes/uveg-edzes.html `mai()` `.sess`): ONE glass card in the
// session's hue (gym coral, sport rose, run sky), the 3D art in a lit well, a tag line
// (TAG · time · state pill), the title, flat fact pills, and a lit pill CTA — or, once
// logged, the flat DoneBar. It renders its own markup now: the shared `ItemCard`
// (mezo-jyua) wore the pre-glass `.todaycard` skin, and Mai was its only live caller.
// ============================================================
import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { DoneBar } from '@/features/train/components/DoneBar'
import type { SessionTone } from '@/features/train/logic/sportKinds'

/** The glass hue per modality tone — one accent per card (bible §2). */
const TONE_HUE: Record<SessionTone, string> = {
  gym: 'var(--dv-coral)',
  sport: 'var(--dv-rose)',
  cross: 'var(--dv-rose)',
  trx: 'var(--dv-rose)',
  run: 'var(--dv-sky)',
}

interface TodaySessionCardProps {
  tone: SessionTone
  /** The session's Titanium 3D art (t-dumbbell, t-volley, t-run…), shown in the lit well. */
  art: Icon3DName
  tag: string
  time?: string | null
  title: string
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  loggedDetail?: string | null
  stateLabel?: string | null
  ctaLabel?: string
  onLog?: () => void
}

export function TodaySessionCard({
  tone, art, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog,
}: TodaySessionCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  return (
    <section
      className={cn('trm-sess glass', `trm-sess-${tone}`, logged && 'is-logged')}
      style={{ '--c': TONE_HUE[tone] } as CSSProperties}
    >
      <div className="trm-sess-top">
        <span className="uv-well trm-sess-well" aria-hidden="true">
          <Icon3D name={art} size={34} />
        </span>
        <div className="trm-sess-grow">
          <span className="trm-sess-tagl">
            <span className={cn('trm-tag', `trm-tag-${tone}`)}>
              {tag}{logged ? ' · MEGVAN' : null}
            </span>
            {!logged && time ? <em className="trm-sess-time">{time}</em> : null}
            {!logged && stateLabel ? <span className="trm-sess-state">{stateLabel}</span> : null}
          </span>
          {title ? <h3 className="trm-sess-title">{title}</h3> : null}
        </div>
      </div>

      {logged ? (
        <DoneBar
          summary={loggedSummary ?? ''}
          detail={loggedDetail}
          onClick={interactive ? onLog : undefined}
          ariaLabel={interactive ? `${title} — logolt session megnyitása` : undefined}
        />
      ) : (
        <>
          {pills.length > 0 && (
            <div className="trm-facts">
              {pills.map((p) => <span key={p} className="trm-fact">{p}</span>)}
            </div>
          )}
          {interactive && (
            <div className="trm-sess-cta">
              <button type="button" className="trm-pill np-press" onClick={onLog}>
                {ctaLabel}<span aria-hidden="true"> ›</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
