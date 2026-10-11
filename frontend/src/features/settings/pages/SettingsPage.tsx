import { Link } from 'react-router-dom'
import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { Lines, SettingsFrame, SettingsRow, SettingsRows, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'

const DOMAIN_IDS: BoopDomain[] = ['fuel', 'train', 'mezo', 'me', 'nap']
export function SettingsPage() {
  const origin = useSettingsOrigin()
  const t = useM().settings.hub
  const domains = DOMAIN_IDS.map(id => ({ id, ...t.domains[id as keyof typeof t.domains] }))
  const current = origin.hasOrigin ? domains.find(d => new RegExp(`^/${d.id}(?:/|\\?|$)`).test(origin.from)) : undefined
  return <SettingsFrame title={t.title} subtitle={t.subtitle} parent={null}>
    {current && <Link className={`settings-current glass settings-${current.id}`} to={`/settings/${current.id}`} state={origin.state}><Boop domain={current.id} size={48} /><div><span className="settings-kicker">{t.cameFrom}</span><strong>{current.title}</strong><p>{current.detail}</p></div><span aria-hidden="true">↗</span></Link>}
    <h2 className="settings-section-label">{t.areas}</h2>
    <div className="settings-domain-grid">{domains.map(d => <Link key={d.id} className={`settings-domain glass settings-${d.id}`} to={`/settings/${d.id}`} state={origin.state}><Boop domain={d.id} size={54} /><strong>{d.title}</strong><p>{d.description}</p><small>{d.detail}</small><span className="settings-domain-arrow" aria-hidden="true">↗</span></Link>)}</div>
    <h2 className="settings-section-label">{t.around}</h2>
    <SettingsRows domain="me">
      <SettingsRow to="/settings/notifications" title={t.notifications.title} description={t.notifications.description} icon="t-bell" domain="nap" />
      <SettingsRow to="/settings/general" title={t.general.title} description={t.general.description} icon="t-palette" domain="me" />
      <SettingsRow to="/settings/account" title={t.account.title} description={t.account.description} icon="t-key" domain="nap" />
    </SettingsRows>
    <p className="settings-footnote"><Lines text={t.footnote} /></p>
  </SettingsFrame>
}
