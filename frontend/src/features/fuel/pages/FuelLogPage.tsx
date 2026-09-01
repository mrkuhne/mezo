// ============================================================
// Mezo · FuelLogPage — /fuel/log, the stacked-window logging page (mezo-byo1)
// Source of truth: docs/design_2.0/prototypes/fuel-logolas.html #page-log +
// docs/superpowers/specs/2026-08-31-fuel-logolas-2.0-design.md §2.
//
// The hub's Logolás hero tile opens this page (the Huawei „tile → own page"
// idiom); every user-scheduled eating window renders as ONE full-width
// WindowBlock, stacked vertically — done / now / missed / future. The
// Logold/Pótold/✨ AI CTAs NAVIGATE to /fuel/log/uj (mezo-bq2t) — the whole
// context (day, window, AI intent) travels in the URL. The day stepper mirrors
// its result into this page's own `?d=` too (replace, so stepping does not pile
// up history), which is what makes the browser/PWA back gesture land on the day
// the user actually left — a `/fuel/log` history entry with no query would
// silently drop them back on today. Scroll position is NOT preserved: the route
// remounts on return and there is no scroll restoration in the app.
// The trailing „Ablakon kívül" block is the standing slot-less log door — it
// navigates with NO `w`, never fabricating a window; an empty day leads with the
// tervezz block instead of fabricating windows.
//
// Same composed day as the hub (useFuelDay/useFuelTimeline → buildWindowLane) —
// a save re-derives everything live: the page hero counter, the block states
// and the hub tile all follow the one day model.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FuelMeal } from '@/data/types'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, asPastDayLane } from '@/features/fuel/logic/fuelSwimlane'
import { huInt } from '@/shared/lib/huNum'
import { addDays, huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { WindowBlock } from '@/features/fuel/components/WindowBlock'
import { MealScoreSheet } from '@/features/fuel/sheets/MealScoreSheet'

// How far back the stepper lets you go — a week of catch-up, not an open-ended ledger
// (mezo-1j3z). The ?d= deep link clamps to the same window (anything outside it, or
// unparsable, falls back to today rather than silently misdating a log).
const MAX_BACK = 7

export function FuelLogPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Anchored once (mezo-1j3z, finding 4): re-computing this per render would let a re-render
  // after midnight shift `date` (and with it the `?d=` the CTAs hand the logging page). The page remounts
  // per navigation, so the staleness window is bounded to a single visit.
  const [today] = useState(() => localDateString())

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

  const [scoreMeal, setScoreMeal] = useState<FuelMeal | null>(null)

  // A logolás saját oldalra megy (mezo-bq2t): a kontextus — nap, ablak, AI-szándék — az URL-ben
  // utazik, így a lista állapota érintetlen marad és a vissza-gomb visszatesz ide.
  const openLog = (windowKey: string | null, ai: boolean) => {
    const q = new URLSearchParams()
    if (past) q.set('d', date)
    if (windowKey) q.set('w', windowKey)
    if (ai) q.set('ai', '1')
    const s = q.toString()
    navigate(`/fuel/log/uj${s ? `?${s}` : ''}`)
  }

  const stepDay = (d: number) => {
    const next = Math.min(MAX_BACK, Math.max(0, offset + d))
    setOffset(next)
    // The stepped day goes into the URL as well (mezo-bq2t): the logging page hands `?d=` back on
    // its own return, but the browser/PWA back gesture just pops a history entry — one without a
    // `d` would silently re-open on TODAY. `replace` so stepping never piles up history entries,
    // and today stays param-free, exactly like `openLog`.
    setSearchParams(
      prev => {
        const q = new URLSearchParams(prev)
        if (next > 0) q.set('d', addDays(today, -next))
        else q.delete('d')
        return q
      },
      { replace: true },
    )
    // The day switch re-renders the whole block list in place — without this the scroller
    // stays wherever it was on the PREVIOUS day, stranding the new day's top blocks off-screen.
    const body = document.querySelector('.mz-page-body')
    if (body) body.scrollTop = 0
  }

  const openScoreForMeal = (mealId: string) => {
    const meal = fuel.meals.find(m => m.id === mealId)
    if (meal) setScoreMeal(meal)
  }

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
          {lane.tiles.length > 0
            ? `${doneCount}/${lane.tiles.length} ablak kész`
            : past ? 'ezen a napon nem volt étkezési ablak' : 'nincs mai étkezési ablak'}
        </div>
        {past && (
          <div className="flog-pastnote">
            <i aria-hidden="true" />
            Amit itt logolsz, erre a napra könyvelődik — pontszámot is kap.
          </div>
        )}
      </div>
      <PageBody principle="Egy felület, egy mozdulat: görgetsz a napodon, és ott indítod a logolást, ahol az ablak van — a blokk átvisz a logoló oldalra, és vissza.">
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
                onOpen={(ai) => openLog(tile.key, ai)}
                onScore={openScoreForMeal}
              />
            </div>
          ))}

          {/* Trailing out-of-window block — the standing log path (mezo-66te): the window CTAs
              all vanish once every window is done, so the list must always end with a door. */}
          <div className="flog-blk is-free rise"
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
              {/* Ablak-kulcs NÉLKÜL navigál: a szabad tétel nem tartozik egyetlen ablakhoz sem,
                  és az oldal sem fabrikál egyet hozzá. */}
              <div className="flog-ctas">
                <button type="button" className="cta-primary" onClick={() => openLog(null, false)}
                  aria-label="Logolás · ablakon kívül">
                  ＋ Logolás
                </button>
                <button type="button" className="cta-ghost" onClick={() => openLog(null, true)}
                  aria-label="AI naplózás · ablakon kívül">
                  ✨ AI
                </button>
              </div>
            </div>
          </div>
        </EntranceGroup>
      </PageBody>

      {scoreMeal && <MealScoreSheet meal={scoreMeal} onClose={() => setScoreMeal(null)} />}
    </MozaikPage>
  )
}
