import { Icon, type IconName } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'

interface EntryCardProps {
  icon: IconName
  iconSize?: number
  color: string
  eyebrow: string
  eyebrowBrand?: boolean
  display: string
  tertiary: string
  onClick: () => void
}

export function EntryCard({
  icon,
  iconSize = 16,
  color,
  eyebrow,
  eyebrowBrand = false,
  display,
  tertiary,
  onClick,
}: EntryCardProps) {
  return (
    <button
      onClick={onClick}
      className="card notch-12"
      style={{ padding: 0, width: '100%', textAlign: 'left', overflow: 'hidden', background: 'var(--surface-1)' }}
    >
      <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col">
          <div className="row gap-sm">
            <Icon name={icon} size={iconSize} color={color} />
            {eyebrowBrand ? (
              <Eyebrow brand>{eyebrow}</Eyebrow>
            ) : (
              <span className="eyebrow" style={{ color }}>{eyebrow}</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 17, marginTop: 6 }}>{display}</div>
          <span className="text-tertiary" style={{ fontSize: 11, marginTop: 4 }}>{tertiary}</span>
        </div>
        <Icon name="chevron-right" size={20} color={color} />
      </div>
    </button>
  )
}
