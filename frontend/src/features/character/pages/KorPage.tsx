// ============================================================
// Mezo · Karakter — KorPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-kor` (`openKor`) — the
// generic per-round mini-page: hero ("{n}. KÖR" / "{title} · {itemCount} tétel") + one dashed
// `leltarcard` of rows (each row's meta: a single ghost detector chip when it names exactly
// one detector key, a "{n} detektor" count when it names several, and/or an ÉRZÉKENY dot).
//
// Route: `/mezo/karakter/gepterem/adatforrasok/kor/:n` (path param — see AdatforrasokPage's
// header comment for the sibling-idiom reasoning). An unknown/out-of-range `:n` renders the
// same honest not-found face RunPage uses — never a crash on a stray URL.
//
// Üveg re-dress (U9, mezo-me75u.9) — uveg-mezo-teljes-u9.js `kor()`: slate dev-door head, a
// dashed not-found line; the populated face is the same flat `tf-tlist` idiom as Adatforrások
// (the ÉRZÉKENY dot stays lavender — never a red flag).
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/insights/boop-world.css'
import { Icon3D } from '@/shared/ui/clay'
import { GepteremHead } from '@/features/character/components/GepteremHead'
import { INVENTORY_ROUNDS, type InventoryItem } from '@/features/character/inventory'

function ItemRow({ item }: { item: InventoryItem }) {
  const detCount = item.det?.length ?? 0
  return (
    <div className="tf-trow gtm-item">
      <span className="tf-ttx"><span className="tf-ttitle">{item.t}</span></span>
      {(detCount > 0 || item.sensitive === true) && (
        <span className="gtm-rmeta">
          {item.sensitive === true && <span className="gtm-sensdot" title="érzékeny" aria-label="érzékeny" />}
          {detCount === 1 && <span className="gtm-det">{item.det![0]}</span>}
          {detCount > 1 && <span className="gtm-detcount">{detCount} detektor</span>}
        </span>
      )}
    </div>
  )
}

export function KorPage() {
  const { n } = useParams<{ n: string }>()
  const navigate = useNavigate()
  const round = INVENTORY_ROUNDS.find((r) => r.n === Number(n))

  const goBack = () => navigate('/mezo/karakter/gepterem/adatforrasok')

  if (round == null) {
    return (
      <div className="tf-page tf-c-slate gtm-page gtm-kor">
        <GepteremHead small="Adatforrások" title="Egy kör" onBack={goBack} />
        <div className="tf-dash gtm-notfound" data-state="not-found">
          <Icon3D name="t-info" size={26} /><span>Ez a kör nem található.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="tf-page tf-c-slate gtm-page gtm-kor">
      <GepteremHead small="Adatforrások" title={`${round.n}. KÖR`} onBack={goBack} />
      <p className="gtm-lede">{`${round.title} · ${round.items.length} tétel`}</p>
      <div className="tf-tlist gtm-items">
        {round.items.map((item) => (
          <ItemRow item={item} key={item.t} />
        ))}
      </div>
    </div>
  )
}
