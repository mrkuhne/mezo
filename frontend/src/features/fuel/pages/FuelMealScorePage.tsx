// ============================================================
// Mezo · FuelMealScorePage — az étkezés AI értékelése SAJÁT oldalon
// (Fuel Titanium S1b, mezo-33k6; fagyasztott manifeszt A11).
//
// EZ NEM EGY ÚJ PONTOZÓ FELÜLET. Ugyanazt a `meal.breakdown` envelope-ot rendereli, amit a
// MealScoreSheet — csak a bőr és a navigáció más (sheet → oldal + per-dimenzió üvegdoboz).
// Ezért:
//   • a súly/pont/Σ aritmetika a KÖZÖS `logic/scoreArithmetic.ts`-ből jön (a volt
//     `totalOf`/`weight*100` JSX-ből kiemelve), nem egy másolt szorzásból,
//   • a dimenzió arca (hue-tónus + clay ikon) a KÖZÖS `logic/dimensionFace.ts`-ből,
//   • a dimenzió saját grafikonjai a MEGLÉVŐ panelek (MacroPanel / MicroPanel / NovaPanel /
//     ContextPanel / MealTimingStrip) — az üvegdoboz a TARTÓJUK, nem egy második rajzuk,
//   • a coach-interplay a sheetből szó szerint átvéve: a `summary` a verdictből, különben az
//     envelope-ból; a `useFeedback` FELTÉTEL NÉLKÜL mountol (a hook-sorrend nem függhet az
//     adattól), a chipek csak akkor jelennek meg, ha van miről szavazni.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/
// fuel-dashboard.js `scorePage` (:202), `dimTile` (:183), `dimGlassHtml` (:188);
// CSS: fuel-pages.css `AI score page — centered hero, colorful dimension mosaic` (:344)
// és `Glass box: one dimension` (:370).
//
// Őszinte-null + szégyenmentesség: egy adat nélküli (súly 0) dimenzió „még tanulom", nem
// nulla pont; a hero száma mellől a „/10" elmarad (owner); és egy alacsony pontszám sosem
// kudarc-hangon szólal meg.
// ============================================================
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFeedback, useFuelDay, useMealCoachFor } from '@/data/hooks'
import { hu1, huInt } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon } from '@/shared/ui/clay'
import type { MealDimension } from '@/data/types'
import { dimensionFace } from '@/features/fuel/logic/dimensionFace'
import { breakdownTotalPct, dimWeightPct } from '@/features/fuel/logic/scoreArithmetic'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { hhmmFromLoggedAt } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'
import { MealTimingStrip } from '@/features/fuel/components/MealTimingStrip'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'

/** Egy dimenzió tizedes pontszáma a 0–10-es skálán („8,6"); degradáltnál nincs szám. */
const dimValue = (d: MealDimension) => hu1(d.score * 10)

function DimTile({ dim, onOpen }: { dim: MealDimension; onOpen: () => void }) {
  const face = dimensionFace(dim)
  const degraded = dim.weight === 0
  return (
    <button type="button" className={`fmx-dim${degraded ? ' is-degraded' : ''}`} onClick={onOpen}
      style={{ '--dim-color': dim.color } as React.CSSProperties}
      aria-label={`${dim.label}: ${degraded ? 'kimaradt, kevés adat' : dimValue(dim)} — részletek`}>
      <span className="fmx-dim-top">
        <span className="fmx-dim-art" aria-hidden="true"><ClayIcon name={face.icon} size={34} /></span>
        <strong>{degraded ? '—' : dimValue(dim)}</strong>
      </span>
      <span className="fmx-dim-label">{dim.label}</span>
      <i className="fmx-dim-bar" aria-hidden="true">
        <b style={{ '--v': `${degraded ? 0 : dim.score * 100}%` } as React.CSSProperties} />
      </i>
      {/* „tanulom", nem nulla: a súly 0 azt jelenti, nem volt mire pontot adni. */}
      <small>{degraded ? 'még tanulom · kevés adat' : `súly ${dimWeightPct(dim)}%`}</small>
    </button>
  )
}

