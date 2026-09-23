import type { PantrySuggestion } from '@/data/types'
import { pantrySources } from '@/data/pantrySources'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'

// onAdd is optional on purpose (P6, mezo-bka): the deterministic swap suggestions reference
// items already on the shelf, so v1 renders no CTA — an inert "Polcra" would be a false
// affordance. Wire onAdd when a real add-flow exists (P8 reasoned suggestions).
//
// Üveg (mezo-me75u.2, prototypes/uveg-fuel-tobbi.html `kamra()` „Okosabb csere"): a suggestion
// is not a shelf object, so it is a DASHED sage outline (bible §3 rank 4) — no glass, no glow.
// The source reads as the round capture-mode badge the Kamra tiles wear (fotó · link ·
// katalógus · kézi), named for assistive tech by the concrete source label.
export function SuggestionCard({ sug, onAdd }: { sug: PantrySuggestion; onAdd?: () => void }) {
  const prov = pantryProvenance({ source: sug.source })
  const sourceLabel = (pantrySources[sug.source] ?? pantrySources.manual).label
  return (
    <div className="fkk-swap uv-empty rise">
      <div className="fkk-swap-top">
        <strong>{sug.name}</strong>
        <em className="fkk-srcb" role="img" aria-label={sourceLabel} title={sourceLabel}>
          <Icon3D name={prov.icon} size={17} />
        </em>
        <b>{sug.price}</b>
      </div>
      <p>
        <span aria-hidden="true"><Icon3D name="t-score" size={18} /></span>
        {sug.reason}
      </p>
      {onAdd && (
        <button type="button" className="fkk-swap-add" onClick={onAdd}>
          <Icon name="plus" size={11} /> Polcra
        </button>
      )}
    </div>
  )
}
