// ============================================================
// Mezo · FuelLogPage — /fuel/log, the stacked-window logging page (mezo-byo1)
// Source of truth: docs/design_2.0/prototypes/fuel-logolas.html #page-log +
// docs/superpowers/specs/2026-08-31-fuel-logolas-2.0-design.md §2.
//
// The hub's Logolás hero tile opens this page (the Huawei „tile → own page"
// idiom); every user-scheduled eating window renders as ONE full-width
// WindowBlock, stacked vertically — done / now / missed / future — and the
// Logold/Pótold/✨ AI CTAs expand the MealComposer IN PLACE inside the block
// (mezo-bnsf: the block's window slotKey is the composer's fixedSlot, so the
// MIKOR segment never shows there). The trailing „Ablakon kívül" block is the
// standing slot-less log door (visible MIKOR segment); an empty day leads with
// the tervezz block instead of fabricating windows.
//
// Same composed day as the hub (useFuelDay/useFuelTimeline → buildWindowLane) —
// a save re-derives everything live: the page hero counter, the block states
// and the hub tile all follow the one day model.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FuelMeal } from '@/data/types'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { huInt } from '@/shared/lib/huNum'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { WindowBlock } from '@/features/fuel/components/WindowBlock'
import { MealComposer } from '@/features/fuel/components/MealComposer'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'

export function FuelLogPage() {
  const navigate = useNavigate()
  const { fuel } = useFuelDay()
  const { plan, budget } = useFuelTimeline()

  const lane = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const doneCount = lane.tiles.filter(t => t.state === 'done').length

  // One composer open at a time: a window tile's key, or 'free' for the trailing block.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [aiOnMount, setAiOnMount] = useState(false)
  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)

  const openComposer = (key: string, ai: boolean) => {
    setAiOnMount(ai)
    setOpenKey(key)
  }
  const closeComposer = () => {
    setOpenKey(null)
    setAiOnMount(false)
  }

  // A log opened FROM a window always carries that window's slotKey (mezo-bnsf) — and a
  // recipe-suggestion window pre-fills its plan recipe, exactly as the retired hub lane did.
  // An AI launch skips the prefill: the user chose the ✨ path, not the plan meal.
  const prefillFor = (tile: WindowTileVM, ai: boolean) => {
    if (ai) return null
    const slot = plan.slots.find(s => `${s.time}-${s.label}` === tile.key)
    return slot?.suggestedRecipeId ? { source: 'recipe' as const, recipeId: slot.suggestedRecipeId } : null
  }

  const openScoreForMeal = (mealId: string) => {
    const meal = fuel.meals.find(m => m.id === mealId)
    if (meal) setScoreMeal(meal)
  }

  return (
    <MozaikPage tone="coral" className="flog-page">
      <PageHead onBack={() => navigate('/fuel')} label="‹ Fuel" />
      <div className="mz-page-hero">
        <div className="mz-eyebrow" style={{ color: 'var(--coral)' }}>Logolás</div>
        <div className="mz-hero-row">
          <span className="mz-bignum">{huInt(fuel.consumed.kcal)}</span>
          <span className="flog-goal">/ {huInt(fuel.targets.kcal)} kcal</span>
        </div>
        <div className="mz-hero-sb">
          {lane.tiles.length > 0 ? `${doneCount}/${lane.tiles.length} ablak kész` : 'nincs mai étkezési ablak'}
        </div>
      </div>
      <PageBody principle="Egy felület, egy mozdulat: görgetsz a napodon, és ott logolsz, ahol az ablak van — a blokk kinyílik, elmenti, becsukódik.">
        <EntranceGroup>
          {/* No eating window scheduled at all today → the list leads with the üres-nap door. */}
          {lane.tiles.length === 0 && (
            <div className="flog-blk is-free rise" style={{ '--d': '30ms' } as React.CSSProperties}>
              <div className="flog-in">
                <div className="flog-top"><span className="flog-lbl">Üres nap</span></div>
                <div className="flog-main">
                  <div className="flog-icon"><ClayIcon name="i-fuel" size={34} /></div>
                  <div className="flog-txt">
                    <div className="flog-name is-ghost">Nincs mai terv</div>
                    <div className="flog-meta">tervezz ablakokat, és ide kerülnek</div>
                  </div>
                </div>
                <div className="flog-ctas">
                  <button type="button" className="cta-primary" onClick={() => navigate('/fuel/plan')}>
                    ＋ tervezz
                  </button>
                </div>
              </div>
            </div>
          )}

          {lane.tiles.map((tile, i) => (
            <div key={tile.key} className="rise" style={{ '--d': `${40 + i * 45}ms` } as React.CSSProperties}>
              <WindowBlock
                tile={tile}
                open={openKey === tile.key}
                onOpen={(ai) => openComposer(tile.key, ai)}
                onScore={openScoreForMeal}
              >
                {openKey === tile.key && (
                  <MealComposer
                    fixedSlot={tile.slotKey}
                    prefill={prefillFor(tile, aiOnMount)}
                    aiPanelOpenOnMount={aiOnMount}
                    onSaved={closeComposer}
                    onCancel={closeComposer}
                  />
                )}
              </WindowBlock>
            </div>
          ))}

          {/* Trailing out-of-window block — the standing log path (mezo-66te): the window CTAs
              all vanish once every window is done, so the list must always end with a door. */}
          <div className={`flog-blk is-free rise${openKey === 'free' ? ' is-open' : ''}`}
            style={{ '--d': `${40 + lane.tiles.length * 45}ms` } as React.CSSProperties}>
            <div className="flog-in">
              <div className="flog-top"><span className="flog-lbl">Ablakon kívül</span></div>
              <div className="flog-main">
                <div className="flog-icon"><ClayIcon name="i-fuel" size={34} /></div>
                <div className="flog-txt">
                  <div className="flog-name">Bármikor-logolás</div>
                  <div className="flog-meta">snack, kávé, ami épp jött</div>
                </div>
              </div>
              <div className="flog-ctas">
                <button type="button" className="cta-primary" onClick={() => openComposer('free', false)}
                  aria-label="Logolás · ablakon kívül" aria-expanded={openKey === 'free'}>
                  ＋ Logolás
                </button>
                <button type="button" className="cta-ghost" onClick={() => openComposer('free', true)}
                  aria-label="AI naplózás · ablakon kívül" aria-expanded={openKey === 'free'}>
                  ✨ AI
                </button>
              </div>
              <div className="flog-composer">
                <div className="flog-cin">
                  {openKey === 'free' && (
                    <div className="flog-cbody">
                      <MealComposer
                        aiPanelOpenOnMount={aiOnMount}
                        onSaved={closeComposer}
                        onCancel={closeComposer}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </EntranceGroup>
      </PageBody>

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
    </MozaikPage>
  )
}
