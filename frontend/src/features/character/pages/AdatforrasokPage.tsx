// ============================================================
// Mezo · Karakter — AdatforrasokPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-leltar` (`renderBekotve`,
// `renderTervezett`) — a Bekötve | Tervezett segmented control. Bekötve is a single sage
// `leltarcard` (one row per cadence, a checkmark + value chips). Tervezett is a compact
// 4-row index (round number + title + item count) into the per-round mini-pages, plus a
// "+ még N terület később" tail line off `INVENTORY.later`.
//
// Route idiom (brief's explicit call): the four kör mini-pages are DISCRETE, indexed items —
// same shape as DimensionsPage's tiles into `/mezo/karakter/dimenzio/:key` — not a continuous,
// steppable range like FutasokPage's `?start=` week window. A path param sibling therefore
// matches the app's own idiom better than a query param: `/mezo/karakter/gepterem/adatforrasok/
// kor/:n`, not `?kor=`.
//
// Content is entirely static (`@/features/character/inventory.ts`) — see that file's header
// for why (it IS the mezo-1gim.15 checklist, not a live catalog read).
//
// Fix round 1 (coordinator review): the Bekötve|Tervezett segment used to be raw `useState`,
// which reset to Bekötve every time this page remounted — including the round-trip into a kör
// mini-page and back, breaking the browsing flow the prototype preserved. This is exactly the
// bug `useStickyTab` (`@/shared/hooks/useStickyTab.ts`) exists to fix — "the global rule for
// [in-view tab/segment switchers] instead of raw useState" — the same idiom Sport/Futás/Fuel-
// slots/Memória already use for their own in-view segmented controls. Switched to it; the
// segment now survives the kör round-trip (and a reload within the session) via sessionStorage,
// keyed `character.adatforrasok.view`.
//
// Üveg re-dress (U9, mezo-me75u.9) — uveg-mezo-teljes-u9.js `adatforrasok()`: slate dev-door
// head, a flat segmented control (the selected half lit sage), Bekötve as ONE flat `tf-tlist`
// (t-tick + value chips), Tervezett as the dashed all-landed line (or flat round-index rows).
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/insights/boop-world.css'
import { Icon3D } from '@/shared/ui/clay'
import { GepteremHead } from '@/features/character/components/GepteremHead'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { INVENTORY_LATER, INVENTORY_READS, INVENTORY_ROUNDS } from '@/features/character/inventory'

type Segment = 'bekotve' | 'tervezett'

export function AdatforrasokPage() {
  const navigate = useNavigate()
  const [seg, setSeg] = useStickyTab<Segment>('character.adatforrasok.view', 'bekotve')

  return (
    <div className="tf-page tf-c-slate gtm-page gtm-adat">
      <GepteremHead small="Gépterem · mit olvas a rendszer ma, és mit tervez" title="Adatforrások"
        onBack={() => navigate('/mezo/karakter/gepterem')} />
      <div className="gtm-seg" role="tablist" aria-label="Adatforrások nézet">
        <button
          type="button"
          role="tab"
          aria-selected={seg === 'bekotve'}
          className={seg === 'bekotve' ? 'on' : ''}
          onClick={() => setSeg('bekotve')}
        >
          Bekötve
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seg === 'tervezett'}
          className={seg === 'tervezett' ? 'on' : ''}
          onClick={() => setSeg('tervezett')}
        >
          Tervezett
        </button>
      </div>

      {seg === 'bekotve' && (
        <div className="tf-tlist gtm-reads">
          {INVENTORY_READS.map((r) => (
            <div className="tf-trow" key={r.w}>
              <Icon3D name="t-tick" size={22} />
              <span className="tf-ttx">
                <span className="tf-ttitle">{r.w}</span>
                {r.chips.length > 0 && (
                  <span className="gtm-vchips">
                    {r.chips.map((c) => (
                      <span className="gtm-vchip" key={c}>{c}</span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {seg === 'tervezett' && (
        <>
          {INVENTORY_ROUNDS.length === 0 && (
            <div className="tf-dash gtm-landed">
              <Icon3D name="t-tick" size={24} /><span>Mind a négy kör bekötve.</span>
            </div>
          )}
          {INVENTORY_ROUNDS.length > 0 && (
            <div className="tf-tlist gtm-rounds">
              {INVENTORY_ROUNDS.map((rnd) => (
                <button
                  type="button"
                  key={rnd.n}
                  className="tf-trow gtm-korrow"
                  onClick={() => navigate(`/mezo/karakter/gepterem/adatforrasok/kor/${rnd.n}`)}
                >
                  <span className="tf-st tf-s-slate">{rnd.n}. KÖR</span>
                  <span className="tf-ttx">
                    <span className="tf-ttitle">{rnd.title}</span>
                    <span className="tf-tsub">{rnd.items.length} tétel</span>
                  </span>
                  <span className="gtm-chev" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
          <p className="gtm-lede gtm-later">+ még {INVENTORY_LATER.length} terület később</p>
        </>
      )}
    </div>
  )
}
