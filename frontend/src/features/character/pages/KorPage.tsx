// ============================================================
// Mezo · Karakter — KorPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-kor` (`openKor`) — the
// generic per-round mini-page: hero ("{n}. KÖR" / "{title} · {itemCount} tétel") + one dashed
// `leltarcard` of rows (each row's meta: a single ghost detector chip when it names exactly
// one detector key, a "{n} detektor" count when it names several, and/or an ÉRZÉKENY dot).
//
// Route: `/me/karakter/gepterem/adatforrasok/kor/:n` (path param — see AdatforrasokPage's
// header comment for the sibling-idiom reasoning). An unknown/out-of-range `:n` renders the
// same `.kr-degraded` 404 face RunPage/DimensionPage use — never a crash on a stray URL.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import { PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { INVENTORY_ROUNDS, type InventoryItem } from '@/features/character/inventory'

function ItemRow({ item }: { item: InventoryItem }) {
  const detCount = item.det?.length ?? 0
  return (
    <div className="kr-lrow">
      <div className="kr-lw">{item.t}</div>
      {(detCount > 0 || item.sensitive === true) && (
        <div className="kr-rmeta">
          {item.sensitive === true && <span className="kr-sensdot" title="érzékeny" aria-label="érzékeny" />}
          {detCount === 1 && <span className="kr-detchip ghost">{item.det![0]}</span>}
          {detCount > 1 && <span className="kr-detcount">{detCount} detektor</span>}
        </div>
      )}
    </div>
  )
}

export function KorPage() {
  const { n } = useParams<{ n: string }>()
  const navigate = useNavigate()
  const round = INVENTORY_ROUNDS.find((r) => r.n === Number(n))

  const goBack = () => navigate('/me/karakter/gepterem/adatforrasok')

  if (round == null) {
    return (
      <div className="kr-hub">
        <PageHead onBack={goBack} label="‹ Adatforrások" />
        <div className="kr-degraded">Ez a kör nem található.</div>
      </div>
    )
  }

  return (
    <div className="kr-hub">
      <PageHead onBack={goBack} label="‹ Adatforrások" />
      <PageHero name={`${round.n}. KÖR`} sub={`${round.title} · ${round.items.length} tétel`} />
      <PageBody>
        <div className="kr-leltarcard dashed">
          {round.items.map((item) => (
            <ItemRow item={item} key={item.t} />
          ))}
        </div>
      </PageBody>
    </div>
  )
}
