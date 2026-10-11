import { useState } from 'react'
import { useBiometricProfile, useSleepGoal } from '@/data/hooks'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'
import { Lines, SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'

export function MeSettingsPage({ editor }: { editor?: 'biometrics' | 'sleep' }) {
  const t = useM().settings.me
  const { profile, isLoading, isError: profileError, refetch: retryProfile } = useBiometricProfile()
  const { goal, isPending, isError: sleepError, refetch: retrySleep } = useSleepGoal()
  const [energyOpen, setEnergyOpen] = useState(false)
  const energy = profile ? buildTdeeBreakdown(profile) : null
  const [open, setOpen] = useState(!!editor)
  const loading = editor === 'biometrics' ? isLoading : isPending
  const error = editor === 'biometrics' ? profileError : sleepError
  return <SettingsFrame title={editor === 'biometrics' ? t.titleBiometrics : editor === 'sleep' ? t.titleSleep : t.title} subtitle={t.subtitle} domain="me" parent={editor ? '/settings/me' : '/settings'}>
    <section className="settings-wash glass"><p className="settings-editorial"><Lines text={t.editorial} /></p><div className="settings-stats"><div><strong>{isLoading ? '…' : profileError ? t.unavailable : profile?.heightCm ? `${profile.heightCm} cm` : t.notSet}</strong><small>{t.heightLabel}</small></div><div><strong>{isPending ? '…' : sleepError ? t.unavailable : goal.isSet ? t.hours(goal.targetMinutes / 60) : t.noOwnGoal}</strong><small>{t.sleepGoalLabel}</small></div></div></section>
    {editor && error && <p role="alert" className="settings-status">{t.loadError} <button onClick={() => void (editor === 'biometrics' ? retryProfile() : retrySleep())}>{t.retry}</button></p>}
    {editor && <button className="settings-open-button" disabled={loading || error} onClick={() => setOpen(true)}>{loading ? t.loadingData : editor === 'biometrics' ? t.editBiometrics : t.editSleep}</button>}
    <SettingsRows domain="me">
      <SettingsRow to="/settings/me/biometrics" title={t.biometricsRow.title} description={t.biometricsRow.description} icon="t-person" domain="me" />
      <SettingsRow to="/settings/me/goal" title={t.goalRow.title} description={t.goalRow.description} icon="t-weight" domain="train" />
      <SettingsRow to="/settings/me/sleep" title={t.sleepRow.title} description={goal.isSet && !isPending ? t.sleepRowSet(goal.bedTime, goal.wakeTime) : t.sleepRow.description} icon="t-sleep" />
      <SettingsRow to="/settings/mezo/about" title={t.knowRow.title} description={t.knowRow.description} icon="t-lens" />
    </SettingsRows>
    {open && !loading && !error && editor === 'biometrics' && <BiometricSheet profile={profile} onClose={() => setOpen(false)} onExplainEnergy={energy ? () => { setOpen(false); setEnergyOpen(true) } : undefined} />}
    {open && !loading && !error && editor === 'sleep' && <SleepGoalSheet onClose={() => setOpen(false)} />}
    {energyOpen && energy && <EnergyBreakdownSheet breakdown={energy} initial="base" onClose={() => { setEnergyOpen(false); setOpen(true) }} />}
  </SettingsFrame>
}
