import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import type { RecoveryPeriod } from '@/data/train/recoveryApi'
import type { PlannedSkip } from '@/features/train/logic/plannedSkips'
import { KIMELO, reasonOf, recoveryIcon, skipEffect, skipLabel } from '@/features/train/logic/skipCopy'
import { categoryCopy, estimateCopy } from '@/features/train/logic/recovery'

/**
 * What a skipped planned occurrence shows instead of its start CTA (Kihagyás S1, mezo-q4xt2.1 —
 * prototype elo/edzes.html `skBlock()`): the reason's 3D icon (or the skip mark), „Kihagyva ·
 * {reason}", the calm effect line (the free-pass shield when the week's pass covers it), then
 * „Másik ok"/„Okot adok" and „Visszavonom". `inner` is the flat variant for use inside a glass
 * card (never glass in glass); the default wears its own glass (the Today hero). Styles:
 * prototype.css `── Kihagyás S1`.
 */
export function SkippedBlock({ skip, inner, onReason, onUndo }: {
  skip: PlannedSkip
  inner?: boolean
  onReason(): void
  onUndo(): void
}) {
  // An advice skip (coach suggestion) reads as reasonless: t-skip icon, „Okot adok".
  const reason = skip.source === 'ADVICE' ? undefined : reasonOf(skip)
  return (
    <>
      <div className={cn('trm-skipd', inner ? 'is-in' : 'glass')}>
        <Icon3D name={reason?.icon ?? 't-skip'} size={inner ? 28 : 34} />
        <span>
          <b>Kihagyva · {skipLabel(skip)}</b>
          <small>
            {skip.freePass && skip.source === 'USER' && <Icon3D name="t-shield" size={15} />}
            {skipEffect(skip)}
          </small>
        </span>
      </div>
      <div className="trm-skacts">
        <button type="button" className="trm-skact np-press" onClick={onReason}>
          {reason ? 'Másik ok' : 'Okot adok'}
        </button>
        <button type="button" className="trm-skact np-press" onClick={onUndo}>
          <Icon3D name="t-repeat" size={18} />Visszavonom
        </button>
      </div>
    </>
  )
}

/**
 * The `recovery` variant (Kímélő mód S2, mezo-q4xt2.2 — prototype elo/edzes.html `kmHero()`): the
 * gym hero on a protected day. The category icon, „{Beteg vagy} · becslés: {2–3 nap}", the calm
 * sub-line, then „Ma mégis edzek" / „Jobban vagyok". Once the estimate has passed (and today's
 * check-in is not in yet) it asks „A becsült idő letelt — hogy vagy?" with Jobban vagyok / Még nem,
 * and „Ma mégis edzek" steps down to a quiet link. Presentational: the page owns the writes.
 */
export function RecoveryBlock({ period, busy, onRelease, onBetter, onNotYet }: {
  period: Pick<RecoveryPeriod, 'category' | 'estimate' | 'estimateExpired' | 'checkedInToday'>
  busy?: boolean
  onRelease(): void
  onBetter(): void
  onNotYet(): void
}) {
  const who = categoryCopy(period.category) ?? KIMELO.innerTitle
  const ask = period.estimateExpired && !period.checkedInToday
  const better = (
    <button type="button" className="trm-pill np-press" style={{ '--c': 'var(--dv-sage)' } as CSSProperties}
      disabled={busy} onClick={onBetter}>
      <Icon3D name="t-tick" size={18} />Jobban vagyok
    </button>
  )
  return (
    <>
      <div className="trm-skipd glass">
        <Icon3D name={recoveryIcon(period.category)} size={34} />
        <span>
          <b>{who} · {estimateCopy(period.estimate, period.estimateExpired)}</b>
          <small>{KIMELO.heroSub}</small>
          {ask && <em className="trm-kmq">{KIMELO.ask}</em>}
        </span>
      </div>
      <div className="trm-skacts">
        {ask ? (
          <>
            {better}
            <button type="button" className="trm-skact np-press" disabled={busy} onClick={onNotYet}>Még nem</button>
          </>
        ) : (
          <>
            <button type="button" className="trm-skact np-press" disabled={busy} onClick={onRelease}>
              <Icon3D name="t-dumbbell" size={18} />Ma mégis edzek
            </button>
            {better}
          </>
        )}
      </div>
      {ask && <button type="button" className="trm-kmlink" disabled={busy} onClick={onRelease}>Ma mégis edzek</button>}
    </>
  )
}

/** A protected occurrence inside a glass card (prototype `kmInner()`): flat, never glass in glass. */
export function KimeloInner() {
  return (
    <div className="trm-skipd is-in">
      <Icon3D name="t-kimelo" size={28} />
      <span><b>{KIMELO.innerTitle}</b><small>{KIMELO.innerSub}</small></span>
    </div>
  )
}

/** The next planned run during the comeback (prototype `rCb` card): „Visszatérő futás". */
export function RunRampInner() {
  return (
    <div className="trm-skipd is-in">
      <Icon3D name="t-sprout" size={28} />
      <span><b>{KIMELO.runRampTitle}</b><small>{KIMELO.runRamp}</small></span>
    </div>
  )
}
