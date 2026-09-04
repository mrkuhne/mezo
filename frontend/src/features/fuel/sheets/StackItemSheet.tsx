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
// ============================================================
import { useState } from 'react'
import { useProtocolActions, useStack } from '@/data/hooks'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackZoneKey } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'

export function StackItemSheet({ entry, onClose }: { entry: StackDayEntry; onClose: () => void }) {
  const { stash } = useStack()
  const { moveItem, setDose, unpinItem, addItem, removeAllFor } = useProtocolActions()

  const [dose, setDoseValue] = useState(entry.dose ?? '')
  const stashItem = stash.find(s => s.id === entry.pantryItemId)
  const [addZone, setAddZone] = useState<StackZoneKey>(STACK_ZONE_ORDER[0])
  const [addDose, setAddDose] = useState(stashItem?.dose ?? '')

  return (
    <Sheet onClose={onClose} labelledBy="stack-item-title">
      {(close) => (
        <div className="stk-item-sheet">
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col">
              <Eyebrow brand>Stack · időzítés</Eyebrow>
              <div id="stack-item-title" style={{ marginTop: 4 }}>
                <Display size="md">{entry.name}</Display>
              </div>
              {entry.dose && (
                <span className="label-mono text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>{entry.dose}</span>
              )}
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Placement — F7.3: the tinted hero band (mz-sheet-hero), the sheet's headline */}
          <div className="mz-sheet-hero" style={{ padding: 12, marginBottom: 14, display: 'block' }}>
            {entry.pinned ? (
              <>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  „📌 Ide raktad kézzel ({STACK_ZONE_LABEL[entry.persistedZone]})"
                </p>
                <button
                  type="button"
                  className="cta-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => { unpinItem(entry.occurrenceId); close() }}
                >
                  Vissza autóra
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {entry.reason ?? 'Automatikusan időzítve.'}
              </p>
            )}
          </div>

          {/* Zone picker */}
          <Eyebrow>Mozgatás másik zónába</Eyebrow>
          <div className="row gap-xs flex-wrap" style={{ margin: '8px 0 14px' }}>
            {STACK_ZONE_ORDER.map(zone => {
              const isCurrent = zone === entry.persistedZone
              return (
                <button
                  key={zone}
                  type="button"
                  className="chip"
                  disabled={isCurrent}
                  onClick={isCurrent ? undefined : () => { moveItem(entry.occurrenceId, zone); close() }}
                >
                  {STACK_ZONE_LABEL[zone]}{isCurrent && ' ✓'}
                </button>
              )
            })}
          </div>

          {/* Dose editor */}
          <Eyebrow>Dózis</Eyebrow>
          <div className="card" style={{ padding: '8px 12px', margin: '8px 0 14px' }}>
            <input
              aria-label="Dózis"
              value={dose}
              onChange={e => setDoseValue(e.target.value)}
              onBlur={() => setDose(entry.occurrenceId, dose)}
              style={{ fontSize: 13, color: 'var(--text-primary)', width: '100%' }}
            />
          </div>

          {/* + Még egy bevétel */}
          <Eyebrow>+ Még egy bevétel</Eyebrow>
          <div className="card" style={{ padding: 12, margin: '8px 0 14px' }}>
            <div className="row gap-xs flex-wrap" style={{ marginBottom: 8 }}>
              {STACK_ZONE_ORDER.map(zone => (
                <button
                  key={zone}
                  type="button"
                  className="chip"
                  aria-pressed={zone === addZone}
                  style={
                    zone === addZone
                      ? { borderColor: 'var(--coral)', color: 'var(--coral-deep)', background: 'color-mix(in srgb, var(--coral) 6%, transparent)' }
                      : undefined
                  }
                  onClick={() => setAddZone(zone)}
                >
                  {STACK_ZONE_LABEL[zone]}
                </button>
              ))}
            </div>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <input
                aria-label="Új bevétel dózisa"
                value={addDose}
                onChange={e => setAddDose(e.target.value)}
                placeholder="Dózis"
                style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                className="chip brand"
                onClick={() => addItem(entry.pantryItemId, { slotKey: addZone, dose: addDose || undefined })}
              >
                <Icon name="plus" size={11} /> Hozzáadás
              </button>
            </div>
          </div>

          {entry.dailyTotalHint && (
            <p className="label-mono text-tertiary" style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 14 }}>
              {entry.dailyTotalHint}
            </p>
          )}

          {/* Footer */}
          <button
            type="button"
            className="cta-ghost"
            style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)' }}
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
