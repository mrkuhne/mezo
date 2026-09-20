import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import { SettingsFrame, SettingsRow } from '@/features/settings/components/SettingsFrame'

export function TrainSettingsPage({ editor }: { editor?: 'gym' | 'sport' }) {
  const train = useTrain()
  const [open, setOpen] = useState(!!editor)
  const sessions = train.sport.schedule?.volleyball.sessions.filter(s => !s.oneOff) ?? []
  return <SettingsFrame title={editor === 'gym' ? 'Gym-időpontok' : editor === 'sport' ? 'Rendszeres sport' : 'Train'} subtitle="Helyet a mozgásnak. A hét többi része igazodik." domain="train" parent={editor ? '/settings/train' : '/settings'}>
    <section className="settings-wash"><p className="settings-editorial">A terved mondja, mit.<br />Te döntöd el, mikor.</p>{train.schedulePending ? <p role="status">Az időpontjaid betöltése…</p> : train.scheduleError ? <p role="alert">Nem sikerült betölteni az időpontokat. Frissítsd az oldalt az újrapróbáláshoz.</p> : <><div className="settings-stats"><div><strong>{train.gymSlots.length}</strong><small>gym-időpont / hét</small></div><div><strong>{sessions.length}</strong><small>sportalkalom / hét</small></div></div><div className="settings-week" aria-label="Heti gym-időpontok">{['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((day, i) => <div className="settings-day" key={day}>{day}<strong>{train.gymSlots.find(s => s.dayOfWeek === i)?.time ?? '—'}</strong></div>)}</div></>}</section>
    {editor && <button className="settings-open-button" disabled={train.schedulePending || train.scheduleError} onClick={() => setOpen(true)}>Időpontok szerkesztése</button>}
    <SettingsRow to="/settings/train/gym" title="Heti gym-időpontok" description="Melyik nap, mikor kezdődjön az edzésed" domain="train" />
    <SettingsRow to="/settings/train/sport" title="Rendszeres sport" description="Röplabda, cross és TRX · akár több alkalom egy napon" domain="train" />
    <SettingsRow to="/settings/notifications" title="Edzésemlékeztetők" description="Jelzés a kezdés előtt, a saját időpontjaidhoz igazítva" domain="nap" />
    <p className="settings-note">Az edzésterv és a gyakorlatok a Train oldalon maradnak. Ezek az időpontok a naptáradhoz és a napi étkezési ritmushoz is kapaszkodót adnak.</p>
    {open && !train.schedulePending && !train.scheduleError && editor === 'gym' && <GymScheduleSheet slots={train.gymSlots} onSave={train.saveGymScheduleAsync} onClose={() => setOpen(false)} />}
    {open && !train.schedulePending && !train.scheduleError && editor === 'sport' && <SportScheduleSheet initial={sessions} onSave={train.saveSportScheduleAsync} onClose={() => setOpen(false)} />}
  </SettingsFrame>
}
