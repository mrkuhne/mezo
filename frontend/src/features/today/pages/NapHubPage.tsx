import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivities, useCheckins, useFuelDay, useJournalNotes, useTodayScenario } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { buildNapTimeline } from '@/features/today/logic/napTimeline'
import { TitanCompanion } from '@/features/today/components/TitanCompanion'
import { NapFuelGraphic } from '@/features/today/components/NapFuelGraphic'
import { NapPersonalInsight } from '@/features/today/components/NapPersonalInsight'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import '@/features/today/pages/NapHubPage.css'

export function NapHubPage() {
  const navigate = useNavigate()
  const tick = useMinuteTick()
  const date = localDateString(tick)
  const needs = useNeeds(tick)
  const scenario = useTodayScenario()
  const checkinDay = useCheckins()
  const { checkins, saveCheckIn } = checkinDay
  const nutrition = useFuelDay(date)
  const notes = useJournalNotes(date, date)
  const activities = useActivities(date)
  const [sheet, setSheet] = useState<'journal' | 'activity' | number | null>(null)
  const nextIdx = checkins.findIndex(c => c.state === 'now')
  const fillIdx = nextIdx >= 0 ? nextIdx : checkins.findIndex(c => c.state !== 'done')
  const moments = buildNapTimeline(date, checkins, nutrition.fuel.meals, notes.data, activities.data)
  const timelinePending = checkinDay.isPending || nutrition.isPending || notes.isPending || activities.isPending
  const timelineError = checkinDay.isError || nutrition.isError || notes.isError || activities.isError
  const actions = [
    { label: 'Check-in', art: 'membrane', sub: 'Hogy vagy most?', run: () => fillIdx < 0 ? navigate('/nap/checkin') : setSheet(fillIdx) },
    { label: 'Gyors logolás', art: 'crystal', sub: 'Egy mozdulat', run: () => navigate('/nap/gyors') },
    { label: 'Napló', art: 'pages', sub: 'Ami benned van', run: () => setSheet('journal') },
    { label: 'Aktivitás', art: 'ribbon', sub: 'Amit ma tettél', run: () => setSheet('activity') },
    { label: 'Chat', art: 'chat', sub: 'Beszéljük át', run: () => navigate('/mezo/chat') },
  ]
  return (
    <div className={`nap-hub nap-titan nap-center${scenario.anchorMode ? ' nap-titan-quiet' : ''}`}>
      <div className="nap-center-heading"><p>NAPKÖZPONT</p><h1>A napod.<br /><span>Minden kapcsolódik.</span></h1></div>
      <section className="nap-center-orbit" aria-label="Gyors műveletek" data-kalauz-anchor="nap-hero">
        <div className="nap-center-companion"><TitanCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} /></div>
        {actions.map(a => <button type="button" aria-label={a.label} key={a.art} className={`nap-center-node nap-node-${a.art}`} onClick={a.run} disabled={a.art === 'membrane' && (checkinDay.isPending || checkinDay.isError)}>
          <span className={`nap-center-art ${a.art}`} aria-hidden="true"><i /><i /><i /></span><span>{a.label}</span><small>{a.sub}</small>
        </button>)}
      </section>
      {checkinDay.isError && <p className="nap-center-read-error" role="alert">A check-injeidet most nem sikerült betölteni. <button type="button" onClick={() => { void checkinDay.refetch() }}>Check-in újratöltése</button></p>}
      <NapFuelGraphic consumed={nutrition.fuel.consumed} targets={nutrition.fuel.targets} isPending={nutrition.isPending} isError={nutrition.isError} onRetry={nutrition.refetch} />
      <NapPersonalInsight date={date} />
      <section className="nap-center-timeline" aria-labelledby="nap-moments-title">
        <header><p>AMI MÁR A NAPOD RÉSZE</p><h2 id="nap-moments-title">Mai pillanatok</h2></header>
        {timelinePending && <p role="status">Pillanatok betöltése…</p>}
        {timelineError && <p role="status">Néhány pillanatot most nem sikerült betölteni.</p>}
        {!timelinePending && !timelineError && moments.length === 0 && <p>Az első mai bejegyzésed itt kap helyet.</p>}
        <ol>{moments.slice(0, 8).map(m => <li key={m.id}><button type="button" onClick={() => navigate(m.to)}>
          <time dateTime={m.time ?? date}>{m.time ? new Date(m.time).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : 'Ma'}</time>
          <span><strong>{m.label}</strong><span className="nap-moment-text">{m.text}</span></span><span aria-hidden="true">↗</span>
        </button></li>)}</ol>
      </section>
      {typeof sheet === 'number' && <CheckInSheet slot={checkins[sheet]} slotIdx={sheet} onClose={() => setSheet(null)} onSave={data => saveCheckIn(sheet, { ...data, savedAt: new Date().toISOString() })} />}
      {sheet === 'journal' && <JournalSheet onClose={() => setSheet(null)} />}
      {sheet === 'activity' && <ActivityLogSheet onClose={() => setSheet(null)} />}
    </div>
  )
}
