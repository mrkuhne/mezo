// ============================================================
// Mezo · ExerciseScopeSheet (mezo-mobji) — the second step of a mid-workout swap / add: the chosen exercise,
// then how long the change holds — „Csak ma" and „A tervben is", each carrying its own one-line consequence.
// One tap decides and closes. An exercise with no plan slot (added today only, or the fixed closing block)
// gets only „Csak ma" plus a note.
//
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `scope` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): the chosen exercise is a row whose capsules show what stays
// with the old one (full, in the old muscle's colour) and what the new one gets (empty, in its own).
// ============================================================
import type { ExerciseLibraryItem } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { Caps, FoSheetHead, Lab, Note, Row } from '@/shared/ui/folyadek'
import { Sheet } from '@/shared/ui/Sheet'

export type ChangeScope = 'TODAY' | 'MESO'

export interface ExerciseScopeSheetProps {
  mode: 'swap' | 'add'
  item: ExerciseLibraryItem
  /** The exercise being replaced (swap only). */
  replacedName?: string
  /** Its muscle — the colour of the capsules that stay with it. Absent → they wear the new one's colour. */
  replacedMuscle?: string
  /** Working sets already logged on the replaced exercise, and how many the new one gets. */
  loggedOnReplaced?: number
  newSets: number
  repLabel: string
  /** Whether „A tervben is" is on offer (false: no plan slot). */
  planSlot: boolean
  /** Why there is no plan slot, shown under the lone „Csak ma". */
  noPlanNote?: string | null
  /** e.g. „A Hypertrophy 04 hátralévő 3 hetében is." — null without a running plan. */
  mesoLine: string | null
  /** The exercise's last top set („70 × 12"), or null when it was never done. */
  lastTop: string | null
  onChoose: (scope: ChangeScope) => void
  onClose: () => void
}

/** A sentence as the quiet second line of a row: it starts in lower case there. */
const asHint = (text: string) => text.charAt(0).toLocaleLowerCase('hu') + text.slice(1)

export function ExerciseScopeSheet({
  mode, item, replacedName, replacedMuscle, loggedOnReplaced = 0, newSets, repLabel, planSlot, noPlanNote, mesoLine, lastTop, onChoose, onClose,
}: ExerciseScopeSheetProps) {
  const swap = mode === 'swap'
  const kept = swap ? loggedOnReplaced : 0
  const lead = swap
    ? kept > 0
      ? `A ${kept} kész szett a ${replacedName}-nál marad, a hátralévő ${newSets} szett az újé.`
      : `Ugyanott, ugyanúgy ${newSets} szett.`
    : `${newSets} szett · ${repLabel} ismétlés — a gyakorlat típusához szabva, utána átírhatod.`
  const offerMeso = planSlot && mesoLine != null
  return (
    <Sheet onClose={onClose} labelledBy="scope-title" className="sheet-nested fo-sheet el-sheet">
      {(close) => {
        const choose = (scope: ChangeScope) => {
          onChoose(scope)
          close()
        }
        return (
          <>
            <FoSheetHead
              eyebrow={swap ? 'Gyakorlat cseréje' : 'Gyakorlat hozzáadása'} titleId="scope-title" onClose={close}
              title={swap ? `${replacedName} → ${item.name}` : item.name} sub={lead}
            />
            <div className="el-ls">
              <Row
                left={<Mchp muscle={item.muscle} />} title={item.name}
                sub={`${MUSCLE_LABELS[item.muscle] ?? item.muscle} · ${lastTop ? `múltkor ${lastTop} — innen jön a javaslat` : 'még nem csináltad — a súlyt te adod meg'}`}
                right={(
                  <span className="el-scope-caps">
                    {kept > 0 && <Caps n={kept} done={kept} color={deepMuscle(replacedMuscle ?? item.muscle)} />}
                    <Caps n={newSets} done={0} color={deepMuscle(item.muscle)} />
                  </span>
                )}
              />
            </div>
            <Lab>Meddig érvényes?</Lab>
            <div className="el-ls">
              <Row icon="t-calendar" title="Csak ma" sub="a mai edzésre. Jövő héten a régi terv jön." onClick={() => choose('TODAY')} />
              {offerMeso && (
                <Row icon="t-peak" title="A tervben is" sub={`${asHint(mesoLine)} A mentett sablonod nem változik.`} onClick={() => choose('MESO')} />
              )}
            </div>
            {!planSlot && noPlanNote && <Note>{noPlanNote}</Note>}
          </>
        )
      }}
    </Sheet>
  )
}
