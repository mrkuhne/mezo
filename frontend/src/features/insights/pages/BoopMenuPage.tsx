import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'
import { GepteremHead } from '@/features/character/components/GepteremHead'
import '@/features/insights/boop-world.css'

/** The catalog's clay glyphs on the Titanium 3D set — mapped HERE, not in `CLAY_TO_3D`: several
 *  of these clay names mean something else on other screens (bible rule 20). The catalog itself
 *  stays clay-typed, it also feeds crosslinks elsewhere. */
const MENU_3D: Partial<Record<ClayIconName, Icon3DName>> = {
  'i-minta': 't-pattern',
  'i-kristaly': 't-orb',
  'i-muhely': 't-diagnose',
  'i-lombik': 't-flask',
  'i-heti': 't-calendar',
  'i-emberek': 't-person',
  'i-tudas': 't-book',
  'i-memoar': 't-album',
  'i-mezo': 't-council',
  'i-cel': 't-whistle',
  'i-level': 't-chat',
  'i-beallitas': 't-gear',
}

/** The Mozaik wash → the csapatfal accent class; the Gépterem's own neutral tile goes slate. */
const WASH_ACCENT: Record<MozaikWash, string> = {
  lav: 'lav', sky: 'sky', sage: 'sage', gold: 'gold', rose: 'rose', white: 'slate', coral: 'rose', most: 'rose',
}

/** „Összes funkció” — the old 12-tile menu, now the Gépterem's dev-menu (spec §2.4, mezo-a9bo7.10).
 *  Üveg re-dress (U9, mezo-me75u.9): `uveg-mezo-teljes-u9.js` `osszes()` — a 2-col grid of glass
 *  tiles, each in its own wash accent with a 3D icon. */
export function BoopMenuPage() {
  const navigate = useNavigate()
  return (
    <section className="tf-page gtm-page gtm-menu-page" aria-labelledby="boop-menu-title">
      <GepteremHead small="A Gépterem mellől" title="Összes funkció" titleId="boop-menu-title"
        onBack={() => navigate('/mezo/karakter/gepterem')} />
      <p className="gtm-lede">Minden ismerős eszközöd egy helyen, a saját nevén.</p>
      <EntranceGroup className="gtm-menu">
        {BOOP_DESTINATIONS.map((item, index) => {
          const art = MENU_3D[item.icon] ?? 't-grid'
          return (
            <Link key={item.to} to={item.to} aria-label={item.label}
              className={`glass tf-c-${WASH_ACCENT[item.wash]} gtm-tile rise`}
              style={{ '--d': `${index * 35}ms` } as CSSProperties}>
              <Icon3D name={art} size={52} />
              <strong>{item.label}</strong><span>{item.description}</span>
            </Link>
          )
        })}
      </EntranceGroup>
    </section>
  )
}
