import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { GymScheduleSheet } from '@/features/train/sheets/GymScheduleSheet'
import { SportScheduleSheet } from '@/features/train/sheets/SportScheduleSheet'
import { Lines, SettingsFrame, SettingsRow, SettingsRows } from '@/features/settings/components/SettingsFrame'
import { useM } from '@/shared/i18n'

export function TrainSettingsPage({ editor }: { editor?: 'gym' | 'sport' }) {
  const t = useM().settings.train
  const train = useTrain()
  const [open, setOpen] = useState(!!editor)
  const sessions = train.sport.schedule?.volleyball.sessions.filter(s => !s.oneOff) ?? []
  return <SettingsFrame title={editor === 'gym' ? t.titleGym : editor === 'sport' ? t.titleSport : t.title} subtitle={t.subtitle} domain="train" parent={editor ? '/settings/train' : '/settings'}>
    <section className="settings-wash glass"><p className="settings-editorial"><Lines text={t.editorial} /></p>{train.schedulePending ? <p role="status">{t.loading}</p> : train.scheduleError ? <p role="alert">{t.loadError}</p> : <><div className="settings-stats"><div><strong>{train.gymSlots.length}</strong><small>{t.gymPerWeek}</small></div><div><strong>{sessions.length}</strong><small>{t.sportPerWeek}</small></div></div><div className="settings-week" aria-label={t.weekLabel}>{[0, 1, 2, 3, 4, 5, 6].map(i => { const day = t.weekday(i); const time = train.gymSlots.find(s => s.dayOfWeek === i)?.time; return <div className={time ? 'settings-day is-on' : 'settings-day'} key={i}>{day}<strong>{time ?? '—'}</strong></div> })}</div></>}</section>
    {editor && <button className="settings-open-button" disabled={train.schedulePending || train.scheduleError} onClick={() => setOpen(true)}>{t.editTimes}</button>}
    <SettingsRows domain="train">
      <SettingsRow to="/settings/train/gym" title={t.gymRow.title} description={t.gymRow.description} icon="t-dumbbell" domain="train" />
      <SettingsRow to="/settings/train/sport" title={t.sportRow.title} description={t.sportRow.description} icon="t-volley" domain="train" />
      <SettingsRow to="/settings/notifications" title={t.remindersRow.title} description={t.remindersRow.description} icon="t-bell" domain="nap" />
    </SettingsRows>
    <p className="settings-note">{t.note}</p>
    {open && !train.schedulePending && !train.scheduleError && editor === 'gym' && <GymScheduleSheet slots={train.gymSlots} onSave={train.saveGymScheduleAsync} onClose={() => setOpen(false)} />}
    {open && !train.schedulePending && !train.scheduleError && editor === 'sport' && <SportScheduleSheet initial={sessions} onSave={train.saveSportScheduleAsync} onClose={() => setOpen(false)} />}
  </SettingsFrame>
}
