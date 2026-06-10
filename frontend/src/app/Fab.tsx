import { cn } from '@/lib/cn'
import { Icon } from '@/components/ui/Icon'

export function Fab({ onClick, pulsing = false }: { onClick: () => void; pulsing?: boolean }) {
  return (
    <button className={cn('fab', pulsing && 'pulsing')} onClick={onClick} aria-label="Gyors rögzítés">
      <Icon name="mic" size={26} />
    </button>
  )
}
