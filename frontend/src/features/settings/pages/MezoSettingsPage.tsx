import { Lines, SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'
export function MezoSettingsPage() {
  const t = useM().settings.mezo
  return <SettingsFrame title={t.title} subtitle={t.subtitle}>
    <section className="settings-wash glass"><p className="settings-editorial"><Lines text={t.editorial} /></p><p>{t.body}</p></section>
    <h2 className="settings-section-label">{t.common}</h2>
    <SettingsRows>
      <SettingsRow to="/settings/mezo/about" title={t.aboutRow.title} description={t.aboutRow.description} icon="t-person" badge={t.aboutRow.badge} />
      <SettingsRow to="/settings/mezo/communication" title={t.talkRow.title} description={t.talkRow.description} icon="t-chat" />
    </SettingsRows>
    <h2 className="settings-section-label">{t.open}</h2>
    <SettingsRows domain="nap"><SettingsRow to="/settings/mezo/context" title={t.contextRow.title} description={t.contextRow.description} icon="t-lens" domain="nap" /></SettingsRows>
    <div className="settings-gap" />
    <SettingsRows><SettingsRow to="/settings/notifications" title={t.signalsRow.title} description={t.signalsRow.description} icon="t-bell" /></SettingsRows>
  </SettingsFrame>
}
