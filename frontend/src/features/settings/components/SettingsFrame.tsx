import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import '@/features/settings/settings.css'

export function useSettingsOrigin() {
  const { state } = useLocation()
  const candidate = (state as { from?: unknown } | null)?.from
  const from = typeof candidate === 'string' && /^\/(nap|train|fuel|mezo|me)(\/|\?|$)/.test(candidate) ? candidate : '/nap'
  const hasOrigin = from === candidate
  return { from, state: { from: hasOrigin ? from : undefined }, hasOrigin }
}

export function SettingsFrame({ title, subtitle, domain = 'mezo', parent = '/settings', children }: {
  title: string; subtitle: string; domain?: BoopDomain; parent?: string | null; children: ReactNode
}) {
  const origin = useSettingsOrigin()
  return <main className={`settings-page settings-${domain}`}>
    <nav className="settings-breadcrumb"><Link to={parent ?? origin.from} state={origin.state} aria-label={parent ? 'Vissza a beállításokhoz' : 'Vissza az oldalra'}>‹ {parent ? 'Beállítások' : 'Vissza'}</Link><span>SAJÁT RITMUSODRA</span></nav>
    <header className="settings-hero"><div><span className="settings-kicker">MEZO · BEÁLLÍTÁSOK</span><h1>{title}</h1><p>{subtitle}</p></div><Boop domain={domain} size={94} /></header>
    {children}
  </main>
}

export function SettingsRow({ to, title, description, domain = 'mezo', badge }: {
  to: string; title: string; description: string; domain?: BoopDomain; badge?: string
}) {
  const { state } = useSettingsOrigin()
  return <Link className={`settings-row settings-${domain}`} to={to} state={state}><span className="settings-row-art"><Boop domain={domain} size={34} /></span><span className="settings-row-copy"><strong>{title}</strong><small>{description}</small>{badge && <em>{badge}</em>}</span><span aria-hidden="true">›</span></Link>
}
