import { cn } from '@/shared/lib/cn'
import type { AdminTableDescriptor } from '@/data/admin/adminDataApi'

// `.ad-pick` chip row — the raw-table selector on /admin/data (mezo-d5iy.12).
export function TablePicker({ tables, value, onChange }: {
  tables: AdminTableDescriptor[]
  value: string
  onChange: (table: string) => void
}) {
  return (
    <div className="ad-pick">
      <span className="lbl">Tábla</span>
      <div className="ad-chiprow">
        {tables.map((t) => (
          <button
            key={t.name}
            type="button"
            className={cn('ad-chip', value === t.name && 'on')}
            aria-pressed={value === t.name}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}
            onClick={() => onChange(t.name)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
