import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Boop, ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

export function BoopMenuPage() {
  return (
    <section className="boop-world-page" aria-labelledby="boop-menu-title">
      <header className="boop-world-heading">
        <div><span className="mz-eyebrow">A te Boop-világod</span><h1 id="boop-menu-title">Menü</h1></div>
        <Boop domain="mezo" size={58} alive />
      </header>
      <p className="boop-world-intro">Merre nézzünk ma? Minden ismerős eszközöd egy helyen.</p>
      <EntranceGroup className="boop-world-menu">
        {BOOP_DESTINATIONS.map((item, index) => (
          <Link key={item.to} to={item.to} aria-label={item.label}
            className={`boop-world-tile mz-w-${item.wash} rise`}
            style={{ '--d': `${index * 35}ms` } as CSSProperties}>
            <ClayIcon name={item.icon} size={44} />
            <strong>{item.label}</strong><span>{item.description}</span>
          </Link>
        ))}
      </EntranceGroup>
    </section>
  )
}
