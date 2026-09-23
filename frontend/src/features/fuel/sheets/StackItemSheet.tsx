// ============================================================
// Mezo · StackItemSheet (mezo-vx9v Task 8)
// Opened by tapping a StackTimeline occurrence row. Shows why the occurrence landed where it did (a manual
// pin, with a one-tap "Vissza autóra" unpin; or the rule/llm placement's own reason string), lets
// the user move it to a different zone, edit its dose (save-on-blur), add one more occurrence for
// the same pantry item in a different zone, or remove every occurrence of it from the stack.
//
// Every mutation goes through useProtocolActions() (Task 5) and relies on the global
// mutation-error toast (QueryProvider's MutationCache) — no local try/catch, no hand-rolled
// success/error UI here. Zone-picker taps, unpin and remove close the sheet immediately after
// firing the mutation (the row itself unmounts on the next projectStackDay recompute); "+ Még egy
// bevétel" deliberately leaves the sheet open, since adding a second occurrence for the same item
// is a multi-step edit the user may want to repeat.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `SH.stackitem`): the sheet itself is ONE
// gold glass surface (`fsx-sheet`); inside it nothing is glass — the placement line is a flat
// cell (the manual pin wears the 3D pin, the automatic reason Mezo's serif voice), the zone and
// "+ még egy" pickers are flat chips (the chosen one filled), the inputs are flat wells, the
// removal is a warm-tinted flat button. Behavior unchanged.
// ============================================================
import { useState } from 'react'
import { useProtocolActions, useStack } from '@/data/hooks'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackZoneKey } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'

export function StackItemSheet({ entry, onClose }: { entry: StackDayEntry; onClose: () => void }) {
  const { stash } = useStack()
  const { moveItem, setDose, unpinItem, addItem, removeAllFor } = useProtocolActions()

  const [dose, setDoseValue] = useState(entry.dose ?? '')
  const stashItem = stash.find(s => s.id === entry.pantryItemId)
  const [addZone, setAddZone] = useState<StackZoneKey>(STACK_ZONE_ORDER[0])
  const [addDose, setAddDose] = useState(stashItem?.dose ?? '')

  return (
    <Sheet onClose={onClose} labelledBy="stack-item-title" className="glass is-still fsx-sheet is-gold">
      {(close) => (
        <div className="stk-item-sheet">
          {/* Header */}
          <div className="fsx-shh">
            <span className="fsx-shh-art" aria-hidden="true"><Icon3D name="t-supps" size={48} /></span>
            <div className="fsx-shh-copy">
              <span className="uv-eyebrow">Stack · időzítés</span>
              <div id="stack-item-title" className="fsx-shh-title"><strong>{entry.name}</strong></div>
              {entry.dose && <small>{entry.dose}</small>}
            </div>
            <button type="button" className="fsx-shh-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Placement — the sheet's headline line: a flat cell, never glass in glass */}
          <div className="fsx-sh-cell uv-flat">
            {entry.pinned ? (
              <>
                <span aria-hidden="true"><Icon3D name="t-pin" size={28} /></span>
                <p>Ide raktad kézzel ({STACK_ZONE_LABEL[entry.persistedZone]})</p>
                <button
                  type="button"
                  className="fsx-chip is-on"
                  onClick={() => { unpinItem(entry.occurrenceId); close() }}
                >
                  Vissza autóra
                </button>
              </>
            ) : (
              <>
                <span aria-hidden="true"><Icon3D name="t-bolt" size={28} /></span>
                <p className="uv-voice">{entry.reason ?? 'Automatikusan időzítve.'}</p>
              </>
            )}
          </div>

          {/* Zone picker */}
          <div className="fsx-sh-field">
            <span className="uv-eyebrow">Mozgatás másik zónába</span>
            <div className="fsx-chips">
              {STACK_ZONE_ORDER.map(zone => {
                const isCurrent = zone === entry.persistedZone
                return (
                  <button
                    key={zone}
                    type="button"
                    className="fsx-chip"
                    disabled={isCurrent}
                    onClick={isCurrent ? undefined : () => { moveItem(entry.occurrenceId, zone); close() }}
                  >
                    {STACK_ZONE_LABEL[zone]}{isCurrent && ' ✓'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dose editor */}
          <div className="fsx-sh-field">
            <span className="uv-eyebrow">Dózis</span>
            <input
              className="fsx-sh-input"
              aria-label="Dózis"
              value={dose}
              onChange={e => setDoseValue(e.target.value)}
              onBlur={() => setDose(entry.occurrenceId, dose)}
            />
          </div>

          {/* + Még egy bevétel */}
          <div className="fsx-sh-field">
            <span className="uv-eyebrow">+ Még egy bevétel</span>
            <div className="fsx-chips is-coral">
              {STACK_ZONE_ORDER.map(zone => (
                <button
                  key={zone}
                  type="button"
                  className={zone === addZone ? 'fsx-chip is-on' : 'fsx-chip'}
                  aria-pressed={zone === addZone}
                  onClick={() => setAddZone(zone)}
                >
                  {STACK_ZONE_LABEL[zone]}
                </button>
              ))}
            </div>
            <div className="fsx-sh-addrow is-coral">
              <input
                className="fsx-sh-input"
                aria-label="Új bevétel dózisa"
                value={addDose}
                onChange={e => setAddDose(e.target.value)}
                placeholder="Dózis"
              />
              <button
                type="button"
                className="fsx-chip is-on"
                onClick={() => addItem(entry.pantryItemId, { slotKey: addZone, dose: addDose || undefined })}
              >
                <Icon name="plus" size={11} /> Hozzáadás
              </button>
            </div>
          </div>

          {entry.dailyTotalHint && (
            <p className="fsx-sh-hint">{entry.dailyTotalHint}</p>
          )}

          {/* Footer */}
          <button
            type="button"
            className="fsx-sh-btn is-warn"
            onClick={() => { removeAllFor(entry.pantryItemId); close() }}
          >
            <Icon name="trash" size={12} /> Eltávolítás a stackből
          </button>

          <div style={{ height: 24 }} />
        </div>
      )}
    </Sheet>
  )
}
