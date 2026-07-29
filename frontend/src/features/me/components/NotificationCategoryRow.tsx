import { Toggle } from '@/shared/ui/Toggle'
import { NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { NotificationPrefView } from '@/data/types'

interface NotificationCategoryRowProps {
  pref: NotificationPrefView
  onToggle: () => void
  disabled?: boolean
}

/**
 * One settings-list row for a push-notification category (mockup direction C, §2 "A ·
 * Kategória-lista"). Presentational only — no `@/data/*Hooks`/`@/data/hooks` import: label,
 * emoji, description and lead-chip visibility all come from `NOTIFICATION_CATEGORY_META`
 * (data/types.ts), so this file never hardcodes Hungarian copy. bd mezo-h4wp.6.2.
 */
export function NotificationCategoryRow({ pref, onToggle, disabled = false }: NotificationCategoryRowProps) {
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
          {meta.description}
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
