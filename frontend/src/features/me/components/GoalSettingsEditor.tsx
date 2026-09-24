import { useState } from 'react'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'
import { useGoalSettings } from '@/data/hooks'
import type { GoalResponse } from '@/data/me/goalApi'
import { buildGoalSettingsRequest, deriveGoalTargetDate } from '@/features/me/logic/goalSettings'
import { localDateString } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import '@/features/me/components/goalSettingsEditor.css'

export function GoalSettingsEditor({ goal, currentWeight }: { goal: GoalResponse; currentWeight: number }) {
  const today = localDateString()
  const daysLeft = (Date.parse(goal.targetDate) - Date.parse(today)) / 86400000
  const expired = !Number.isFinite(daysLeft) || daysLeft <= 0
  const initialPace = expired ? null : Math.max(.1, Math.round(Math.abs(currentWeight - (goal.targetWeightKg ?? currentWeight)) / daysLeft * 70) / 10)
  const [target, setTarget] = useState(String(goal.targetWeightKg ?? currentWeight))
  const [pace, setPace] = useState(expired ? '' : String(initialPace))
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const date = deriveGoalTargetDate(today, currentWeight, Number(target), Number(pace), goal.trajectory)
  const request = date ? buildGoalSettingsRequest(goal, Number(target), date) : null
  const state = useGoalSettings(goal, request, date ? { trajectory: goal.trajectory, startDate: today, startWeightKg: currentWeight, targetDate: date, targetWeightKg: Number(target) } : null)
  if (goal.trajectory === 'maintain') return <section className="goal-pace-editor glass"><h2>Súlytartás</h2><p>A súlytartásnak nincs elérkezési céldátuma. Az eredeti követési időszak változatlan marad.</p></section>
  const save = async () => {
    if (!request) return
    try { await state.save(request); setDirty(false); setSaved(true) } catch { /* mutation error remains visible below */ }
  }
  return <section className="goal-pace-editor glass" aria-label="Súlycél módosítása">
    <UnsavedChangesGuard dirty={dirty} /><span className="eyebrow">A te tempódban</span><h2>Célból dátum</h2>
    <p>Számítási alap: {hu1(currentWeight)} kg · {today}. A tempó a még hátralévő útra vonatkozik.</p>
    <>{expired && <p>A korábbi céldátum már elmúlt. Adj meg új, vállalható heti tempót; ebből számoljuk az új becsült dátumot.</p>}</>
    <div className="goal-pace-fields">
      <label>Célsúly (kg)<input disabled={state.saving} type="number" min="20" max="500" step="0.1" value={target} onChange={e => { setTarget(e.target.value); setDirty(true); setSaved(false) }} /></label>
      <label>Hátralévő céltempó (kg/hét)<input disabled={state.saving} type="number" min="0.1" max="5" step="0.1" value={pace} onChange={e => { setPace(e.target.value); setDirty(true); setSaved(false) }} /></label>
    </div>
    <div className="goal-pace-arrival"><span>Becsült céldátum · számított</span><output>{date ?? 'Ellenőrizd a célsúlyt és a tempót'}</output></div>
    <p>A kezdősúly és a kezdődátum változatlan: {hu1(goal.startWeightKg)} kg · {goal.startDate}. A célmotor a teljes időszak átlagtempójával számol; ez eltérhet a hátralévő tempótól.</p>
    {state.mock ? <p>Demó mód: a módosítás megmarad az alkalmazás megnyitásáig. Szerveres megvalósíthatósági ellenőrzés itt nem fut.</p> : state.previewError ? <div role="alert">Az ellenőrzés nem sikerült. <button type="button" onClick={state.retryPreview}>Újra</button></div> : state.previewPending ? <p role="status">Megvalósíthatóság ellenőrzése…</p> : state.preview && <div className="goal-pace-verdict"><strong>{state.preview.every(p => p.withinSafeBand) ? 'A szerver szerint a tempó a megengedett sávban van.' : 'A szerver szerint a tempó túl gyors lehet.'}</strong><p>Teljes cél: {hu1(state.preview[0].derivedRatePctPerWeek)}% / hét · Hátralévő út: {hu1(state.preview[1].derivedRatePctPerWeek)}% / hét</p>{state.preview[1].suggestedTargetDate && <p>Javasolt legkorábbi dátum: {state.preview[1].suggestedTargetDate}</p>}</div>}
    {state.error && <p role="alert">A cél mentése nem sikerült. A módosításaid megmaradtak, próbáld újra.</p>}
    {saved && <p role="status">Súlycél mentve.</p>}
    <button className="cta-primary" type="button" disabled={!dirty || !request || state.saving || (!state.mock && (!state.preview || state.previewPending || state.previewError))} onClick={() => void save()}>{state.saving ? 'Mentés…' : 'Súlycél mentése'}</button>
  </section>
}
