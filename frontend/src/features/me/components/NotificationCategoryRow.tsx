import { Toggle } from '@/shared/ui/Toggle'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { NotificationPrefView } from '@/data/types'

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
 * One settings-list row for a push-notification category (mockup direction C, §2 "A ·
 * Kategória-lista"). Presentational only — no `@/data/*Hooks`/`@/data/hooks` import: label,
 * emoji and lead-chip visibility come from `NOTIFICATION_CATEGORY_META` (data/types.ts), so
 * this file never hardcodes Hungarian copy; the sub-line is either the caller-supplied derived
 * `subLine` or that same meta's static description. bd mezo-h4wp.6.2/.3.
 */
export function NotificationCategoryRow({ pref, onToggle, disabled = false, subLine }: NotificationCategoryRowProps) {
  const meta = NOTIFICATION_CATEGORY_META[pref.category]
  return (
    <div className="row gap-sm" style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
      <div
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          background: `var(${meta.iconBg})`,
          filter: pref.enabled ? 'none' : 'grayscale(1)',
          opacity: pref.enabled ? 1 : 0.45,
        }}
      >
        {meta.emoji}
      </div>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: pref.enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {meta.label}
        </span>
        <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
          {subLine ?? meta.description}
        </span>
      </div>
      {meta.showLeadChip && pref.enabled && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            background: 'var(--warm)',
            border: '1px solid var(--line)',
            padding: '6px 8px',
            borderRadius: 999,
            flex: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          −{pref.leadMinutes} perc
        </span>
      )}
      <Toggle on={pref.enabled} onToggle={onToggle} ariaLabel={meta.label} disabled={disabled} />
    </div>
  )
}
