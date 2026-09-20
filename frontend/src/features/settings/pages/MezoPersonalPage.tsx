import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanionPreferences, usePersonalContext, useKnowledgeGraphNodes, useKnowledgeGraphActions } from '@/data/hooks'
import type { CompanionPreferences } from '@/data/companion/preferencesApi'
import { isMockMode } from '@/data/_client/mode'
import { SettingsFrame, SettingsRow, useSettingsOrigin } from '@/features/settings/components/SettingsFrame'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { PROFILE_SOURCE_KIND } from '@/data/insights/graph'
import { ProfileNodeCard } from '@/features/insights/components/ProfileNodeCard'
import '@/features/settings/personal-settings.css'

type Mode = 'about' | 'communication' | 'context'
const titles = { about: 'Rólam, a saját szavaimmal', communication: 'Így beszélj velem', context: 'Ezt kapja meg Mezo' }
const subtitles = { about: 'A tények a forrásukból jönnek. Ami mögöttük van, azt te mondod el.', communication: 'Saját instrukció és tanult stílus — külön, a te kezedben.', context: 'Átlátható személyes háttér, ellenőrizhető forrásokkal.' }
export function MezoPersonalPage({ mode }: { mode: Mode }) {
  return <SettingsFrame title={titles[mode]} subtitle={subtitles[mode]} parent="/settings/mezo">
    {mode === 'context' ? <ContextPreview /> : <PersonalEditor key={mode} mode={mode} />}
  </SettingsFrame>
}
function PersonalEditor({ mode }: { mode: 'about' | 'communication' }) {
  const query = useCompanionPreferences()
  const [draft, setDraft] = useState<CompanionPreferences | null>(null)
  const [saved, setSaved] = useState(false)
  const values = draft ?? query.data
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(query.data)
  const change = (patch: Partial<CompanionPreferences>) => { if (values) setDraft({ ...values, ...patch }); setSaved(false) }
  if (query.isError) return <div role="alert">Nem sikerült betölteni a beállításaidat. <button onClick={query.refetch}>Újrapróbálom</button></div>
  if (!values) return <p role="status">Beállítások betöltése…</p>
  const about = mode === 'about'
  const value = about ? values.aboutMe : values.customInstructions
  return <>
    <UnsavedChangesGuard dirty={dirty} />
    {about && <div className="personal-sources"><CoreFacts /><span className="settings-kicker">A TÉNYEK FORRÁSA</span>
      <SettingsRow to="/settings/account" title="Név és fiók" description="A megszólításod innen származik." domain="me" />
      <SettingsRow to="/settings/me/biometrics" title="Testadatok és életkor" description="Magasság, születési dátum, aktivitás." domain="me" />
      <SettingsRow to="/settings/me/goal" title="Súly- és edzéscéljaim" description="Az aktív cél és a mért adatok a saját helyükön javíthatók." domain="train" />
    </div>}
    <form className="personal-editor" onSubmit={async (event) => {
      event.preventDefault()
      try { await query.save(values); setDraft(null); setSaved(true) } catch { setSaved(false) }
    }}>
      <label htmlFor="personal-text"><span className="settings-kicker">{about ? 'AMIT MÉG TUDJ RÓLAM' : 'AZ ÉN KÉRÉSEM'}</span><h2>{about ? 'Saját bemutatkozás' : 'Saját instrukció'}</h2></label>
      <p>{about ? 'Mi fontos neked? Mivel foglalkozol, milyen szokásokat szeretnél tartani? Az ide írt szöveget Mezo nem írja át.' : 'Például: légy tömör; mondd ki, ha bizonytalan vagy; előbb kérdezz, mielőtt új tervet javasolsz.'}</p>
      <textarea id="personal-text" aria-label={about ? 'Saját bemutatkozás' : 'Saját instrukció'} maxLength={4000} disabled={query.saving} rows={7} value={value} onChange={e => change(about ? { aboutMe: e.target.value } : { customInstructions: e.target.value })} />
      <div className="personal-field-foot"><span>Csak te szerkeszted</span><span>{value.length} / 4000</span></div>
      {!about && <label className="personal-switch"><span><strong>Tanult kommunikációs profil használata</strong><small>A saját kérésed elsőbbséget kap a tanult stílussal szemben. Az alkalmazás szabályai továbbra is érvényesek.</small></span><input type="checkbox" aria-label="Tanult kommunikációs profil használata" disabled={query.saving} checked={values.useLearnedProfile} onChange={e => change({ useLearnedProfile: e.target.checked })} /></label>}
      {query.saveError && <p role="alert">A mentés nem sikerült. A szöveged megmaradt, próbáld újra.</p>}
      {saved && <p role="status">Mentve — a következő beszélgetési fordulótól érvényes.</p>}
      <button className="cta-primary" type="submit" disabled={!dirty || query.saving}>{query.saving ? 'Mentés…' : 'Változtatások mentése'}</button>
    </form>
    {!about && <LearnedProfile />}
    <SettingsRow to="/settings/mezo/context" title="Nézd meg, mi kerül be" description="A mentett személyes blokkok pontos előnézete." />
  </>
}
function LearnedProfile() {
  const { nodes, isPending, isError, refetch } = useKnowledgeGraphNodes()
  const { archive, pending } = useKnowledgeGraphActions()
  const node = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND)
  return <section className="personal-learned"><h2>Amit Mezo tanult a stílusodról</h2>{isError ? <p role="alert">A tanult profil nem tölthető be. <button onClick={refetch}>Újrapróbálom</button></p> : isPending ? <p>Betöltés…</p> : node ? <ProfileNodeCard node={node} onArchive={() => { if (!pending) archive(node.id) }} /> : <p>Még nincs tanult kommunikációs profil.</p>}<p>Az archiválás törli az aktív összegzést; a tanulás később újat készíthet. A kapcsolóval a felhasználását állítod.</p></section>
}
function ContextPreview() {
  const query = usePersonalContext()
  const { state } = useSettingsOrigin()
  return <>
    <p className="personal-scope">Ez a személyes háttér, nem a teljes rendszerprompt: az alkalmazás szabályai és az adott beszélgetéshez előhívott emlékek külön kerülnek mellé.</p>
    {isMockMode() && <p className="personal-scope">Demó előnézet — itt nincs háttérben futó Mezo-beszélgetés.</p>}
    {query.isError ? <p role="alert">Az előnézet nem tölthető be. <button onClick={query.refetch}>Újrapróbálom</button></p> : !query.data ? <p role="status">Személyes háttér betöltése…</p> : <>
      <div className="personal-context-list">{query.data.sections.map(section => <section key={section.id} className="personal-context-section">
        <header><h2>{section.title}</h2><span>{section.included ? 'Bekerül' : 'Nem kerül be'}</span></header><small>{section.source}</small>
        <p>{section.text || 'Nincs hozzáadott tartalom.'}</p>
        {section.editPath?.startsWith('/settings/') && <Link to={section.editPath} state={state}>{section.title} javítása</Link>}
      </section>)}</div>
      <details className="personal-raw"><summary>Pontos összeállított szöveg</summary><pre>{query.data.renderedText || 'A személyes háttér üres.'}</pre></details>
    </>}
  </>
}

function CoreFacts() {
  const query = usePersonalContext()
  const core = query.data?.sections.find(section => section.id === 'core')
  return <section className="personal-core"><h2>Az alapok, amiket ismer</h2>{query.isError ? <p role="alert">Az alapadatok most nem tölthetők be. <button onClick={query.refetch}>Újrapróbálom</button></p> : !query.data ? <p role="status">Alapadatok betöltése…</p> : <p>{core?.text || 'Még nincs személyes alapadat.'}</p>}</section>
}
