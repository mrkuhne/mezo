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
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FuelMeal } from '@/data/types'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, asPastDayLane, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { huInt } from '@/shared/lib/huNum'
import { addDays, huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { WindowBlock } from '@/features/fuel/components/WindowBlock'
import { MealComposer } from '@/features/fuel/components/MealComposer'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'

// How far back the stepper lets you go — a week of catch-up, not an open-ended ledger
// (mezo-1j3z). The ?d= deep link clamps to the same window (anything outside it, or
// unparsable, falls back to today rather than silently misdating a log).
const MAX_BACK = 7

export function FuelLogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = localDateString()

  const initialOffset = (() => {
    const d = searchParams.get('d')
    if (!d) return 0
    const diff = Math.round((+new Date(today) - +new Date(d)) / 86_400_000)
    return Number.isFinite(diff) && diff >= 1 && diff <= MAX_BACK ? diff : 0
  })()
  const [offset, setOffset] = useState(initialOffset)
  const date = addDays(today, -offset)
  const past = offset > 0

  const { fuel } = useFuelDay(date)
  const { plan, budget } = useFuelTimeline(date)

  const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const lane = past ? asPastDayLane(laneRaw) : laneRaw
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

  // Switching days closes any open composer and resets the AI-on-mount flag — the well
  // belongs to the day it was opened on, never carries across a step (mezo-1j3z).
  const stepDay = (d: number) => {
    setOpenKey(null)
    setAiOnMount(false)
    setOffset(o => Math.min(MAX_BACK, Math.max(0, o + d)))
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

  // Past-day save label: the composer's CTA reads "✓ Pótlás · aug 30." instead of the
  // usual "Logolás · +10 XP" — the day it books to is right there on the button (mezo-1j3z).
  const saveLabel = past ? `✓ Pótlás · ${huMonthDay(date).toLowerCase()}.` : undefined
  const allDone = lane.tiles.length > 0 && lane.tiles.every(t => t.state === 'done')

  return (
    <MozaikPage tone={past ? 'gold' : 'coral'} className="flog-page">
      <PageHead onBack={() => navigate('/fuel')} label="‹ Fuel" />
      <div className="mz-page-hero">
        <div className="flog-daysw">
          <button type="button" onClick={() => stepDay(1)} disabled={offset >= MAX_BACK} aria-label="Előző nap">‹</button>
          <span className="flog-dlbl">
            <b>{huMonthDay(date).toLowerCase()}.</b>
            <small>{huWeekdayFullIso(date).toLowerCase()}{past ? '' : ' · ma'}</small>
          </span>
          <button type="button" onClick={() => stepDay(-1)} disabled={offset === 0} aria-label="Következő nap">›</button>
        </div>
        <div className="mz-eyebrow" style={{ color: past ? 'var(--mz-cell-amber-ink)' : 'var(--coral)' }}>
          {past ? 'Pótlás' : 'Logolás'}
        </div>
        <div className="mz-hero-row">
          <span className="mz-bignum">{huInt(fuel.consumed.kcal)}</span>
          <span className="flog-goal">/ {huInt(fuel.targets.kcal)} kcal</span>
        </div>
        <div className="mz-hero-sb">
          {lane.tiles.length > 0 ? `${doneCount}/${lane.tiles.length} ablak kész` : 'nincs mai étkezési ablak'}
        </div>
        {past && (
          <div className="flog-pastnote">
            <i aria-hidden="true" />
            Amit itt logolsz, erre a napra könyvelődik — pontszámot is kap.
          </div>
        )}
      </div>
      <PageBody principle="Egy felület, egy mozdulat: görgetsz a napodon, és ott logolsz, ahol az ablak van — a blokk kinyílik, elmenti, becsukódik.">
        <EntranceGroup>
          {/* A closed-out past day: every window is done — the free block below still stands
              for anything left out (mezo-1j3z). */}
          {allDone && past && (
            <div className="flog-dayclosed rise" style={{ '--d': '30ms' } as React.CSSProperties}>
              <b>Minden ablak kész ✓</b>
              <span>Ez a nap le van zárva — alul még pótolhatsz, ha valami kimaradt.</span>
            </div>
          )}

          {/* No eating window scheduled at all → the list leads with the üres-nap door (today)
              or an honest "nothing was scheduled" note (a past day never dangles a plan CTA). */}
          {lane.tiles.length === 0 && (
            <div className="flog-blk is-free rise" style={{ '--d': '30ms' } as React.CSSProperties}>
              <div className="flog-in">
                <div className="flog-top"><span className="flog-lbl">Üres nap</span></div>
                <div className="flog-main">
                  <div className="flog-icon"><ClayIcon name="i-fuel" size={34} /></div>
                  <div className="flog-txt">
                    <div className="flog-name is-ghost">Nincs mai terv</div>
                    <div className="flog-meta">
                      {past ? 'ezen a napon nem volt étkezési ablak' : 'tervezz ablakokat, és ide kerülnek'}
                    </div>
                  </div>
                </div>
                {!past && (
                  <div className="flog-ctas">
                    <button type="button" className="cta-primary" onClick={() => navigate('/fuel/plan')}>
                      ＋ tervezz
                    </button>
                  </div>
                )}
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
                    logDate={past ? date : undefined}
                    logTime={past ? tile.time : undefined}
                    saveLabel={saveLabel}
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
                  <div className="flog-meta">{past ? 'ami még kimaradt erről a napról' : 'snack, kávé, ami épp jött'}</div>
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
                        logDate={past ? date : undefined}
                        saveLabel={saveLabel}
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
