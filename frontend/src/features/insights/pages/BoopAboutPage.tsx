import { Link } from 'react-router-dom'
import { Boop, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { DimensionsPage } from '@/features/character/pages/DimensionsPage'
import '@/features/insights/boop-world.css'

// Üvegesítés U9 (mezo-me75u.9): the csapatfal heading (living Boop on the right), the three
// doors as glass rows with Titanium icons, then the dimensions under their own section heading.
const LINKS: { to: string; icon: Icon3DName; accent: string; name: string; sub: string }[] = [
  { to: '/mezo/knowledge', icon: 't-book', accent: 'sage', name: 'Tudástár', sub: 'tények, jelöltek, életesemények' },
  { to: '/settings/mezo/communication', icon: 't-chat', accent: 'lav', name: 'Így beszélj velem', sub: 'a saját kommunikációs kéréseid' },
  { to: '/mezo/knowledge?view=kategoriak', icon: 't-graph', accent: 'lav', name: 'Kapcsolatok', sub: 'a tudásod térképe' },
]

export function BoopAboutPage() {
  return (
    <div className="kr9-rolad">
      <header className="tf-head kr9-rhead">
        <div><small>Te is alakítod a képet</small><h1>Rólad</h1></div>
        <Boop domain="me" size={64} alive />
      </header>
      <nav className="tf-rows kr9-rlinks" aria-label="Személyes tudás">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className={`glass tf-rowg tf-c-${l.accent}`}>
            <Icon3D name={l.icon} size={40} />
            <span className="tf-rowtxt">
              <span className="tf-rowname">{l.name}</span>
              <span className="tf-rowsub">{l.sub}</span>
            </span>
            <span className="tf-rowbadge" aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>
      <DimensionsPage embedded />
    </div>
  )
}
