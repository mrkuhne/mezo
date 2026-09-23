import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

/** „Összes funkció” — the old 12-tile menu, now the Gépterem's dev-menu (spec §2.4, mezo-a9bo7.10). */
export function BoopMenuPage() {
  const navigate = useNavigate()
  return (
    <section className="boop-world-page" aria-labelledby="boop-menu-title">
      <PageHead onBack={() => navigate('/mezo/karakter/gepterem')} label="‹ Gépterem" />
      <header className="boop-world-heading">
        <div><span className="mz-eyebrow">A Gépterem mellől</span><h1 id="boop-menu-title">Összes funkció</h1></div>
      </header>
      <p className="boop-world-intro">Minden ismerős eszközöd egy helyen, a saját nevén.</p>
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
