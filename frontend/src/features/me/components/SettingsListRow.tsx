import { Icon } from '@/components/ui/Icon'
import type { QuickSettingRow } from '@/data/types'

export function SettingsListRow({ row }: { row: QuickSettingRow }) {
  return (
    <button
      className="card notch-4 row"
      style={{ padding: 14, alignItems: 'center', textAlign: 'left', width: '100%' }}
    >
      <Icon name={row.icon} size={16} color="var(--text-secondary)" />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, marginLeft: 12 }}>{row.label}</span>
      <span className="text-tertiary" style={{ fontSize: 11, marginRight: 8 }}>{row.val}</span>
      <Icon name="chevron-right" size={14} color="var(--text-tertiary)" />
    </button>
  )
}
