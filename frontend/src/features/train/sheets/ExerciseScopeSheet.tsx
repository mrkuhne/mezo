// ============================================================
// Mezo · ExerciseScopeSheet (mezo-mobji) — the second step of a mid-workout swap/add: the
// chosen exercise, then two option rows, „Csak ma” (lit, the default) and „Mezociklusra is”,
// each carrying its own one-line consequence. One tap decides and closes. An exercise with no
// plan slot (added today only, or the fixed closing block) gets only „Csak ma” plus a note.
// Approved look: docs/design_2.0/prototypes/elo/edzes.html, sheet `scope` (owner OK 2026-09-28).
// ============================================================
import type { ExerciseLibraryItem } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Sheet } from '@/shared/ui/Sheet'

export type ChangeScope = 'TODAY' | 'MESO'

export interface ExerciseScopeSheetProps {
  mode: 'swap' | 'add'
  item: ExerciseLibraryItem
  /** The exercise being replaced (swap only). */
  replacedName?: string
  /** Working sets already logged on the replaced exercise, and how many the new one gets. */
  loggedOnReplaced?: number
  newSets: number
  repLabel: string
  /** Whether „Mezociklusra is” is on offer (false: no plan slot). */
  planSlot: boolean
  /** Why there is no plan slot, shown under the lone „Csak ma”. */
  noPlanNote?: string | null
  /** e.g. „A Hypertrophy 04 hátralévő 3 hetében is.” — null without an active meso. */
  mesoLine: string | null
  /** The exercise's last top set („70 × 12”), or null when it was never done. */
  lastTop: string | null
  onChoose: (scope: ChangeScope) => void
  onClose: () => void
}

function ScopeOption({
  icon, label, hint, lit, onClick,
}: { icon: Icon3DName; label: string; hint: string; lit?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={lit ? 'wos-scope-opt is-lit' : 'wos-scope-opt'} onClick={onClick}>
      <Icon3D name={icon} size={34} />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <b aria-hidden="true">›</b>
    </button>
  )
}

export function ExerciseScopeSheet({
  mode, item, replacedName, loggedOnReplaced = 0, newSets, repLabel, planSlot, noPlanNote, mesoLine, lastTop, onChoose, onClose,
}: ExerciseScopeSheetProps) {
  const swap = mode === 'swap'
  const lead = swap
    ? loggedOnReplaced > 0
      ? `A ${loggedOnReplaced} kész szett a ${replacedName}-nál marad, a hátralévő ${newSets} szett az újé.`
      : `Ugyanott, ugyanúgy ${newSets} szett.`
    : `${newSets} szett · ${repLabel} ismétlés — a gyakorlat típusához szabva, utána átírhatod.`
  const offerMeso = planSlot && mesoLine != null
  return (
    <Sheet onClose={onClose} labelledBy="scope-title" className="sheet-nested glass wos-sheet is-sky">
      {(close) => {
        const choose = (scope: ChangeScope) => {
          onChoose(scope)
          close()
        }
        return (
          <>
            <div className="wos-sheet-head">
              <Icon3D name={swap ? 't-swap' : 't-addex'} size={52} className="wos-sheet-art3d" />
              <span className="wos-sheet-title">
                <span className="wos-sheet-eb">{swap ? 'Gyakorlat cseréje' : 'Gyakorlat hozzáadása'}</span>
                <h3 id="scope-title">{swap ? `${replacedName} → ${item.name}` : item.name}</h3>
              </span>
            </div>
            <p className="wos-sheet-lead">{lead}</p>
            <div className="wos-scope-ex">
              <MuscleChip token={item.muscle} size={40} />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {MUSCLE_LABELS[item.muscle] ?? item.muscle} ·{' '}
                  {lastTop ? `múltkor ${lastTop} — innen jön a javaslat` : 'még nem csináltad — a súlyt te adod meg'}
                </small>
              </span>
            </div>
            <div className="wos-scope-opts">
              <ScopeOption icon="t-calendar" label="Csak ma" hint="A mai edzésre. Jövő héten a régi terv jön." lit onClick={() => choose('TODAY')} />
              {offerMeso && (
                <ScopeOption
                  icon="t-peak"
                  label="Mezociklusra is"
                  hint={`${mesoLine} A mentett sablonod nem változik.`}
                  onClick={() => choose('MESO')}
                />
              )}
            </div>
            {!planSlot && noPlanNote && <p className="wos-sheet-hint">{noPlanNote}</p>}
          </>
        )
      }}
    </Sheet>
  )
}
