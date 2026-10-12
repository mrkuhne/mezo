// Mezo · SourceBadge — a kamra-tétel forrása csendes címkeként (Folyadék F5, mezo-n4wf5.5: a kit `St`-je, nem saját recept).
// A felirat a forrás neve a pillanatnyi nyelven (`pantrySourceLabel`): a boltnevek tulajdonnevek, a „Saját bevitel" és a
// „Fotó" szavak. A `size` megmaradt a hívók kedvéért; a Folyadék címkének egy mérete van.
import type { PantrySourceKey } from '@/data/pantrySources'
import { useM } from '@/shared/i18n'
import { St } from '@/shared/ui/folyadek'
import { pantrySourceLabel } from '@/features/fuel/logic/pantryProvenance'

export function SourceBadge({ source }: { source: PantrySourceKey; size?: 'sm' | 'lg' }) {
  useM() // re-render on a language switch: the label is read from the catalog at render
  return <St>{pantrySourceLabel(source)}</St>
}
