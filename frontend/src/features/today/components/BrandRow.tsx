import { Link } from 'react-router-dom'
import { BrandGlyph, Icon } from '@/shared/ui/Icon'

export function BrandRow() {
  return (
    <div className="row" style={{ padding: '10px 24px 4px', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="row gap-sm">
        <BrandGlyph size={20} />
        <span className="h-display" style={{ fontSize: 18, letterSpacing: '0.1em' }}>Mezo</span>
      </div>
      <div className="row gap-sm">
        <button className="chip"><Icon name="search" size={12} /></button>
        <Link to="/insights" aria-label="Insights" className="icon-btn">
          <Icon name="sparkle" size={18} />
        </Link>
      </div>
    </div>
  )
}
