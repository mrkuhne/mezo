import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
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
    <Sheet onClose={onClose} labelledBy="pillar-catalog-title" className="glass is-still enc-pcat">
      {(close) => (
        <div className="enc-pcat-body">
          <div className="enc-pcat-head">
            <Icon3D name="t-signal" size={44} />
            <h2 id="pillar-catalog-title">Pillér a katalógusból</h2>
            <button type="button" className="enc-pcat-x" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {groups.map((group) => (
            <div key={group} className="enc-pcat-sec">
              <span className="mz-eyebrow">{group}</span>
              <div className="enc-pcat-chips">
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

          <div className="enc-pcat-foot">
            <button type="button" className="cta-ghost" onClick={close}>Mégse</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
