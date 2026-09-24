import { SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
export function MezoSettingsPage() {
  return <SettingsFrame title="Mezo és te" subtitle="Legyen világos, mit tud rólad. És hogyan szóljon hozzád.">
    <section className="settings-wash glass"><p className="settings-editorial">Egy közös alap,<br />amit te is alakítasz.</p><p>A személyes adataid, a saját szavaid és Mezo tanult kommunikációs mintái külön is ellenőrizhetők.</p></section>
    <h2 className="settings-section-label">A KÖZÖS NYELVÜNK</h2>
    <SettingsRows>
      <SettingsRow to="/settings/mezo/about" title="Rólam" description="Alapadatok, élethelyzet és ami fontos neked" icon="t-person" badge="Te alakítod" />
      <SettingsRow to="/settings/mezo/communication" title="Így beszélj velem" description="Saját instrukció és tanult kommunikációs minta" icon="t-chat" />
    </SettingsRows>
    <h2 className="settings-section-label">ÁTLÁTHATÓ MŰKÖDÉS</h2>
    <SettingsRows domain="nap"><SettingsRow to="/settings/mezo/context" title="Ezt kapja meg Mezo" description="A mentett személyes kontextusod, egyben" icon="t-lens" domain="nap" /></SettingsRows>
    <div className="settings-gap" />
    <SettingsRows><SettingsRow to="/settings/notifications" title="Mezo jelzései" description="Üzenetek, felismerések és összefoglalók" icon="t-bell" /></SettingsRows>
  </SettingsFrame>
}
