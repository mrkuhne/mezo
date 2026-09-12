// ============================================================
// Mezo · FuelScoreSurface (Fuel Titanium, mezo-jb84)
//
// EZ NEM EGY ÚJ PONTOZÓ FELÜLET. Ugyanazt a `MealBreakdown` envelope-ot rendereli, amit a
// `MealScoreSheet` és a `RecipeScoreSheet` is — csak a Titán bőrében: középre zárt hero,
// dimenzió-mozaik, és dimenziónként egy üvegdoboz. A SZÁMOK sehol nem mozdulnak.
//
// Azért közös, mert az owner döntése szerint egy recept megnyitása ugyanolyan mély, mint egy
// logolt ételé — és élesben kiderült, hogy a recept-pontszám még a RÉGI sheetet nyitotta,
// miközben az étkezésé már a Titán felületet. Két bőr ugyanarra az adatra: pont az a drift,
// amit ez a fájl megszüntet.
//
// Őszinte-null + szégyenmentesség: egy adat nélküli (súly 0) dimenzió „még tanulom", nem nulla
// pont; a hero száma mellől a „/10" elmarad (owner); és egy alacsony pontszám sosem kudarc.
// ============================================================
import { useId, useState, type ReactNode } from 'react'
import { hu1 } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon } from '@/shared/ui/clay'
import type { MealBreakdown, MealDimension } from '@/data/types'
import { dimensionFace } from '@/features/fuel/logic/dimensionFace'
import { dimWeightPct } from '@/features/fuel/logic/scoreArithmetic'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'
import { MealTimingStrip } from '@/features/fuel/components/MealTimingStrip'
import { GlassBox } from '@/features/fuel/components/GlassBox'

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

/** Egy dimenzió üvegdoboza. Natív <GlassBox onClose={onClose}>, a ház `glass` anyagában — a feature-detektált
 *  `showModal()` a FuelEnergyHero mintája (jsdom-ban nincs dialog-implementáció). */
function DimGlass({ dim, onClose }: { dim: MealDimension; onClose: () => void }) {
  const titleId = useId()
  const face = dimensionFace(dim)
  const degraded = dim.weight === 0


  return (
    <GlassBox onClose={onClose} className="fmx-dim-glass"
      labelledBy={titleId}
      style={{ '--dim-color': dim.color } as React.CSSProperties}>
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
    </GlassBox>
  )
}

export interface FuelScoreSurfaceProps {
  breakdown: MealBreakdown
  /** 0–100. A hívó adja, mert az étkezésnél a mentett `score`, a receptnél a `fit` a forrás. */
  scorePct: number
  tagline: string | null
  /** A coach prózája — null, amíg készül vagy ha a coach ki van kapcsolva. */
  summary: string | null
  coachPending?: boolean
  improve: MealBreakdown['improve']
  /** A próza alatti visszajelzés-csík; a hívó dönti el, van-e mire szavazni. */
  feedback?: ReactNode
  /** A lap alján álló, felületfüggő lábjegyzet. */
  note: ReactNode
}

export function FuelScoreSurface({
  breakdown, scorePct, tagline, summary, coachPending, improve, feedback, note,
}: FuelScoreSurfaceProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const openDim = openIdx == null ? null : breakdown.dimensions[openIdx] ?? null

  return (
    <>
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
          <i style={{ '--w': `${Math.round(breakdown.confidence * 100)}%` } as React.CSSProperties} aria-hidden="true" />
          Bizonyosság {Math.round(breakdown.confidence * 100)}%
        </span>
      </div>

      <div className="fmx-section fmx-section-row">
        <h2>Miből áll össze?</h2>
        <small>KOPPINTS A RÉSZLETEKÉRT</small>
      </div>
      <div className="fmx-dims">
        {breakdown.dimensions.map((d, i) => (
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

      {feedback}
      <p className="fmx-nutri-note">{note}</p>

      {openDim && <DimGlass dim={openDim} onClose={() => setOpenIdx(null)} />}
    </>
  )
}
