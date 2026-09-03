// ============================================================
// Mezo · Karakter — AdatforrasokPage (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-leltar` (`renderBekotve`,
// `renderTervezett`) — a Bekötve | Tervezett segmented control. Bekötve is a single sage
// `leltarcard` (one row per cadence, a checkmark + value chips). Tervezett is a compact
// 4-row index (round number + title + item count) into the per-round mini-pages, plus a
// "+ még N terület később" tail line off `INVENTORY.later`.
//
// Route idiom (brief's explicit call): the four kör mini-pages are DISCRETE, indexed items —
// same shape as DimensionsPage's tiles into `/me/karakter/dimenzio/:key` — not a continuous,
// steppable range like FutasokPage's `?start=` week window. A path param sibling therefore
// matches the app's own idiom better than a query param: `/me/karakter/gepterem/adatforrasok/
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
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { INVENTORY_LATER, INVENTORY_READS, INVENTORY_ROUNDS } from '@/features/character/inventory'

type Segment = 'bekotve' | 'tervezett'

export function AdatforrasokPage() {
  const navigate = useNavigate()
  const [seg, setSeg] = useStickyTab<Segment>('character.adatforrasok.view', 'bekotve')

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter/gepterem')} label="‹ Gépterem" />
      <PageHero name="Adatforrások" sub="mit olvas a rendszer ma, és mit tervez" />
      <PageBody>
        <div className="kr-leltarsegs" role="tablist" aria-label="Adatforrások nézet">
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
          <div className="kr-leltarcard sage">
            {INVENTORY_READS.map((r) => (
              <div className="kr-lrow" key={r.w}>
                <div className="kr-check" aria-hidden="true">✓</div>
                <div className="kr-lrow-grow">
                  <div className="kr-lw">{r.w}</div>
                  {r.chips.length > 0 && (
                    <div className="kr-valchips">
                      {r.chips.map((c) => (
                        <span className="kr-valchip" key={c}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {seg === 'tervezett' && (
          <>
            {INVENTORY_ROUNDS.length === 0 && (
              <div className="kr-laterline">Mind a négy kör bekötve.</div>
            )}
            {INVENTORY_ROUNDS.map((rnd) => (
              <button
                type="button"
                key={rnd.n}
                className="kr-korindex"
                onClick={() => navigate(`/me/karakter/gepterem/adatforrasok/kor/${rnd.n}`)}
              >
                <span className="kr-rnum">{rnd.n}. KÖR</span>
                <div className="kr-lrow-grow">
                  <div className="kr-kt">{rnd.title}</div>
                  <div className="kr-kc">{rnd.items.length} tétel</div>
                </div>
                <span className="kr-chev" aria-hidden="true">›</span>
              </button>
            ))}
            <div className="kr-laterline">+ még {INVENTORY_LATER.length} terület később</div>
          </>
        )}
      </PageBody>
    </div>
  )
}
