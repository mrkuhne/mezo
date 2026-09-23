import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivities, useCheckins, useFuelDay, useJournalNotes, useTodayScenario } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { buildNapTimeline } from '@/features/today/logic/napTimeline'
import { NapCompanion } from '@/features/today/components/NapCompanion'
import { NapFuelGraphic } from '@/features/today/components/NapFuelGraphic'
import { NapPersonalInsight } from '@/features/today/components/NapPersonalInsight'
import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import '@/features/today/pages/NapHubPage.css'

/** A Mai pillanatok sorának 3D ikonja a sor FAJTÁJÁBÓL (az id előtagja, `napTimeline.ts`):
 *  owner-döntés az U3 prototípuson — étkezés tál, check-in, napló, aktivitás lépések. */
const MOMENT_ICON: Record<string, Icon3DName> = { meal: 't-bowl', checkin: 't-checkin', journal: 't-journal', activity: 't-steps' }
const momentIcon = (id: string): Icon3DName => MOMENT_ICON[id.split(':')[0]] ?? 't-checkin'

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
  // Az öt művelet ARCA (üvegesítés U3, mezo-me75u.3): a Titanium 3D készlet puszta ikonja a
  // pályán, keret és korong nélkül (prototypes/uveg-nap.html#mai). A kétértelmű agyag jelek
  // (i-kristaly, i-sport, i-mezo) itt, a hívás helyén kapják a 3D nevüket (bible U1 7. szabály).
  // Az `art` kulcs a HELYET tartja a pályán, a `hue` az ikon-halo akcentusa.
  const actions: { label: string; art: string; icon: Icon3DName; hue: string; sub: string; run: () => void }[] = [
    { label: 'Check-in', art: 'membrane', icon: 't-checkin', hue: 'var(--dv-rose)', sub: 'Hogy vagy most?', run: () => fillIdx < 0 ? navigate('/nap/checkin') : setSheet(fillIdx) },
    { label: 'Gyors logolás', art: 'crystal', icon: 't-quick', hue: 'var(--dv-lav)', sub: 'Egy mozdulat', run: () => navigate('/nap/gyors') },
    { label: 'Napló', art: 'pages', icon: 't-journal', hue: 'var(--dv-sage)', sub: 'Ami benned van', run: () => setSheet('journal') },
    { label: 'Aktivitás', art: 'ribbon', icon: 't-steps', hue: 'var(--dv-rose)', sub: 'Amit ma tettél', run: () => setSheet('activity') },
    { label: 'Chat', art: 'chat', icon: 't-chat', hue: 'var(--dv-lav)', sub: 'Beszéljük át', run: () => navigate('/mezo/chat') },
  ]
  return (
    // `nap-titan` (a Titán-korszak hatókör-osztálya) SOHA nem kapott szabályt sehol, és a
    // `nap-titan-quiet` a `nap-center*` családot módosítja — mindkét név a rollback után
    // már csak zajt vitt a DOM-ba (mezo-ju4j6.16, lezárás). A holt osztály kiesik, a másik
    // a családja nevét veszi fel.
    // Az EntranceGroup a ház egyszeri belépő-koreográfiája (`.rise` + `--i` lépcső, 70ms).
    <EntranceGroup className={`nap-hub nap-center${scenario.anchorMode ? ' nap-center-quiet' : ''}`}>
      <div className="nap-center-heading rise" style={{ '--i': 0 } as CSSProperties}><p>NAPKÖZPONT</p><h1>A napod.<br /><span>Minden kapcsolódik.</span></h1></div>
      <section className="nap-center-orbit rise" style={{ '--i': 1 } as CSSProperties} aria-label="Gyors műveletek" data-kalauz-anchor="nap-hero">
        <div className="nap-center-companion"><NapCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} /></div>
        {actions.map((a, i) => <button type="button" aria-label={a.label} key={a.art} className={`nap-center-node nap-node-${a.art}`} style={{ '--c': a.hue, '--i': i } as CSSProperties} onClick={a.run} disabled={a.art === 'membrane' && (checkinDay.isPending || checkinDay.isError)}>
          <span className="nap-center-art" aria-hidden="true"><Icon3D name={a.icon} size={62} /></span><span>{a.label}</span><small>{a.sub}</small>
        </button>)}
      </section>
      {checkinDay.isError && <p className="nap-center-read-error" role="alert">A check-injeidet most nem sikerült betölteni. <button type="button" onClick={() => { void checkinDay.refetch() }}>Check-in újratöltése</button></p>}
      <NapFuelGraphic consumed={nutrition.fuel.consumed} targets={nutrition.fuel.targets} isPending={nutrition.isPending} isError={nutrition.isError} onRetry={nutrition.refetch} />
      <NapPersonalInsight date={date} />
      <section className="nap-center-timeline rise" style={{ '--i': 4 } as CSSProperties} aria-labelledby="nap-moments-title">
        <header><p>AMI MÁR A NAPOD RÉSZE</p><h2 id="nap-moments-title">Mai pillanatok</h2></header>
        {timelinePending && <p role="status">Pillanatok betöltése…</p>}
        {timelineError && <p role="status">Néhány pillanatot most nem sikerült betölteni.</p>}
        {!timelinePending && !timelineError && moments.length === 0 && <p>Az első mai bejegyzésed itt kap helyet.</p>}
        <ol>{moments.slice(0, 8).map(m => <li key={m.id}><button type="button" data-kind={m.id.split(':')[0]} onClick={() => navigate(m.to)}>
          <time dateTime={m.time ?? date}>{m.time ? new Date(m.time).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : 'Ma'}</time>
          <Icon3D name={momentIcon(m.id)} size={30} className="nap-moment-ico" />
          <span><strong>{m.label}</strong><span className="nap-moment-text">{m.text}</span></span><span aria-hidden="true">↗</span>
        </button></li>)}</ol>
      </section>
      {typeof sheet === 'number' && <CheckInSheet slot={checkins[sheet]} slotIdx={sheet} onClose={() => setSheet(null)} onSave={data => saveCheckIn(sheet, { ...data, savedAt: new Date().toISOString() })} />}
      {sheet === 'journal' && <JournalSheet onClose={() => setSheet(null)} />}
      {sheet === 'activity' && <ActivityLogSheet onClose={() => setSheet(null)} />}
    </EntranceGroup>
  )
}
