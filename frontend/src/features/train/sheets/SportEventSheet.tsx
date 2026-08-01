// ============================================================
// Mezo · SportEventSheet — one-off (non-recurring) sport event capture
// (mezo-e1sp). A dated session/match outside the weekly rhythm: date +
// sport + time + duration (+ optional kind/location/intensity), saved via
// POST /api/train/sport-events. Unlike SportScheduleSheet this works in
// BOTH modes (mock emulates the server in the client-owned event cache),
// and the saved event flows into Mai / Heti terv / the fuel day-plan
// through the schedule merge in trainHooks.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'
import { localDateString } from '@/shared/lib/dates'
import type { SportEventCreateRequest } from '@/data/train/trainApi'
import { NumberStep } from '@/features/train/sheets/SportLogSheet'
import { SPORT_KINDS, SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'

export function SportEventSheet({ onSave, onClose }: {
  onSave?: (req: SportEventCreateRequest, done: () => void) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(localDateString())
  const [sport, setSport] = useState<SportKind>('volleyball')
  // A one-off volleyball event is typically a match — that's the default; the
  // schedule convention holds here too: cross/TRX always save kind 'training'.
  const [kind, setKind] = useState<'training' | 'match'>('match')
  const [time, setTime] = useState('18:00')
  const [durationMin, setDurationMin] = useState(90)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  const inputStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontSize: 12,
    padding: '8px 10px', width: '100%',
  } as const

  return (
    <Sheet onClose={onClose} labelledBy="sport-event-title">
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
            {/* Header */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="col">
                <span className="eyebrow" style={{ color: 'var(--rose)' }}>Sport · egyszeri esemény</span>
                <div style={{ marginTop: 4 }}>
                  <Display size="md">
                    <span role="heading" aria-level={2} id="sport-event-title">Új esemény</span>
                  </Display>
                </div>
              </div>
              <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            <div className="col gap-sm">
              {/* Sport selector */}
              <div className="row gap-xs" role="group" aria-label="Esemény sportja">
                {SPORT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip flex-1"
                    aria-pressed={sport === k}
                    onClick={() => setSport(k)}
                    style={{
                      padding: '8px 8px', fontSize: 9,
                      color: sport === k ? 'var(--rose)' : 'var(--text-tertiary)',
                      borderColor: sport === k
                        ? 'color-mix(in srgb, var(--rose) 40%, transparent)'
                        : 'var(--border-subtle)',
                    }}
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
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="time"
                  aria-label="Esemény ideje"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{ ...inputStyle, width: 110 }}
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
                    style={{ fontSize: 9, color: kind === 'match' ? 'var(--rose)' : 'var(--text-tertiary)' }}
                  >
                    meccs
                  </button>
                  <button
                    type="button"
                    className="chip flex-1"
                    aria-pressed={kind === 'training'}
                    onClick={() => setKind('training')}
                    style={{ fontSize: 9, color: kind === 'training' ? 'var(--rose)' : 'var(--text-tertiary)' }}
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
                style={inputStyle}
              />
            </div>

            {/* Footer */}
            <div className="row gap-sm mt-lg">
              <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
              <CtaPrimary className="flex-1" onClick={save} disabled={saving}>
                <Icon name="check" size={14} /> Mentés
              </CtaPrimary>
            </div>
          </>
        )
      }}
    </Sheet>
  )
}
