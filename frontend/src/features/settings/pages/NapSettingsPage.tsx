import { useSleepGoal } from '@/data/hooks'
import { Lines, SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'
export function NapSettingsPage() {
  const t = useM().settings.nap
  const { goal, isPending, isError } = useSleepGoal()
  return <SettingsFrame title={t.title} subtitle={t.subtitle} domain="nap">
    <section className="settings-wash glass"><p className="settings-editorial"><Lines text={t.editorial} /></p>{!isPending && !isError && goal.isSet ? <div className="settings-stats"><div><strong>{goal.wakeTime}</strong><small>{t.wake}</small></div><div><strong>{goal.bedTime}</strong><small>{t.rest}</small></div></div> : <p>{isPending ? t.loading : isError ? t.loadError : t.unset}</p>}</section>
    <SettingsRows domain="nap">
      <SettingsRow to="/settings/me/sleep" title={t.wakeRow.title} description={t.wakeRow.description} icon="t-dawn" domain="nap" />
      <SettingsRow to="/settings/notifications" title={t.checkinRow.title} description={t.checkinRow.description} icon="t-bell" domain="nap" />
      <SettingsRow to="/settings/fuel" title={t.mealRow.title} description={t.mealRow.description} icon="t-plate" domain="fuel" />
    </SettingsRows>
    <p className="settings-note">{t.note}</p>
  </SettingsFrame>
}
