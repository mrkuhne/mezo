import { useState } from 'react'
import { useAccountSettings } from '@/data/hooks'
import { SettingsFrame } from '@/features/settings/components/SettingsFrame'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { useM } from '@/shared/i18n'
import '@/features/settings/personal-settings.css'

export function AccountSettingsPage() {
  const t = useM().settings.account
  const query = useAccountSettings()
  const [draft, setDraft] = useState<{ name: string; email: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const values = draft ?? query.data
  const dirty = !!draft && (draft.name !== query.data?.name || draft.email !== query.data?.email)
  return <SettingsFrame title={t.title} subtitle={t.subtitle} domain="me" parent="/settings/general">
    <UnsavedChangesGuard dirty={dirty} />
    {query.isError ? <p role="alert">{t.loadError} <button onClick={() => void query.refetch()}>{t.retry}</button></p> : !values ? <p role="status">{t.loading}</p> : <form className="personal-editor settings-account glass" onSubmit={async event => {
      event.preventDefault()
      try { await query.save({ name: values.name.trim(), email: values.email.trim() }); setDraft(null); setSaved(true) } catch { setSaved(false) }
    }}>
      <label>{t.name}<input disabled={query.saving} required maxLength={120} autoComplete="name" value={values.name} onChange={e => { setDraft({ name: e.target.value, email: values.email }); setSaved(false) }} /></label>
      <label>{t.email}<input disabled={query.saving} required type="email" maxLength={255} autoComplete="email" value={values.email} onChange={e => { setDraft({ name: values.name, email: e.target.value }); setSaved(false) }} /></label>
      {query.saveError && <p role="alert">{t.saveError}</p>}
      {saved && <p role="status">{t.saved}</p>}
      <button type="submit" className="cta-primary" disabled={!dirty || query.saving || !values.name.trim()}>{query.saving ? t.saving : t.save}</button>
    </form>}
  </SettingsFrame>
}
