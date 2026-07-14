// ============================================================
// Mezo · ExerciseActionSheet — per-exercise "⋯" action menu (active workout).
// Built on the shared Sheet primitive. Hosts the FOUR active-workout-v2
// actions: ↕ Áthelyezés · ⊘ Kihagyás · ＋ Szett · ✎ Jegyzet.
//
// Slice 3 (F1) wires ONLY Áthelyezés (reorder of the remaining exercises,
// via the shared SortableList). The other three rows are entry points wired
// to optional handler props — each is rendered but `disabled` until its
// handler is provided by a later slice (Skip / Add-set / Note → 4/5/6).
// Reorder is client-only / ephemeral: it only re-orders session.order.
// ============================================================
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { SortableList } from '@/shared/ui/SortableList'

interface ExerciseActionSheetProps {
  /** Current exercise — titles the sheet. */
  exerciseName: string
  /** The reorderable (remaining / future) exercises. */
  remaining: { id: string; label: string }[]
  /** New id order of `remaining`. */
  onReorder: (ids: string[]) => void
  onSkip?: () => void
  onAddSet?: () => void
  onEditNote?: () => void
  /** Toggles the note row label (Jegyzet vs. Jegyzet szerkesztése). */
  hasNote?: boolean
  onClose: () => void
}

type View = 'menu' | 'reorder'

// One tappable action row (icon + label + chevron). Disabled rows are inert
// until a later slice passes the matching handler.
function ActionRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="card notch-4 row gap-sm"
      style={{
        padding: '12px 14px',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface-1)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={16} color="var(--text-secondary)" />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
      <Icon name="chevron-right" size={14} color="var(--text-tertiary)" />
    </button>
  )
}

export function ExerciseActionSheet({
  exerciseName,
  remaining,
  onReorder,
  onSkip,
  onAddSet,
  onEditNote,
  hasNote,
  onClose,
}: ExerciseActionSheetProps) {
  const [view, setView] = useState<View>('menu')

  return (
    <Sheet onClose={onClose} labelledBy="exercise-action-title">
      {(close) => {
        // Wire a row: run the action (if provided) then dismiss with the slide-down.
        const fire = (fn?: () => void) => () => {
          fn?.()
          close()
        }

        if (view === 'reorder') {
          return (
            <>
              <div className="row gap-sm" style={{ alignItems: 'center', marginBottom: 14 }}>
                <button
                  type="button"
                  aria-label="Vissza a műveletekhez"
                  onClick={() => setView('menu')}
                  className="chip notch-4"
                  style={{ padding: '6px 8px' }}
                >
                  <Icon name="chevron-up" size={12} />
                </button>
                <Display size="md">Áthelyezés</Display>
              </div>
              {remaining.length < 2 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                  Nincs átrendezhető gyakorlat
                </p>
              ) : (
                <SortableList
                  items={remaining}
                  onReorder={onReorder}
                  renderItem={(it) => (
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{it.label}</span>
                  )}
                />
              )}
            </>
          )
        }

        return (
          <>
            <div className="col" style={{ marginBottom: 14 }}>
              <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Gyakorlat műveletek</span>
              <div id="exercise-action-title" style={{ marginTop: 6 }}>
                <Display size="md">{exerciseName}</Display>
              </div>
            </div>
            <div className="col gap-sm">
              <ActionRow icon="train" label="Áthelyezés" onClick={() => setView('reorder')} />
              <ActionRow icon="anchor" label="Kihagyás" onClick={fire(onSkip)} disabled={!onSkip} />
              <ActionRow icon="plus" label="＋ Szett" onClick={fire(onAddSet)} disabled={!onAddSet} />
              <ActionRow
                icon="tool"
                label={hasNote ? 'Jegyzet szerkesztése' : 'Jegyzet'}
                onClick={fire(onEditNote)}
                disabled={!onEditNote}
              />
            </div>
          </>
        )
      }}
    </Sheet>
  )
}
