// ============================================================
// Mezo · EletjelStrip — a NapMezoPage Életjelek fülének hat kémcsöve (mezo-ho9k; Folyadék
// mezo-n4wf5.2, prototípus vilagos/nap.js `needVials(h, go)`): jelenként egy kémcső, a szint a
// jel értéke. Minden kémcső UGYANODA visz — a teljes /nap/eletjel oldalra —, a sáv egésze egy
// navigáció. Honest states: pending alatt a hívó nem rendereli (nincs kitalált százalék).
// Színt csak a piros/kritikus jel kap (figyelmeztető szín + „figyelj" jelölés).
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'
import { Vials, type Member } from '@/shared/ui/folyadek'
import type { NeedKey, NeedState } from '@/features/today/logic/needs'
import { needsAttention } from '@/features/today/logic/needsAverage'
import { NEED_KEYS, VITAL_TILE } from '@/features/today/pages/EletjelPage'

/** Melyik szakterület szól egy jelről (bible §6): az étel és a víz az Étkezésé, az alvás az
 *  Alvásé, a mozgás a Mozgásé, a kapcsolat a Közérzeté; a rend az összképé (Mezo). */
const NEED_MEMBER: Record<NeedKey, Member> = {
  energia: 'falat', hidratacio: 'falat', pihenes: 'szunya', mozgas: 'mocor', lelek: 'deru', rend: 'mezo',
}

/** Egy nudge-kártya a kiváltó jel ikonját hordozza (`MezoMessageItem.icon`, `NEED_ICON`-ból) —
 *  ebből kapja vissza a megszólaló szakterületet. Ismeretlen ikonra `undefined`. */
export function needMemberForIcon(icon: ClayIconName | undefined): Member | undefined {
  if (!icon) return undefined
  const key = NEED_KEYS.find((k) => VITAL_TILE[k].icon === icon)
  return key ? NEED_MEMBER[key] : undefined
}

export function EletjelStrip({ states, onOpen }: { states: NeedState[]; onOpen: () => void }) {
  return (
    <div className="nb-strip" role="group" aria-label="Életjelek részletei">
      <Vials size="xs" height={104} items={states.map((s) => {
        const warn = needsAttention(s)
        return {
          label: VITAL_TILE[s.key].eyebrow, icon: VITAL_TILE[s.key].glyph, value: s.pct, pct: s.pct,
          color: warn ? 'var(--fo-warn)' : undefined, mark: warn ? 'figyelj' : undefined, onClick: onOpen,
        }
      })} />
    </div>
  )
}
