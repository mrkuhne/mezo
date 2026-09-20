import { useState } from 'react'
import { useBiometricProfile, useSleepGoal } from '@/data/hooks'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'
import { SettingsFrame, SettingsRow } from '@/features/settings/components/SettingsFrame'

export function MeSettingsPage({ editor }: { editor?: 'biometrics' | 'sleep' }) {
  const { profile, isLoading, isError: profileError, refetch: retryProfile } = useBiometricProfile()
  const { goal, isPending, isError: sleepError, refetch: retrySleep } = useSleepGoal()
  const [open, setOpen] = useState(!!editor)
  const loading = editor === 'biometrics' ? isLoading : isPending
  const error = editor === 'biometrics' ? profileError : sleepError
  return <SettingsFrame title={editor === 'biometrics' ? 'Testprofil' : editor === 'sleep' ? 'Alvás és napi ritmus' : 'Én'} subtitle="A tested, a céljaid, a pihenésed." domain="me" parent={editor ? '/settings/me' : '/settings'}>
    <section className="settings-wash"><p className="settings-editorial">Az alapok változnak.<br />A beállításaid követhetik.</p><div className="settings-stats"><div><strong>{isLoading ? '…' : profileError ? 'Nem elérhető' : profile?.heightCm ? `${profile.heightCm} cm` : 'Nincs megadva'}</strong><small>Magasság · testprofil</small></div><div><strong>{isPending ? '…' : sleepError ? 'Nem elérhető' : goal.isSet ? `${goal.targetMinutes / 60} óra` : 'Nincs saját cél'}</strong><small>Alváscél</small></div></div></section>
    {editor && error && <p role="alert" className="settings-status">Nem sikerült betölteni az adatokat. <button onClick={() => void (editor === 'biometrics' ? retryProfile() : retrySleep())}>Újrapróbálás</button></p>}
    {editor && <button className="settings-open-button" disabled={loading || error} onClick={() => setOpen(true)}>{loading ? 'Adatok betöltése…' : editor === 'biometrics' ? 'Testprofil szerkesztése' : 'Alváscél szerkesztése'}</button>}
    <SettingsRow to="/settings/me/biometrics" title="Testprofil" description="Magasság, születési dátum, testzsír és aktivitás" domain="me" />
    <SettingsRow to="/settings/me/goal" title="Súlycél" description="Céltestsúly, vállalható tempó és számított céldátum" domain="train" />
    <SettingsRow to="/settings/me/sleep" title="Alvás és napi horgony" description={goal.isSet && !isPending ? `${goal.bedTime} lefekvés · ${goal.wakeTime} ébredés` : 'Alvásidő, ébredés és lefekvés'} />
    <SettingsRow to="/settings/mezo/about" title="Mit tud rólam Mezo?" description="Ugyanezek az adatok a személyes alaplapodon" domain="nap" />
    {open && !loading && !error && editor === 'biometrics' && <BiometricSheet profile={profile} onClose={() => setOpen(false)} />}
    {open && !loading && !error && editor === 'sleep' && <SleepGoalSheet onClose={() => setOpen(false)} />}
  </SettingsFrame>
}
