// ============================================================
// Mezo · StackItemSheet (mezo-vx9v Task 8; Folyadék F5, mezo-n4wf5.5) — prototype sheet `stackitem`.
// Opened by tapping a row of the Protokoll page. Shows why the occurrence landed where it did (a manual pin with the
// one-tap „Vissza automatikusra"; or the engine's own STORED reason), lets the user move it to another time slot, edit
// its dose (saved on blur), add one more intake of the same pantry item in another slot, or remove every occurrence of it.
//
// Every mutation goes through useProtocolActions() and relies on the global mutation-error toast — no local try/catch.
// Moving, unpinning and removing close the sheet right after firing the mutation; „+ Még egy bevétel" deliberately leaves
// it open (adding a second occurrence is something the user may repeat).
// ============================================================
import { useId, useState } from 'react'
import { useProtocolActions, useStack } from '@/data/hooks'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import type { StackZoneKey } from '@/data/types'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, FoSheetHead, Input, Lab, Lk, Note, Pill, Pills } from '@/shared/ui/folyadek'
import { Tip } from '@/features/fuel/components/folyadek'

export function StackItemSheet({ entry, onClose }: { entry: StackDayEntry; onClose: () => void }) {
  const M = useM().fuelKieg
  const doseId = useId()
  const { stash } = useStack()
  const { moveItem, setDose, unpinItem, addItem, removeAllFor } = useProtocolActions()

  const [dose, setDoseValue] = useState(entry.dose ?? '')
  const stashItem = stash.find(s => s.id === entry.pantryItemId)
  const [addZone, setAddZone] = useState<StackZoneKey>(STACK_ZONE_ORDER[0])
  const [addDose, setAddDose] = useState(stashItem?.dose ?? '')

  return (
    <Sheet onClose={onClose} labelledBy="stack-item-title" className="fo-sheet fk-sheet">
      {(close) => (
        <>
          <FoSheetHead icon="t-supps" title={entry.name} titleId="stack-item-title"
            sub={entry.dose ? M.timing.subDose(entry.dose) : M.timing.sub} />

          {/* Placement — the sheet's headline line */}
          {entry.pinned ? (
            <>
              <Tip icon="t-pin" title={M.timing.pinned(STACK_ZONE_LABEL[entry.persistedZone])} />
              <Acts><Btn sm ghost onClick={() => { unpinItem(entry.occurrenceId); close() }}>{M.timing.backToAuto}</Btn></Acts>
            </>
          ) : (
            <div className="fk-why"><Tip icon="t-bolt" title="">{entry.reason ?? M.timing.auto}</Tip></div>
          )}

          {/* Move to another slot */}
          <Lab>{M.timing.move}</Lab>
          <Pills>
            {STACK_ZONE_ORDER.map(zone => {
              const isCurrent = zone === entry.persistedZone
              return isCurrent
                ? <Pill key={zone} on disabled aria-label={M.timing.current(STACK_ZONE_LABEL[zone])}>{STACK_ZONE_LABEL[zone]}</Pill>
                : <Pill key={zone} onClick={() => { moveItem(entry.occurrenceId, zone); close() }}>{STACK_ZONE_LABEL[zone]}</Pill>
            })}
          </Pills>

          {/* Dose editor — saved on blur */}
          <Lab htmlFor={doseId}>{M.timing.dose}</Lab>
          <Input id={doseId} value={dose} onChange={e => setDoseValue(e.target.value)}
            onBlur={() => setDose(entry.occurrenceId, dose)} />

          {/* + one more intake */}
          <Lab>{M.timing.oneMore}</Lab>
          <Pills role="group" aria-label={M.timing.slot}>
            {STACK_ZONE_ORDER.map(zone => (
              <Pill key={zone} on={zone === addZone} onClick={() => setAddZone(zone)}>{STACK_ZONE_LABEL[zone]}</Pill>
            ))}
          </Pills>
          <div className="fk-add">
            <Input aria-label={M.timing.newDose} value={addDose} onChange={e => setAddDose(e.target.value)}
              placeholder={M.timing.dose} />
            <Btn sm ghost onClick={() => addItem(entry.pantryItemId, { slotKey: addZone, dose: addDose || undefined })}>
              {M.timing.add}
            </Btn>
          </div>

          {entry.dailyTotalHint && <Note>{entry.dailyTotalHint}</Note>}

          <Acts>
            <Lk onClick={() => { removeAllFor(entry.pantryItemId); close() }}>{M.timing.remove}</Lk>
            <Lk onClick={close}>{M.common.close}</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