/** Egy dimenzió üvegdoboza. Natív <dialog>, a ház `glass` anyagában — a feature-detektált
 *  `showModal()` a FuelEnergyHero mintája (jsdom-ban nincs dialog-implementáció). */
function DimGlass({ dim, onClose }: { dim: MealDimension; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const face = dimensionFace(dim)
  const degraded = dim.weight === 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof el.showModal === 'function') el.showModal()
    else el.setAttribute('open', '')
  }, [])

  return (
    <dialog ref={ref} className="fmx-glass glass fmx-dim-glass"
      aria-labelledby={titleId}
      style={{ '--dim-color': dim.color } as React.CSSProperties}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClose={onClose}>
      <div className="fmx-glass-hero is-dim">
        <ClayIcon name={face.icon} size={58} />
        <div>
          <strong>{degraded ? '—' : dimValue(dim)}</strong>
          <small id={titleId}>{dim.label}</small>
        </div>
      </div>
      <div className="fmx-glass-chips">
        <span>súly {dimWeightPct(dim)}%</span>
        {dim.coverage != null && <span>lefedettség {Math.round(dim.coverage * 100)}%</span>}
      </div>
      <div className="fmx-glass-bar is-dim" role="img"
        aria-label={`${dim.label}: ${degraded ? 'nincs pontszám' : `${dimValue(dim)} a tízes skálán`}`}>
        <i style={{ '--w': `${degraded ? 0 : dim.score * 100}%` } as React.CSSProperties} />
      </div>
      <p className="fmx-glass-lead"><SafeMarkdown text={dim.detail} /></p>
      {degraded && (
        <div className="fmx-glass-callout">
          <ClayIcon name="i-eletjel" size={26} />
          <p>
            <small>ŐSZINTÉN</small>
            Ehhez az étkezéshez nem volt elég adat, ezért ez a szempont kimaradt, és a többi
            súlya vette át a helyét. Nem találgatunk.
          </p>
        </div>
      )}
      {/* A dimenzió SAJÁT grafikonja a meglévő panelekből — ugyanaz a rajz, mint a sheeten,
          hogy a két felület ne tudjon elcsúszni egymástól. A payload-mező a kapu (nem az id):
          egy cache-elt régi envelope ismert id-t hozhat a payloadja nélkül. */}
      {!degraded && (
        <div className="fmx-glass-panel">
          {dim.id === 'macro' && 'macroRatio' in dim && <MacroPanel dim={dim} />}
          {dim.id === 'micro' && 'micros' in dim && <MicroPanel dim={dim} />}
          {dim.id === 'nova' && 'nova' in dim && <NovaPanel dim={dim} />}
          {dim.id === 'context' && 'timing' in dim && dim.timing != null && <MealTimingStrip timing={dim.timing} />}
          {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
            || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
            && 'context' in dim && <ContextPanel dim={dim} />}
        </div>
      )}
      {dim.note && (
        <div className="fmx-glass-callout">
          <ClayIcon name="i-kristaly" size={26} />
          <p><small>MEZO JEGYZETE</small><SafeMarkdown text={dim.note} /></p>
        </div>
      )}
      <button type="button" className="fmx-glass-close" onClick={onClose}>Bezárom</button>
    </dialog>
  )
}

