// ============================================================
// Mezo · SportEventSheet — one-off (non-recurring) sport event capture
// (mezo-e1sp). A dated session/match outside the weekly rhythm: date +
// sport + time + duration (+ optional kind/location/intensity), saved via
// POST /api/train/sport-events. Unlike SportScheduleSheet this works in
// BOTH modes (mock emulates the server in the client-owned event cache),
// and the saved event flows into Mai / Heti terv / the fuel day-plan
// through the schedule merge in trainHooks.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `SHEETS.sportev`): a light sheet — the
// calendar glyph head, the sport as pills, date + time side by side, the kind pills
// (volleyball only), the length stepper, the place field, „Mentés" + „Mégse".
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Input, Lab, Pill, Pills, SheetActs, TwoBtn } from '@/shared/ui/folyadek'
import { localDateString } from '@/shared/lib/dates'
import type { SportEventCreateRequest } from '@/data/train/trainApi'
import { NumberStep } from '@/features/train/sheets/SportLogSheet'
import { SPORT_LABELS } from '@/features/train/logic/sportKinds'

// The event's OWN 3-id vocabulary — `ck_sport_event_sport` stayed unchanged when the
// sport-session wire widened to ten ids (mezo-88iwa.9), so this sheet keeps offering
// only what the event's own CHECK still accepts.
const EVENT_SPORT_KINDS = ['volleyball', 'cross', 'trx'] as const
type EventSportKind = (typeof EVENT_SPORT_KINDS)[number]

export function SportEventSheet({ onSave, onClose }: {
  onSave?: (req: SportEventCreateRequest, done: () => void) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(localDateString())
  const [sport, setSport] = useState<EventSportKind>('volleyball')
  // A one-off volleyball event is typically a match — that's the default; the
  // schedule convention holds here too: cross/TRX always save kind 'training'.
  const [kind, setKind] = useState<'training' | 'match'>('match')
  const [time, setTime] = useState('18:00')
  const [durationMin, setDurationMin] = useState(90)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Sheet onClose={onClose} labelledBy="sport-event-title" className="fo-sheet es-sheet">
      {(close) => {
        const save = () => {
          if (!date || saving) return
          setSaving(true)
          const req: SportEventCreateRequest = {
            date, time, durationMin,
            sport, kind: sport === 'volleyball' ? kind : 'training',
            ...(location.trim() ? { location: location.trim() } : {}),
          }
          onSave?.(req, () => { setSaving(false); close() })
        }
        return (
          <>
            <FoSheetHead titleId="sport-event-title" icon="t-calendar" eyebrow="Sport · egyszeri esemény" title="Új esemény" onClose={close} />

            <Pills role="group" aria-label="Esemény sportja">
              {EVENT_SPORT_KINDS.map((k) => (
                <Pill key={k} on={sport === k} onClick={() => setSport(k)}>{SPORT_LABELS[k]}</Pill>
              ))}
            </Pills>

            <TwoBtn>
              <div>
                <Lab htmlFor="sport-event-date">Dátum</Lab>
                <Input id="sport-event-date" type="date" aria-label="Esemény dátuma" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Lab htmlFor="sport-event-time">Idő</Lab>
                <Input id="sport-event-time" type="time" aria-label="Esemény ideje" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </TwoBtn>

            {/* Kind — volleyball only (cross/TRX always save 'training') */}
            {sport === 'volleyball' && (
              <div className="es-blk">
                <Lab>Típus</Lab>
                <Pills role="group" aria-label="Esemény típusa">
                  <Pill on={kind === 'match'} onClick={() => setKind('match')}>meccs</Pill>
                  <Pill on={kind === 'training'} onClick={() => setKind('training')}>edzés</Pill>
                </Pills>
              </div>
            )}

            <div className="es-vl">
              <NumberStep label="Hossz · perc" val={durationMin} step={15} min={15} max={360} onChange={setDurationMin} />
            </div>

            <Lab htmlFor="sport-event-loc">Helyszín</Lab>
            <Input id="sport-event-loc" aria-label="Esemény helyszíne" placeholder="Helyszín" value={location} onChange={(e) => setLocation(e.target.value)} />

            <SheetActs label="Mentés" onSave={save} onCancel={close} disabled={saving} />
          </>
        )
      }}
    </Sheet>
  )
}
