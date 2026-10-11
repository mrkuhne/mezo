// Mezo · the question after „Szett hozzáadása": only today, or every week (the plan row gets one more working set).
// Closing it without a choice = only today. Not offered for a today-only row (the caller decides).
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `extra` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): the sets as capsules with the new one half full, then the two answers.
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Caps, FoSheetHead, Lk, SheetGraphic, Txt } from '@/shared/ui/folyadek'
import { deepMuscle } from '@/features/train/components/folyadek'

export function ExtraSetPrompt({ onEveryWeek, onClose, slotCount, doneCount = 0, muscle }: {
  onEveryWeek: () => void
  onClose: () => void
  /** The exercise's set count NOW (the new one included). Absent → no capsules, no „Most n szett." line. */
  slotCount?: number
  /** How many of them are logged. */
  doneCount?: number
  /** The exercise's muscle — the capsules' colour. */
  muscle?: string
}) {
  return (
    <Sheet onClose={onClose} labelledBy="add-set-prompt-title" className="sheet-nested fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow="Extra szett hozzáadva" title="A tervbe is felvegyük?" titleId="add-set-prompt-title"
            sub={slotCount != null ? `Most ${slotCount} szett.` : undefined} icon="t-weight" onClose={close}
          />
          {slotCount != null && slotCount > 0 && (
            <SheetGraphic note="az utolsó az új">
              <Caps n={slotCount} done={Math.min(doneCount, slotCount - 1)} cur={slotCount - 1} color={muscle ? deepMuscle(muscle) : undefined} size="big" />
            </SheetGraphic>
          )}
          <Txt>
            Csak erre az alkalomra szól, vagy minden hétre — akkor a terved is eggyel több szettet ír elő ennél a gyakorlatnál.
          </Txt>
          <Acts>
            <Btn
              grow
              onClick={() => {
                onEveryWeek()
                close()
              }}
            >
              Minden hétre
            </Btn>
            <Lk onClick={close}>Csak ma</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