export function FuelMealScorePage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const day = search.get('d')
  const { fuel } = useFuelDay(day ?? undefined)
  const meal = fuel.meals.find(m => m.id === id) ?? null
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // A coach verdict on demand (mezo-mr4n) — a determinisztikus test alatta azonnal renderel.
  const { verdict, isPending: coachPending } = useMealCoachFor(meal?.id ?? null)
  const b = meal?.breakdown
  const summary = verdict?.summary ?? b?.summary ?? null
  // EGY useFeedback, FELTÉTEL NÉLKÜL mountolva (mezo-76f6): a hook-sorrend nem függhet attól,
  // van-e breakdown vagy próza — a chipek maguk renderelnek csak akkor, ha van miről szavazni.
  const feedback = useFeedback('meal_coach', summary && meal ? [meal.id] : [])

  const back = () => navigate(meal ? `/fuel/etkezes/${meal.id}${day ? `?d=${day}` : ''}` : '/fuel')

  if (!meal) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel')} aria-label="Vissza a Mai oldalra">‹</button>
          <span><strong>Ez az étkezés nincs meg</strong></span>
        </div>
        <p className="fmx-block-empty">Lehet, hogy egy másik napon logoltad, vagy közben törölted.</p>
      </div>
    )
  }
  // Ugyanaz a szabály, mint a sheetnél: breakdown nélkül nincs mit megmutatni — és nem
  // gyártunk hozzá pontszámot.
  if (!b) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={back} aria-label="Vissza az étkezéshez">‹</button>
          <span><small>AI ÉRTÉKELÉS</small><strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong></span>
        </div>
        <p className="fmx-block-empty">
          Ehhez az étkezéshez még nincs értékelés. Amint az értékelés megszületik, itt találod.
        </p>
      </div>
    )
  }

  const scorePct = meal.score != null ? Math.round(meal.score * 100) : breakdownTotalPct(b)
  const tagline = verdict?.tagline ?? b.tagline
  const improve = verdict?.improve?.length ? verdict.improve : b.improve
  const openDim = openIdx == null ? null : b.dimensions[openIdx] ?? null

  return (
    <div className="fmx-page">
      <div className="fmx-subhead">
        <button type="button" onClick={back} aria-label="Vissza az étkezéshez">‹</button>
        <span>
          <small>AI ÉRTÉKELÉS</small>
          <strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong>
        </span>
        <b className="fmx-subhead-end">{hhmmFromLoggedAt(meal.loggedAt, '—')} · {huInt(meal.kcal)} kcal</b>
      </div>

      {/* Középre zárt hero: a szám mellől a „/10" elmarad (owner). */}
      <div className="fmx-score-hero">
        <span className="fmx-score-glow" aria-hidden="true" />
        <span className="fmx-score-art" aria-hidden="true"><ClayIcon name="i-kristaly" size={92} /></span>
        <strong className="fmx-score-value" aria-label={`AI értékelés: ${hu1(scorePct / 10)} a tízes skálán`}>
          <span aria-hidden="true">{hu1(scorePct / 10)}</span>
        </strong>
        {tagline && <em>{tagline}</em>}
        {summary && <p><SafeMarkdown text={summary} /></p>}
        {!summary && coachPending && <p className="fmx-score-pending">Mezo olvasata készül…</p>}
        <span className="fmx-score-conf">
          <i style={{ '--w': `${Math.round(b.confidence * 100)}%` } as React.CSSProperties} aria-hidden="true" />
          Bizonyosság {Math.round(b.confidence * 100)}%
        </span>
      </div>

      <div className="fmx-section fmx-section-row">
        <h2>Miből áll össze?</h2>
        <small>KOPPINTS A RÉSZLETEKÉRT</small>
      </div>
      <div className="fmx-dims">
        {b.dimensions.map((d, i) => (
          <DimTile key={`${d.id}-${i}`} dim={d} onOpen={() => setOpenIdx(i)} />
        ))}
      </div>

      {improve.length > 0 && (
        <>
          <div className="fmx-section"><h2>Ha feljebb vinnéd</h2></div>
          {improve.map((it, i) => (
            <div key={i} className="fmx-improve">
              <ClayIcon name="i-lang" size={26} />
              <p><SafeMarkdown text={it.text} /></p>
              <b>{formatImpact(it.impact)}</b>
            </div>
          ))}
        </>
      )}

      {/* Csendes 👍/👎 a coach SAJÁT prózájára (mezo-76f6) — a számokra nem szavazunk. */}
      {summary && (
        <div className="fmx-score-fb">
          <FeedbackChips
            key={meal.id}
            value={feedback.get(meal.id)}
            onVote={(v, reason) => feedback.vote(meal.id, v, reason)}
            label="a Mezo olvasatáról"
          />
        </div>
      )}

      <p className="fmx-nutri-note">
        A pontszám mentéskor, determinisztikusan születik; a szöveges részt a coach írja hozzá,
        és sosem írja át a számokat. Egyetlen étkezés sosem ítélet — a nap egészében nézzük.
      </p>

      {openDim && <DimGlass dim={openDim} onClose={() => setOpenIdx(null)} />}
    </div>
  )
}
