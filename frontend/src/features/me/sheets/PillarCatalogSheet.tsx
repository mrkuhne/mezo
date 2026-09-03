import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useSignalCatalog } from '@/data/hooks'
import type { SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'

// Pillar catalog bottom sheet (Task 10, mezo-iizd.1) — lists the closed 28-entry signal
// catalog (`useSignalCatalog`) grouped by its Hungarian `group` label, one chip per entry.
// Follows the house sheet idiom (frontend_conventions.md §7 "Add a bottom-sheet"): no `open`
// prop — the opener owns the boolean and conditionally mounts this component, same shell/
// open-close contract as `EditGoalSheet`/`AiSuggestSheet`.
export function PillarCatalogSheet({ onClose, onPick }: { onClose: () => void; onPick: (entry: SignalCatalogEntry) => void }) {
  const { entries } = useSignalCatalog()
  const groups = Array.from(new Set(entries.map((e) => e.group)))

  return (
    <Sheet onClose={onClose} labelledBy="pillar-catalog-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 id="pillar-catalog-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              Pillér a katalógusból
            </h2>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {groups.map((group) => (
            <div key={group} className="col gap-sm mt-sm">
              <span className="mz-eyebrow">{group}</span>
              <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                {entries.filter((e) => e.group === group).map((e) => (
                  <button
                    key={e.label}
                    type="button"
                    className="chip"
                    onClick={() => onPick(e)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="row gap-sm mt-lg">
            <button type="button" className="cta-ghost flex-1" onClick={close}>Mégse</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
