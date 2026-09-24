import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import '@/features/settings/settings.css'

export function useSettingsOrigin() {
  const { state } = useLocation()
  const candidate = (state as { from?: unknown } | null)?.from
  const from = typeof candidate === 'string' && /^\/(nap|train|fuel|mezo|me)(\/|\?|$)/.test(candidate) ? candidate : '/nap'
  const hasOrigin = from === candidate
  return { from, state: { from: hasOrigin ? from : undefined }, hasOrigin }
}

/** Üveg (mezo-me75u.7, prototype uveg-en2 `beall()`): a glass back pill + the „SAJÁT RITMUSODRA"
 *  tag, then a frameless halo hero in the domain accent — upright kicker/title/subtitle on the left,
 *  the domain's Boop tilted 7° on the right (owner decision 2026-09-24, „vegyes"). */
export function SettingsFrame({ title, subtitle, domain = 'mezo', parent = '/settings', children }: {
  title: string; subtitle: string; domain?: BoopDomain; parent?: string | null; children: ReactNode
}) {
  const origin = useSettingsOrigin()
  return <main className={`settings-page settings-${domain}`}>
    <nav className="settings-breadcrumb"><Link className="settings-back glass is-still" to={parent ?? origin.from} state={origin.state} aria-label={parent ? 'Vissza a beállításokhoz' : 'Vissza az oldalra'}><b aria-hidden="true">‹</b>{parent ? 'Beállítások' : 'Vissza'}</Link><span>SAJÁT RITMUSODRA</span></nav>
    <header className="settings-hero"><div><span className="settings-kicker">MEZO · BEÁLLÍTÁSOK</span><h1>{title}</h1><p>{subtitle}</p></div><Boop domain={domain} size={92} /></header>
    {children}
  </main>
}

/** One glass card per section: the rows inside it are flat, hairline-separated (prototype `.srows`).
 *  `domain` picks the card's accent. */
export function SettingsRows({ domain = 'mezo', children }: { domain?: BoopDomain; children: ReactNode }) {
  return <div className={`settings-rows glass settings-${domain}`}>{children}</div>
}

/** A flat row inside a `SettingsRows` card: a Titanium 3D icon in a lit 42px well (tinted by the
 *  row's `domain` accent), title + description, the chevron. */
export function SettingsRow({ to, title, description, icon, domain = 'mezo', badge }: {
  to: string; title: string; description: string; icon: Icon3DName; domain?: BoopDomain; badge?: string
}) {
  const { state } = useSettingsOrigin()
  return <Link className={`settings-row settings-${domain}`} to={to} state={state}><span className="settings-row-art uv-well"><Icon3D name={icon} size={28} /></span><span className="settings-row-copy"><strong>{title}</strong><small>{description}</small>{badge && <em>{badge}</em>}</span><span className="settings-chev" aria-hidden="true">›</span></Link>
}
