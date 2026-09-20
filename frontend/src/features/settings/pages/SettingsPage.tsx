import { Link } from 'react-router-dom'
import { Boop, type BoopDomain } from '@/shared/ui/clay/boop/Boop'
import { SettingsFrame, SettingsRow, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'

const domains: { id: BoopDomain; title: string; description: string; detail: string }[] = [
  { id: 'fuel', title: 'Fuel', description: 'Táplálkozás, ahogy neked jó.', detail: 'Kalória és makrók · étkezési ritmus' },
  { id: 'train', title: 'Train', description: 'Helyet a mozgásnak.', detail: 'Gym-időpontok · rendszeres sport' },
  { id: 'mezo', title: 'Mezo', description: 'A közös nyelvünk.', detail: 'Rólam · instrukciók · személyes kontextus' },
  { id: 'me', title: 'Én', description: 'A tested. A céljaid.', detail: 'Testprofil · súlycél · alvás' },
  { id: 'nap', title: 'Nap', description: 'Jó reggeltől a pihenésig.', detail: 'Napi horgonyok · emlékeztetők' },
]
export function SettingsPage() {
  const origin = useSettingsOrigin()
  const current = origin.hasOrigin ? domains.find(d => new RegExp(`^/${d.id}(?:/|\\?|$)`).test(origin.from)) : undefined
  return <SettingsFrame title="Legyen a tiéd." subtitle="Egy helyen minden, ami hozzád igazítja a Mezót." parent={null}>
    {current && <Link className={`settings-current settings-${current.id}`} to={`/settings/${current.id}`} state={origin.state}><Boop domain={current.id} size={56} /><div><span className="settings-kicker">Innen érkeztél</span><strong>{current.title}</strong><p>{current.detail}</p></div><span aria-hidden="true">↗</span></Link>}
    <h2 className="settings-section-label">A TE TERÜLETEID</h2>
    <div className="settings-domain-grid">{domains.map(d => <Link key={d.id} className={`settings-domain settings-${d.id}`} to={`/settings/${d.id}`} state={origin.state}><Boop domain={d.id} size={58} /><strong>{d.title}</strong><p>{d.description}</p><small>{d.detail}</small><span className="settings-domain-arrow" aria-hidden="true">↗</span></Link>)}</div>
    <h2 className="settings-section-label">AZ APP KÖRÜLÖTTED</h2>
    <SettingsRow to="/settings/notifications" title="Értesítések" description="Mikor és miről szóljon Mezo" domain="nap" />
    <SettingsRow to="/settings/general" title="Megjelenés és alkalmazás" description="Téma, kalauzok és fiókbeállítások" />
    <SettingsRow to="/settings/account" title="Fiókod" description="Név, e-mail és belépés" domain="me" />
    <p className="settings-footnote">Minden terület ugyanazokat az alapadatokat használja.<br />Amit itt javítasz, az appban is követ.</p>
  </SettingsFrame>
}
