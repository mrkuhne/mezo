// ============================================================
// Mezo · DimensionCard (one weighted score dimension) — collapsible since Logolás 2.1
// (mezo-zeeq), a Mozaik 2.0 wash tile since mezo-jcpt.1.
//
// Anatomy (approved prototype, 3. képernyő „A javított meal-oldal" → `.predtile`):
// clay icon lapka + label + „súly W% → X pont" eyebrow + a conic sub-score ring
// (`.sring`), and — once expanded — the detail prose, the coach's note and the
// dimension's OWN graphic (macro/micro gbars, the NOVA szalag, fact chips).
// The wash and its colored shadow are a token pair bound by the tone class
// (see logic/dimensionFace.ts). Collapsed by default: the sheet reads as a ledger
// first and a report second. Used by ScoreBreakdownBody (meal + recipe).
// ============================================================
import { useId, useState } from 'react'
import type { MealDimension } from '@/data/types'
import { cn } from '@/shared/lib/cn'
import { hu1 } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { dimensionFace } from '@/features/fuel/logic/dimensionFace'
import { dimContributionPts, dimWeightPct } from '@/features/fuel/logic/scoreArithmetic'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'
import { MealTimingStrip } from '@/features/fuel/components/MealTimingStrip'

export function DimensionCard({ dim, defaultOpen = false, delayMs }: {
  dim: MealDimension
  defaultOpen?: boolean
  /** entrance-stagger delay of the mosaic (the `rise` choreography); undefined → no stagger. */
  delayMs?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const sub = Math.round(dim.score * 100)
  const contribution = hu1(dimContributionPts(dim))
  const face = dimensionFace(dim)
  const ghost = face.tone === 'ghost'

  // A GHOST csempe nem kártya, hanem egy sor (mezo-mxmh S4). Egy degradált dimenziónak nincs
  // panelje — a DimensionCard alább egyet sem renderel neki —, tehát a gomb egy üres testet
  // nyitogatna, a gyűrű egy nem létező pontszámot mutatna, a „súly 0% → 0 pont" pedig nullát
  // szoroz nullával. Ráadásul a „nem számít bele" kétszer szerepelt: a súly-soron és a
  // mondatban. Amíg a kamra-adat hiányos, ezekből EGYSZERRE több is lesz a sheeten, tehát
  // pont ezeknek kell a legkevesebb helyet és a legkevesebb szót elvinniük — jelen vannak,
  // megnevezve, de nem játsszák el, hogy pontoznak.
  if (ghost) {
    return (
      <div
        className={cn('sb-dim', 'sb-t-ghost', 'sb-dim-ghostrow', delayMs !== undefined && 'rise')}
        style={{ ...(delayMs !== undefined && { '--d': `${delayMs}ms` }) } as React.CSSProperties}
      >
        <span className="sb-dim-pic"><ClayIcon name={face.icon} size={18} /></span>
        <span className="sb-dim-lb">{dim.label}</span>
        <span className="sb-dim-ghostwhy"><SafeMarkdown text={dim.detail} /></span>
      </div>
    )
  }

  return (
    <div
      className={cn('sb-dim', `sb-t-${face.tone}`, delayMs !== undefined && 'rise')}
      style={{ '--c': dim.color, '--v': sub, ...(delayMs !== undefined && { '--d': `${delayMs}ms` }) } as React.CSSProperties}
    >
      <button type="button" className="sb-dim-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="sb-dim-pic"><ClayIcon name={face.icon} size={24} /></span>
        <span className="sb-dim-txt">
          <span className="sb-dim-lb">{dim.label}</span>
          <span className="sb-dim-w">
            súly <b>{dimWeightPct(dim)}%</b> → <b>{contribution}</b> pont
            {/* Partial coverage is a fact about the SCORE, so it rides the weight line where the
                other arithmetic lives — not the end of `detail`, which the two-line clamp below
                would cut off exactly when there is most to say (mezo-mxmh). Full coverage stays
                silent: a "100% adat" badge on every tile is noise, and its absence is the signal. */}
            {dim.coverage != null && dim.coverage < 0.995 && (
              <b className="sb-dim-cov" title="Ennyi étel-energiára volt adat ehhez a dimenzióhoz">
                {Math.round(dim.coverage * 100)}% adat
              </b>
            )}
          </span>
        </span>
        <span className="sb-sring"><i>{sub}</i></span>
        <span className="sb-dim-arr" aria-hidden="true">›</span>
        {/* A mondat SAJÁT SORT kap a fejléc alatt, teljes kártyaszélességben (mezo-mxmh S4).
            Amíg a `sb-dim-txt` oszlopában ült, 192px jutott neki az ikon, a gyűrű és a nyíl
            között — ott a kétsoros clamp ~60 karakternél vág, tehát MINDEN determinisztikus
            mondat csonkolódott, a lerövidítettek is. Nem a szöveg volt hosszú, hanem az oszlop
            keskeny; a rövidítés csak a tünetet kergette. */}
        {!open && <span className="sb-dim-one"><SafeMarkdown text={dim.detail} /></span>}
      </button>
      {open && (
        <div id={id} className="sb-dim-body">
          <p><SafeMarkdown text={dim.detail} /></p>
          {dim.note && (
            <p className="dim-note" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6 }}>
              <Icon name="sparkle" size={10} color="var(--lav-deep)" /> <SafeMarkdown text={dim.note} />
            </p>
          )}
          {/* A degraded dim never reaches here (it returns the compact ghost row above), but the
              panel choice stays guarded by the payload field itself (`in`), not just `id`: a
              cached older envelope can carry a known id with none of its payload. */}
          {dim.id === 'macro' && 'macroRatio' in dim && <MacroPanel dim={dim} />}
          {dim.id === 'micro' && 'micros' in dim && <MicroPanel dim={dim} />}
          {dim.id === 'nova' && 'nova' in dim && <NovaPanel dim={dim} />}
          {/* Az időzítés-sáv KIZÁRÓLAG a logolt étkezés `context` dimenzióján jelenik meg — nem a
              generikus ContextPanelben, amit hat dimenzió oszt. A VALÓS backend recept-sablon
              breakdownjában nincs `context` dimenzió (RecipeBreakdownService sosem csatolja).
              Mock módban viszont egy linkelt recept (rec-1/rec-2) a saját meal-je breakdownját
              tükrözi vissza — `context`-tel, `timing`-gal együtt —, ezért ott a mock-adatréteg
              (`stripMealOnlyTiming`, `frontend/src/data/fuel/pantry.ts`) vágja ki a `timing`
              mezőt a tükrözött dimenzióból, mielőtt ez a gate egyáltalán látná. */}
          {dim.id === 'context' && 'timing' in dim && dim.timing != null
            && <MealTimingStrip timing={dim.timing} />}
          {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
            || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
            && 'context' in dim && <ContextPanel dim={dim} />}
        </div>
      )}
    </div>
  )
}
