import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { Toggle } from '@/shared/ui/Toggle'
import { cn } from '@/shared/lib/cn'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'

/** One clay icon per category (mezo-d20.6.8 re-face) — a tile pass over the old flat
 *  emoji rows, house pattern (handoff §10 "Tile pass"). Chosen for the closest available
 *  Clay 3D icon (clay-icons.svg's 41-name set); no new sprite art needed for this slice. */
const CATEGORY_ICON: Record<NotificationCategoryKey, ClayIconName> = {
  briefing: 'i-hajnal',
  midday: 'i-mezo',
  weekly_review: 'i-naplo',
  memoir: 'i-naplo',
  gym: 'i-edzes',
  medication: 'i-injekcio',
  ritual: 'i-idozito',
  lights_out: 'i-alvas',
  wind_down: 'i-alvas',
  checkin: 'i-checkin',
  fuel_slot: 'i-fuel',
  evening: 'i-mezo',
  sleep_reaction: 'i-alvas',
  weight_reaction: 'i-suly',
  pattern: 'i-minta',
  knowledge: 'i-tudas',
  prediction: 'i-kristaly',
  experiment: 'i-lombik',
  challenge: 'i-kihivas',
  memory: 'i-retegek',
  decision_review: 'i-cel',
  intervention: 'i-cel',
}

interface NotificationCategoryRowProps {
  pref: NotificationPrefView
  onToggle: () => void
  disabled?: boolean
  /** A live, per-day sub-line derived by the page from the anchors it already has (gym time,
   *  ritual window, bed anchor, medication cycle day, …) — e.g. "ma 17:00 · Láb nap" instead of
   *  the generic "A mai edzés kezdete előtt". Omit (or pass the same static text) when the page
   *  genuinely has no live datum for this row; falls back to `NOTIFICATION_CATEGORY_META`'s
   *  static description, which stays the honest fallback, never a fabricated value. */
  subLine?: string
}

/**
 * One settings-list row for a push-notification category — the prototype's washed `.catrow`
 * (en-body.html §értesítés, ×1.18): a category-tinted tile (the row wears the SAME `--wash-*`
 * token `NOTIFICATION_CATEGORY_META.iconBg` already assigned it, rather than a second color
 * table) with a clay icon disc, not a flat list row. Presentational only — no `@/data/*Hooks`/
 * `@/data/hooks` import: label, icon and lead-chip visibility come from
 * `NOTIFICATION_CATEGORY_META` (data/types.ts), so this file never hardcodes Hungarian copy;
 * the sub-line is either the caller-supplied derived `subLine` or that same meta's static
 * description. bd mezo-h4wp.6.2/.3, mezo-d20.6.8.
 */
export function NotificationCategoryRow({ pref, onToggle, disabled = false, subLine }: NotificationCategoryRowProps) {
  const meta = NOTIFICATION_CATEGORY_META[pref.category]
  return (
    <div
      className={cn('ntf-catrow rise', !pref.enabled && 'off')}
      style={{ '--cw': `var(${meta.iconBg})` } as React.CSSProperties}
    >
      <span className="ntf-cic" aria-hidden="true">
        <ClayIcon name={CATEGORY_ICON[pref.category]} size={22} />
      </span>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <span className="ntf-cat-nm">{meta.label}</span>
        <span className="ntf-cat-sb">{subLine ?? meta.description}</span>
      </div>
      {meta.showLeadChip && pref.enabled && (
        <span className="ntf-leadch">−{pref.leadMinutes} perc</span>
      )}
      <Toggle on={pref.enabled} onToggle={onToggle} ariaLabel={meta.label} disabled={disabled} />
    </div>
  )
}
