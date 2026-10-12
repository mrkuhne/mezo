// Mezo · SuggestionCard — az „Okosabb csere" egy javaslata a Kamrában (Folyadék F5, mezo-n4wf5.5; prototípus
// `fuel.js` `kamra()` `.fc-swap`). Javaslat, nem polc-tárgy: szaggatott keret, a csere-jel buborékban, a név, alatta a
// felvétel módja és a forrás, jobbra az ár, alul az indok.
//
// A KÁRTYA MAGA NEM KOPPINTHATÓ (owner: „a koppintható csere-javaslat" kikerült). `onAdd` szándékosan opcionális
// (P6, mezo-bka): a szabály szerinti javaslat a polcon lévő tételre mutat, ezért v1-ben nincs gomb — egy tétlen
// „Polcra" hamis ígéret volna. A gomb csak akkor jelenik meg, ha a hívó valódi felvételt köt rá.
// Az `reason` a szerver mondata (a fiók nyelvén érkezik), a `price` nyelvfüggetlen szerver-szöveg: mindkettő úgy megy ki, ahogy jön.
import type { PantrySuggestion } from '@/data/types'
import { useM } from '@/shared/i18n'
import { Acts, Btn, Bub } from '@/shared/ui/folyadek'
import { pantryProvenance } from '@/features/fuel/logic/pantryProvenance'

export function SuggestionCard({ sug, onAdd }: { sug: PantrySuggestion; onAdd?: () => void }) {
  const M = useM()
  const prov = pantryProvenance({ source: sug.source })
  return (
    <div className="fp-swap">
      <div>
        <Bub icon="t-swap" size={40} />
        <span><strong>{sug.name}</strong><small>{prov.kindLabel} · {prov.sourceLabel}</small></span>
        <b>{sug.price}</b>
      </div>
      <p>{sug.reason}</p>
      {onAdd && <Acts><Btn sm ghost onClick={onAdd}>{M.fuelKamra.kamra.swapAdd}</Btn></Acts>}
    </div>
  )
}
