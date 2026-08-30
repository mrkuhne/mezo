// ============================================================
// Mezo · Heti felfedezések — the digest mosaic (mezo-d20.6.10)
// Source of truth: en-body.html #page-hdisc + discPage(), ×1.18.
//
// Rework of the mezo-p2tr link list. What changed is not the face but WHAT IT
// SAYS: the old list dropped every status the digest already carries. This one
// renders them — the pattern `event` (✓ Megerősítve / ▲ Erősödött / ★ Előléptetve),
// the life event's `occurredOn`, the prediction `status` (◐ Folyamatban / ✓ Bevált /
// ✗ Nem jött be) — and links a new fact to the SPECIFIC fact via `newFacts[].id`
// instead of dumping the reader on the list (audit §8.3).
//
// These are TRACES, not proposals: everything here already happened, by itself.
// That is the whole difference from /me/week/tanulsagok, and the head card in
// WeekDiscoveriesPage says so.
// ============================================================
import { Link } from 'react-router-dom'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { huMonthDay } from '@/shared/lib/dates'
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

/** The digest's own `event` values (wire: confirmed | reinforced | promoted). An
 *  unknown kind renders the muted chip rather than a guess. */
const PATTERN_EVENT: Record<string, { label: string; chip: string }> = {
  confirmed: { label: '✓ Megerősítve', chip: 'ok' },
  reinforced: { label: '▲ Erősödött', chip: 'lav' },
  promoted: { label: '★ Előléptetve', chip: 'warn' },
}

/** Prediction outcome (wire: pending | validated | missed). `missed` is amber,
 *  never red — the floor is terracotta. */
const PREDICTION_STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: '◐ Folyamatban', chip: 'lav' },
  validated: { label: '✓ Bevált', chip: 'ok' },
  missed: { label: '✗ Nem jött be', chip: 'warn' },
}

/** '2026-05-23' → 'máj 23.' (the prototype's life-event date face). */
function huDayDot(iso: string): string {
  return `${huMonthDay(iso).toLowerCase()}.`
}

export function countDiscoveries(digest: WeeklyReviewDigest | null): number {
  if (digest == null) return 0
  return digest.patterns.length + digest.newFacts.length + digest.lifeEvents.length
    + digest.predictions.length + (digest.memoir ? 1 : 0)
}

interface TileProps {
  to: string
  tone: 'lav' | 'gold' | 'sky' | 'rose' | 'pred'
  wide?: boolean
  icon: ClayIconName
  eyebrow: string
  title: string
  delayMs: number
  chip?: { label: string; chip: string }
  meta?: string
  chev?: boolean
}

function DiscoveryTile({ to, tone, wide, icon, eyebrow, title, delayMs, chip, meta, chev }: TileProps) {
  return (
    <Link
      to={to}
      className={`wkd-tile ${tone}${wide ? ' wide' : ''} rise`}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
    >
      {/* Wide tiles put the icon, the text and the status chip on ONE row; half tiles
          stack them as flat grid children — the prototype's two `.dsct` shapes. */}
      {wide ? (
        <div className="wkd-row">
          <span className="wkd-pic"><ClayIcon name={icon} size={20} /></span>
          <div className="wkd-grow">
            <div className={`wkd-eb ${tone}`}>{eyebrow}</div>
            <b>{title}</b>
          </div>
          {chip && <span className={`wkd-stch ${chip.chip}`}>{chip.label}</span>}
          {chev && <span className="wkd-chev" aria-hidden="true">›</span>}
        </div>
      ) : (
        <>
          <span className="wkd-pic"><ClayIcon name={icon} size={20} /></span>
          <div className={`wkd-eb ${tone}`}>{eyebrow}</div>
          <b>{title}</b>
        </>
      )}
      {meta && <span className="wkd-meta">{meta}</span>}
    </Link>
  )
}

/** The mosaic. Renders nothing at all for an empty digest — the page owns the
 *  "Csendes hét volt" copy, so this never becomes an empty shell. */
export function WeekDiscoveries({ digest }: { digest: WeeklyReviewDigest | null }) {
  if (digest == null || countDiscoveries(digest) === 0) return null
  let d = 40
  const next = () => (d += 30)
  return (
    <div className="wkd-grid">
      {digest.patterns.map((p) => (
        <DiscoveryTile
          key={`p-${p.pairKey}`} to={`/mezo/patterns/${p.pairKey}`} tone="lav" wide
          icon="i-minta" eyebrow="Minta" title={p.title} delayMs={next()}
          chip={PATTERN_EVENT[p.event] ?? { label: p.event, chip: 'mut' }}
        />
      ))}
      {digest.newFacts.map((f) => (
        <DiscoveryTile
          // The SPECIFIC fact, not the list — the id travels in the query so the
          // Tudástár can focus it (see the gap note in the slice report).
          key={`f-${f.id}`} to={`/mezo/knowledge?fact=${f.id}`} tone="gold" wide
          icon="i-tudas" eyebrow="Új tudás" title={f.text} delayMs={next()} chev
        />
      ))}
      {digest.lifeEvents.map((e) => (
        <DiscoveryTile
          key={`l-${e.id}`} to="/mezo/knowledge" tone="sky"
          icon="i-cel" eyebrow="Életesemény" title={e.title} delayMs={next()}
          meta={huDayDot(e.occurredOn)}
        />
      ))}
      {digest.memoir && (
        <DiscoveryTile
          key="memoir" to="/mezo/memoir" tone="rose"
          icon="i-memoar" eyebrow="Emlékkönyv" title="Új bejegyzés készült a hétről"
          delayMs={next()} meta="olvasd el ›"
        />
      )}
      {digest.predictions.map((p) => (
        <DiscoveryTile
          key={`r-${p.id}`} to="/mezo/predictions" tone="pred" wide
          icon="i-kristaly" eyebrow="Előrejelzés" title={p.title} delayMs={next()}
          chip={PREDICTION_STATUS[p.status] ?? { label: p.status, chip: 'mut' }}
        />
      ))}
    </div>
  )
}
