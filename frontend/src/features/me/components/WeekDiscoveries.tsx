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
//
// Üveg (mezo-me75u.6): each tile is `.glass` in its tone, with Titanium 3D art. The status
// chips are flat and carry a 3D icon + the plain word; the old text glyphs (✓ ▲ ★ ◐ ✗) are
// gone, the meaning lives in the word itself (bible rules 16, 19).
//
// Drawers (mezo-p87ok): a real week held 72 traces, a flat wall nobody scrolls. The rare kinds
// (life events, memoir, predictions) stay whole tiles on top; patterns and new facts sit in two
// glass drawers that preview DRAWER_PREVIEW_ROWS flat rows and expand in place. Rows are flat
// (no glass inside glass) and keep the old tiles' links and status chips.
// ============================================================
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { huMonthDay } from '@/shared/lib/dates'
import type { WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'
import { DRAWER_PREVIEW_ROWS, drawerRows, hasRareTraces, patternBreakdown, riseDelay } from '@/features/me/logic/discoveryDrawers'

/** The digest's own `event` values (wire: confirmed | reinforced | promoted). An
 *  unknown kind renders the muted chip rather than a guess. */
interface StatusChip { label: string; chip: string; art?: Icon3DName }

const PATTERN_EVENT: Record<string, StatusChip> = {
  confirmed: { label: 'Megerősítve', chip: 'ok', art: 't-tick' },
  reinforced: { label: 'Erősödött', chip: 'lav', art: 't-up' },
  promoted: { label: 'Előléptetve', chip: 'warn', art: 't-record' },
}

/** Prediction outcome (wire: pending | validated | missed). `missed` is amber,
 *  never red — the floor is terracotta. */
const PREDICTION_STATUS: Record<string, StatusChip> = {
  pending: { label: 'Folyamatban', chip: 'lav', art: 't-clock' },
  validated: { label: 'Bevált', chip: 'ok', art: 't-tick' },
  missed: { label: 'Nem jött be', chip: 'warn', art: 't-skip' },
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
  /** `life`, never `sky`: a global dark-theme `.sky` rule (the daypart sky band) hid the
   *  life-event tile with display:none (mezo-p87ok). */
  tone: 'lav' | 'gold' | 'life' | 'rose' | 'pred'
  wide?: boolean
  icon: Icon3DName
  eyebrow: string
  title: string
  delayMs: number
  chip?: StatusChip
  meta?: string
  chev?: boolean
}

function DiscoveryTile({ to, tone, wide, icon, eyebrow, title, delayMs, chip, meta, chev }: TileProps) {
  return (
    <Link
      to={to}
      className={`wkd-tile ${tone}${wide ? ' wide' : ''} glass rise`}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
    >
      {/* Wide tiles put the icon, the text and the status chip on ONE row; half tiles
          stack them as flat grid children — the prototype's two `.dsct` shapes. */}
      {wide ? (
        <div className="wkd-row">
          <Icon3D name={icon} size={36} />
          <div className="wkd-grow">
            <div className={`wkd-eb ${tone}`}>{eyebrow}</div>
            <b>{title}</b>
          </div>
          {chip && <StatusChipView chip={chip} />}
          {chev && <span className="wkd-chev" aria-hidden="true">›</span>}
        </div>
      ) : (
        <>
          <Icon3D name={icon} size={36} />
          <div className={`wkd-eb ${tone}`}>{eyebrow}</div>
          <b>{title}</b>
        </>
      )}
      {meta && <span className="wkd-meta">{meta}</span>}
    </Link>
  )
}

function StatusChipView({ chip }: { chip: StatusChip }) {
  return (
    <span className={`wkd-stch ${chip.chip}`}>
      {chip.art && <Icon3D name={chip.art} size={16} />}{chip.label}
    </span>
  )
}

interface DrawerProps<T> {
  kind: 'patterns' | 'facts'
  tone: 'lav' | 'gold'
  icon: Icon3DName
  title: string
  /** „Mind a N minta ›" — the noun after the count. */
  noun: string
  sub: string
  items: readonly T[]
  delayMs: number
  row: (item: T) => React.ReactNode
}

/** One bulk kind as a glass drawer: icon, title, big count, the first rows, and an in-place
 *  expand toggle only when there is more to show. */
function DiscoveryDrawer<T>({ kind, tone, icon, title, noun, sub, items, delayMs, row }: DrawerProps<T>) {
  const [open, setOpen] = useState(false)
  const listId = `wkd-drawer-${kind}`
  return (
    <section
      className={`wkd-drawer ${tone} glass rise`}
      style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      aria-label={`${title} · ${items.length}`}
    >
      <div className="wkd-drhead">
        <Icon3D name={icon} size={36} />
        <div className="wkd-grow">
          <div className="wkd-drtitle">{title}</div>
          {sub && <div className="wkd-drsub">{sub}</div>}
        </div>
        <span className="wkd-drcount">{items.length}</span>
      </div>
      <div className="wkd-drows" id={listId}>{drawerRows(items, open).map(row)}</div>
      {items.length > DRAWER_PREVIEW_ROWS && (
        <button
          type="button" className="wkd-drmore" aria-expanded={open} aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Kevesebb ‹' : `Mind a ${items.length} ${noun} ›`}
        </button>
      )}
    </section>
  )
}

/** The page body. Renders nothing at all for an empty digest — the page owns the
 *  "Csendes hét volt" copy, so this never becomes an empty shell.
 *  `weekStart` (Task 11, mezo-zpxv7): a life-event tile is a "decide" link — the decision inbox
 *  now lives ONLY on Rólad, so it carries the week's `?start=` there instead of the retired
 *  Tudástár deep link. */
export function WeekDiscoveries({ digest, weekStart }: { digest: WeeklyReviewDigest | null; weekStart: string }) {
  if (digest == null || countDiscoveries(digest) === 0) return null
  let i = 0
  const next = () => riseDelay(i++)
  const bulk = digest.patterns.length > 0 || digest.newFacts.length > 0
  return (
    <>
      {hasRareTraces(digest) && (
        <>
          <div className="mz-eyebrow wkd-sec">A hét kiemelt nyomai</div>
          <div className="wkd-grid">
            {digest.lifeEvents.map((e) => (
              <DiscoveryTile
                key={`l-${e.id}`} to={`/mezo/rolad?start=${weekStart}`} tone="life"
                icon="t-pin" eyebrow="Életesemény" title={e.title} delayMs={next()}
                meta={huDayDot(e.occurredOn)}
              />
            ))}
            {digest.memoir && (
              <DiscoveryTile
                key="memoir" to="/mezo/memoir" tone="rose"
                icon="t-scroll" eyebrow="Emlékkönyv" title="Új bejegyzés készült a hétről"
                delayMs={next()} meta="olvasd el ›"
              />
            )}
            {digest.predictions.map((p) => (
              <DiscoveryTile
                key={`r-${p.id}`} to="/mezo/predictions" tone="pred" wide
                icon="t-orb" eyebrow="Előrejelzés" title={p.title} delayMs={next()}
                chip={PREDICTION_STATUS[p.status] ?? { label: p.status, chip: 'mut' }}
              />
            ))}
          </div>
        </>
      )}
      {bulk && <div className="mz-eyebrow wkd-sec">Amit a memória tanult</div>}
      {digest.patterns.length > 0 && (
        <DiscoveryDrawer
          kind="patterns" tone="lav" icon="t-pattern" title="Minták" noun="minta"
          sub={patternBreakdown(digest.patterns)} items={digest.patterns} delayMs={next()}
          row={(p) => (
            // pairKey is unique per ref since the backend folds events to one ref per pattern
            <Link key={`p-${p.pairKey}`} to={`/mezo/patterns/${p.pairKey}`} className="wkd-drow">
              <span className="wkd-grow">{p.title}</span>
              <StatusChipView chip={PATTERN_EVENT[p.event] ?? { label: p.event, chip: 'mut' }} />
            </Link>
          )}
        />
      )}
      {digest.newFacts.length > 0 && (
        <DiscoveryDrawer
          kind="facts" tone="gold" icon="t-book" title="Új tudás" noun="új tudás"
          sub="a legfrissebb elöl" items={digest.newFacts} delayMs={next()}
          row={(f) => (
            // The SPECIFIC fact, not the list — the id travels in the query so the
            // Tudástár can focus it.
            <Link key={`f-${f.id}`} to={`/mezo/knowledge?fact=${f.id}`} className="wkd-drow">
              <span className="wkd-grow">{f.text}</span>
              <span className="wkd-chev" aria-hidden="true">›</span>
            </Link>
          )}
        />
      )}
    </>
  )
}
