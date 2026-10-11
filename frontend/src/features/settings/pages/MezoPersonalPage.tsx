import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanionPreferences, usePersonalContext, useKnowledgeGraphNodes, useKnowledgeGraphActions } from '@/data/hooks'
import type { CompanionPreferences } from '@/data/companion/preferencesApi'
import { isMockMode } from '@/data/_client/mode'
import { SettingsFrame, SettingsRow, SettingsRows, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { ProfileNodeCard } from '@/features/insights/components/ProfileNodeCard'
import { Icon3D } from '@/shared/ui/clay'
import '@/features/settings/personal-settings.css'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import { useM } from '@/shared/i18n'

type Mode = 'about' | 'communication' | 'context'
export function MezoPersonalPage({ mode }: { mode: Mode }) {
  const t = useM().settings.personal
  const titles = { about: t.titleAbout, communication: t.titleCommunication, context: t.titleContext }
  const subtitles = { about: t.subtitleAbout, communication: t.subtitleCommunication, context: t.subtitleContext }
  return <SettingsFrame title={titles[mode]} subtitle={subtitles[mode]} parent="/settings/mezo">
    {mode === 'context' ? <ContextPreview /> : <PersonalEditor key={mode} mode={mode} />}
  </SettingsFrame>
}
function PersonalEditor({ mode }: { mode: 'about' | 'communication' }) {
  const t = useM().settings.personal
  const query = useCompanionPreferences()
  const [draft, setDraft] = useState<CompanionPreferences | null>(null)
  const [saved, setSaved] = useState(false)
  const values = draft ?? query.data
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(query.data)
  const change = (patch: Partial<CompanionPreferences>) => { if (values) setDraft({ ...values, ...patch }); setSaved(false) }
  if (query.isError) return <div role="alert">{t.loadError} <button onClick={query.refetch}>{t.retry}</button></div>
  if (!values) return <p role="status">{t.loading}</p>
  const about = mode === 'about'
  const value = about ? values.aboutMe : values.customInstructions
  return <>
    <UnsavedChangesGuard dirty={dirty} />
    {about && <div className="personal-sources"><CoreFacts /><span className="settings-kicker">{t.sources}</span>
      <SettingsRows domain="me">
        <SettingsRow to="/settings/account" title={t.nameRow.title} description={t.nameRow.description} icon="t-person" domain="me" />
        <SettingsRow to="/settings/me/biometrics" title={t.bodyRow.title} description={t.bodyRow.description} icon="t-heart" domain="me" />
        <SettingsRow to="/settings/me/goal" title={t.goalsRow.title} description={t.goalsRow.description} icon="t-weight" domain="train" />
      </SettingsRows>
    </div>}
    <form className="personal-editor glass" onSubmit={async (event) => {
      event.preventDefault()
      try { await query.save(values); setDraft(null); setSaved(true) } catch { setSaved(false) }
    }}>
      <label htmlFor="personal-text"><span className="settings-kicker">{about ? t.kickerAbout : t.kickerCommunication}</span><h2>{about ? t.headingAbout : t.headingCommunication}</h2></label>
      <p>{about ? t.hintAbout : t.hintCommunication}</p>
      <VoiceField domain="me" onTranscript={t => { const next = appendDictation(value, t, 4000); change(about ? { aboutMe: next } : { customInstructions: next }) }}>
        <textarea id="personal-text" aria-label={about ? t.headingAbout : t.headingCommunication} maxLength={4000} disabled={query.saving} rows={7} value={value} onChange={e => change(about ? { aboutMe: e.target.value } : { customInstructions: e.target.value })} />
      </VoiceField>
      <div className="personal-field-foot"><span>{t.onlyYou}</span><span>{value.length} / 4000</span></div>
      {!about && <label className="personal-switch"><span><strong>{t.learnedSwitch}</strong><small>{t.learnedSwitchHint}</small></span><input type="checkbox" aria-label={t.learnedSwitch} disabled={query.saving} checked={values.useLearnedProfile} onChange={e => change({ useLearnedProfile: e.target.checked })} /></label>}
      {query.saveError && <p role="alert">{t.saveError}</p>}
      {saved && <p role="status">{t.saved}</p>}
      <button className="cta-primary" type="submit" disabled={!dirty || query.saving}>{query.saving ? t.saving : t.save}</button>
    </form>
    {!about && <LearnedProfile />}
    <SettingsRows domain="nap"><SettingsRow to="/settings/mezo/context" title={t.previewRow.title} description={t.previewRow.description} icon="t-lens" domain="nap" /></SettingsRows>
  </>
}
function LearnedProfile() {
  const m = useM()
  const t = m.settings.personal
  const { nodes, isPending, isError, refetch } = useKnowledgeGraphNodes()
  const { archive, pending } = useKnowledgeGraphActions()
  const node = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND)
  return <section className="personal-learned glass"><h2>{t.learnedTitle}</h2>{isError ? <p role="alert">{t.learnedError} <button onClick={refetch}>{t.retry}</button></p> : isPending ? <p>{m.frame.loading}</p> : node ? <ProfileNodeCard node={node} onArchive={() => { if (!pending) archive(node.id) }} /> : <p>{t.learnedEmpty}</p>}<p>{t.learnedNote}</p></section>
}
function ContextPreview() {
  const t = useM().settings.personal
  const query = usePersonalContext()
  const { state } = useSettingsOrigin()
  return <>
    <p className="personal-scope">{t.contextScope}</p>
    {isMockMode() && <p className="personal-scope">{t.contextDemo}</p>}
    {query.isError ? <p role="alert">{t.contextError} <button onClick={query.refetch}>{t.retry}</button></p> : !query.data ? <p role="status">{t.contextLoading}</p> : <>
      <div className="personal-context-list glass">{query.data.sections.map(section => <section key={section.id} className="personal-context-section">
        <header><h2>{section.title}</h2><span data-included={section.included ? 'true' : 'false'}><Icon3D name={section.included ? 't-tick' : 't-skip'} size={16} />{section.included ? t.included : t.notIncluded}</span></header><small>{section.source}</small>
        <p>{section.text || t.noContent}</p>
        {section.editPath?.startsWith('/settings/') && <Link to={section.editPath} state={state}>{t.correct(section.title)}</Link>}
      </section>)}</div>
      <details className="personal-raw"><summary>{t.rawSummary}</summary><pre>{query.data.renderedText || t.rawEmpty}</pre></details>
    </>}
  </>
}

function CoreFacts() {
  const t = useM().settings.personal
  const query = usePersonalContext()
  const core = query.data?.sections.find(section => section.id === 'core')
  return <section className="personal-core glass"><h2>{t.coreTitle}</h2>{query.isError ? <p role="alert">{t.coreError} <button onClick={query.refetch}>{t.retry}</button></p> : !query.data ? <p role="status">{t.coreLoading}</p> : <p>{core?.text || t.coreEmpty}</p>}</section>
}
