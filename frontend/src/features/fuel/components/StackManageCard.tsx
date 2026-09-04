import type { ClayIconName } from '@/shared/ui/clay'
import { Tile, type MozaikWash } from '@/shared/ui/mozaik'

interface StackManageCardProps {
  icon: Extract<ClayIconName, 'i-stack' | 'i-idozito' | 'i-recept' | 'i-kamra'>
  wash: MozaikWash
  title: string
  detail: string
  onClick: () => void
}

export function StackManageCard({ icon, wash, title, detail, onClick }: StackManageCardProps) {
  return (
    <Tile
      wide wash={wash} icon={icon} eyebrow={title} line={detail}
      aria-label={title} onClick={onClick} className="stk-manage-card"
    />
  )
}
