// ============================================================
// Mezo · SportEventSheet — one-off (non-recurring) sport event capture
// (mezo-e1sp). A dated session/match outside the weekly rhythm: date +
// sport + time + duration (+ optional kind/location/intensity), saved via
// POST /api/train/sport-events. Unlike SportScheduleSheet this works in
// BOTH modes (mock emulates the server in the client-owned event cache),
// and the saved event flows into Mai / Heti terv / the fuel day-plan
// through the schedule merge in trainHooks.
// Üveg re-dress (mezo-me75u.4): the shared floating capture sheet (one rose glass
// surface, bible U2 rule 15) with the capture header; chips flat with the chosen one
// solid rose, fields flat, Mégse flat and Mentés the one lit primary.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
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
    <Sheet onClose={onClose} labelledBy="sport-event-title" className="capture-sheet capture-tone-sport glass uvs-sheet">
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
            <CaptureHeader id="sport-event-title" title="Új esemény" eyebrow="Sport · egyszeri esemény" kind="sport" onClose={close} />

            <div className="col gap-sm">
              {/* Sport selector */}
              <div className="row gap-xs" role="group" aria-label="Esemény sportja">
                {EVENT_SPORT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip flex-1"
                    aria-pressed={sport === k}
                    onClick={() => setSport(k)}
                  >
                    {SPORT_LABELS[k]}
                  </button>
                ))}
              </div>

              {/* Date + time */}
              <div className="row gap-sm">
                <input
                  type="date"
                  aria-label="Esemény dátuma"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="uvs-inp is-date"
                />
                <input
                  type="time"
                  aria-label="Esemény ideje"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="uvs-inp is-time"
                />
              </div>

              {/* Kind — volleyball only (cross/TRX always save 'training') */}
              {sport === 'volleyball' && (
                <div className="row gap-sm" role="group" aria-label="Esemény típusa">
                  <button
                    type="button"
                    className="chip flex-1"
                    aria-pressed={kind === 'match'}
                    onClick={() => setKind('match')}
                  >
                    meccs
                  </button>
                  <button
                    type="button"
                    className="chip flex-1"
                    aria-pressed={kind === 'training'}
                    onClick={() => setKind('training')}
                  >
                    edzés
                  </button>
                </div>
              )}

              <NumberStep
                label="Hossz · perc"
                val={durationMin}
                step={15}
                min={15}
                max={360}
                onChange={setDurationMin}
              />

              <input
                aria-label="Esemény helyszíne"
                placeholder="Helyszín"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="uvs-inp"
              />
            </div>

            {/* Footer */}
            <div className="capture-actions">
              <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
              <CtaPrimary className="capture-save flex-1" onClick={save} disabled={saving}>
                <Icon3D name="t-tick" size={22} /> Mentés
              </CtaPrimary>
            </div>
          </>
        )
      }}
    </Sheet>
  )
}
