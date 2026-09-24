import { useSleepGoal } from '@/data/hooks'
import { SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
export function NapSettingsPage() {
  const { goal, isPending, isError } = useSleepGoal()
  return <SettingsFrame title="Nap" subtitle="A ritmus, ami összefogja a napodat." domain="nap">
    <section className="settings-wash glass"><p className="settings-editorial">Jó reggeltől<br />a lecsendesedésig.</p>{!isPending && !isError && goal.isSet ? <div className="settings-stats"><div><strong>{goal.wakeTime}</strong><small>Ébredés</small></div><div><strong>{goal.bedTime}</strong><small>Pihenés</small></div></div> : <p>{isPending ? 'A napi ritmusod betöltése…' : isError ? 'A napi ritmusod most nem elérhető.' : 'Állítsd be a saját ébredési vagy lefekvési idődet.'}</p>}</section>
    <SettingsRows domain="nap">
      <SettingsRow to="/settings/me/sleep" title="Ébredés és lefekvés" description="Közös az alváscéllal · egy helyen módosítható" icon="t-dawn" domain="nap" />
      <SettingsRow to="/settings/notifications" title="Check-in és napzárás" description="Mikor szóljon, és mely jelzések maradjanak" icon="t-bell" domain="nap" />
      <SettingsRow to="/settings/fuel" title="Étkezési ritmus" description="Étkezések száma, koffein és időablakok" icon="t-plate" domain="fuel" />
    </SettingsRows>
    <p className="settings-note">A rutinjaid konkrét lépéseit továbbra is a Rutin oldalon szerkeszted. Itt a közös napi ritmus és az emlékeztetők kapnak helyet.</p>
  </SettingsFrame>
}
