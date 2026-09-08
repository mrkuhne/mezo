import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { AdminUserInsightResponse } from '@/data/admin/adminInsightsApi'
import { heatColor, testerStatus, type TesterStatus } from '@/features/admin/lib/adminViz'
import { huInt, usd } from '@/shared/lib/huNum'
import type { MozaikWash } from '@/shared/ui/mozaik'

// TesterCard (mezo-zde2 Task 2) — the Emberek list's default view, one card per tester. Ported
// idiom, not new invention: the 90-day heat strip reuses `.ad-heat`/`heatColor` from the User
// részlet detail page (AdminUserDetailPage.tsx's `HeatStrip`) verbatim, just against the flat
// `activityByDay` array the list row already carries (Task 1) instead of a per-domain series
// that needs summing first. The status chip reuses the shared `.ad-tag` tone vocabulary
// (FeatureScoreRow.tsx's own precedent) rather than inventing a fifth color language.
export const STATUS_LABEL: Record<TesterStatus, string> = {
  aktiv: 'Aktív',
  csendesedik: 'Csendesedik',
  lemorzsolodott: 'Lemorzsolódott',
  meg_nem_aktiv: 'Még nem aktív',
}

// Reuses the shared `.ad-tag` tone vocabulary: sage/ok = healthy, gold/warn = early warning,
// coral/bad = churned, muted/mut = no signal yet.
export const STATUS_TONE: Record<TesterStatus, string> = {
  aktiv: 'ok',
  csendesedik: 'warn',
  lemorzsolodott: 'bad',
  meg_nem_aktiv: 'mut',
}

// Final review (WASH) — the same tone vocabulary as `STATUS_TONE`, but as a `MozaikWash` for the
// Emberek summary-strip cells (AdminUsersPage): each status cell now carries its own tinted
// tile instead of all four sharing a flat coral wash. `MozaikWash` has no plain "muted" — `white`
// is its neutral wash, used for "még nem aktív" (no signal, not a warning color).
export const STATUS_WASH: Record<TesterStatus, MozaikWash> = {
  aktiv: 'sage',
  csendesedik: 'gold',
  lemorzsolodott: 'coral',
  meg_nem_aktiv: 'white',
}

export function TesterCard({
  user,
  now = new Date(),
  delayMs,
}: {
  user: AdminUserInsightResponse
  /** Injectable clock so a snapshot/test never depends on the real one. */
  now?: Date
  /** Entrance-choreography stagger delay (mezo-zde2 Task 2), same `--d` CSS var recipe as the
   *  detail page's own heat strip cells. */
  delayMs?: number
}) {
  const lastActivityAt = user.lastActivityAt ?? null
  const status = testerStatus(lastActivityAt, now)
  const days = lastActivityAt === null
    ? null
    : Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000)
  const max = Math.max(1, ...user.activityByDay)
  // A user with companion turned off never casts a companion vote either — this list row's
  // `feedbackUp`/`feedbackDown` are plain counts with no third "off" state, so 0/0 here is
  // ambiguous between "companion is off" and "companion is on but nobody voted yet". The
  // per-user Visszajelzések tab (Task 3, `AdminUserFeedbackResponse`) is the ledger-known place
  // that actually distinguishes the two (`surfaces: null` vs `[]`); this card just mutes the
  // balance rather than claiming false precision.
  const hasFeedback = user.feedbackUp > 0 || user.feedbackDown > 0

  return (
    <Link
      to={`/admin/users/${user.id}`}
      className="ad-testercard"
      style={delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as CSSProperties) : undefined}
    >
      <div className="ad-cell">
        <span className="ad-avatar" style={{ background: '#A84A26' }}>{(user.name || '?').charAt(0).toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{user.name}</div>
          <span className={`ad-tag ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div className="ad-heat sm">
        {user.activityByDay.map((v, i) => (
          <i key={i} style={{ background: heatColor(v, max), ['--d' as string]: `${(i * 0.003).toFixed(3)}s` } as CSSProperties} />
        ))}
      </div>
      <div className="foot">
        <span className={days === null ? 'ad-mut' : undefined}>
          {days === null ? 'még nem aktív' : `utoljára: ${days} napja`}
        </span>
        <span className={user.cost30dUsd === 0 ? 'ad-mut' : undefined}>{usd(user.cost30dUsd)}</span>
        <span className={hasFeedback ? 'helped' : 'helped ad-mut'}>
          <span className={hasFeedback ? 'up' : undefined}>▲{huInt(user.feedbackUp)}</span>
          {' '}
          <span className={hasFeedback ? 'down' : undefined}>▼{huInt(user.feedbackDown)}</span>
        </span>
      </div>
    </Link>
  )
}
