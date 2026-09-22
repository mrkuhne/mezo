import { Link } from 'react-router-dom'
import { Boop, ClayIcon } from '@/shared/ui/clay'
import { DimensionsPage } from '@/features/character/pages/DimensionsPage'
import '@/features/insights/boop-world.css'

export function BoopAboutPage() {
  return (
    <div className="boop-world-social">
      <div className="boop-world-page">
        <header className="boop-world-heading">
          <div><span className="mz-eyebrow">Te is alakítod a képet</span><h1>Rólad</h1></div>
          <Boop domain="me" size={60} alive />
        </header>
        <nav className="boop-world-links" aria-label="Személyes tudás">
          <Link to="/mezo/knowledge"><ClayIcon name="i-tudas" size={22} />Tudástár</Link>
          <Link to="/settings/mezo/communication"><ClayIcon name="i-level" size={22} />Így beszélj velem</Link>
          <Link to="/mezo/knowledge?view=kategoriak"><ClayIcon name="i-retegek" size={22} />Kapcsolatok</Link>
        </nav>
      </div>
      <DimensionsPage embedded />
    </div>
  )
}
