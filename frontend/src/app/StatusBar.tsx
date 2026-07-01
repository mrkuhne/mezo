import { StatusIcons } from '@/shared/ui/Icon'

export function StatusBar({ clock = '13:42' }: { clock?: string }) {
  return (
    <div className="status-bar">
      <span>{clock}</span>
      <StatusIcons />
    </div>
  )
}
