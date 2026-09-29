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
import { KimeloInner, RunRampInner, SkippedBlock } from '@/features/train/components/SkippedBlock'
import type { SessionTone } from '@/features/train/logic/sportKinds'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { SESSION_STATE_LABEL } from '@/features/train/logic/sessionState'
import { KIMELO } from '@/features/train/logic/skipCopy'

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
  /** Kihagyás S1 (mezo-q4xt2.1, prototype elo/edzes.html `.sess`): the skip row when this
   *  occurrence is skipped — the card dims (`is-skip`), the chip reads KIHAGYVA and the CTA row
   *  gives way to the flat SkippedBlock (reason, effect, Másik ok / Visszavonom). */
  skipped?: PlannedSkip
  /** Offers the ghost „Kihagyom"/„Kihagytam" pill before the CTA (omit ⇒ no pill). */
  onSkip?: () => void
  skipLabel?: 'Kihagyom' | 'Kihagytam'
  onSkipReason?: () => void
  onSkipUndo?: () => void
  /** Kímélő mód S2 (mezo-q4xt2.2, prototype `kmInner()`): the occurrence sits on a protected day —
   *  muted, the chip reads KÍMÉLŐ MÓD, and the flat „Kímélő mód" block replaces the CTA row (no
   *  skip button: the day already kimarad). Wins over a real skip row on the same date. */
  kimelo?: boolean
  /** The first run after a comeback (prototype `rCb` card): the „Visszatérő futás" note. */
  rampNote?: boolean
}

export function TodaySessionCard({
  tone, art, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog,
  skipped, onSkip, skipLabel = 'Kihagyom', onSkipReason, onSkipUndo, kimelo, rampNote,
}: TodaySessionCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  // A logged session wins over a skip (a trained day is never "skipped").
  const isKm = !logged && Boolean(kimelo)
  const isSkip = !logged && !isKm && Boolean(skipped)
  const chip = isKm ? KIMELO.chip : isSkip ? 'KIHAGYVA' : stateLabel
  return (
    <section
      className={cn('trm-sess glass', `trm-sess-${tone}`, logged && 'is-logged', (isSkip || isKm) && 'is-skip')}
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
            {!logged && chip ? (
              <span className={cn('trm-sess-state', (isSkip || isKm) && 'is-skip', !isSkip && !isKm && chip === SESSION_STATE_LABEL.missed && 'is-miss')}>
                {chip}
              </span>
            ) : null}
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
          {isKm ? (
            <KimeloInner />
          ) : isSkip ? (
            <SkippedBlock inner skip={skipped!} onReason={() => onSkipReason?.()} onUndo={() => onSkipUndo?.()} />
          ) : (
            <>
            {rampNote && <RunRampInner />}
            {(interactive || onSkip) && (
            <div className="trm-sess-cta">
              {onSkip && (
                <button type="button" className="trm-skact np-press" onClick={onSkip}>
                  <Icon3D name="t-skip" size={18} />{skipLabel}
                </button>
              )}
              {interactive && (
                <button type="button" className="trm-pill np-press" onClick={onLog}>
                  {ctaLabel}<span aria-hidden="true"> ›</span>
                </button>
              )}
            </div>
            )}
            </>
          )}
        </>
      )}
    </section>
  )
}
