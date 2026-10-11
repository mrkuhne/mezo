// ============================================================
// Mezo · SportCeremony — the sport-session close ceremony (mezo-88iwa.9, T8 Task 5)
//
// The gym ceremony's one-screen sibling, in the same Folyadék material (mezo-n4wf5.4,
// prototype vilagos/edzes.js `sportcer()` — routes `sportcer`, `.sajat-kcal`, `.kcal-nincs`,
// `.xp-nincs`, `.allo`): the title row (the route is chrome-free, so the screen draws it) →
// the stage, five stars over a cup that fills to `score.ratio` → with beat 2 „A mai számok"
// (perc · megélt terhelés · kcal when known, then the XP row) and „A mai mozgással" (the gold
// kcal row) → the floating way out with „<sport> · elmentve" under it.
//
// The pass is the kit's ONE rAF pass (`useCeremonyPass`): stars, level, counters and beats are
// written per frame, never CSS-transitioned; reduced motion paints the end state on the first
// render. It plays exactly once per mount.
//
// XP lives HERE (owner decision, F4): the sport path no longer raises the full-screen level-up
// overlay over its own closing screen — the row „+N szerzett XP · a mai mozgásért" carries it,
// and is absent when the save earned none.
//
// Every number is a prop: this component computes nothing. The kcal values are the WIRE's
// (never re-derived — see SportLogPage's honesty note); kcal unknown → no counter and no tile
// (never a fabricated 0); „Becslés, nem mérés" / „Saját értéked" follows `kcal.isEstimate`.
// ============================================================
import { useEffect, useRef, type ReactNode } from 'react'
import { verdictFor } from '@/features/train/logic/cerScore'
import type { SportScore } from '@/features/train/logic/sportScore'
import { CeremonyTop } from '@/features/train/components/WorkoutCeremony'
import {
  Btn, Bub, Card, CeremonyCount, CeremonyReveal, CeremonyRoot, CupStage, Facts, FootCol, Note, Page, Row, Section,
  useCeremonyPass,
} from '@/shared/ui/folyadek'

export interface SportCeremonyProps {
  score: SportScore
  /** The sport's own name (or the typed activity of „Egyéb mozgás"): the title row's context, the stage's overline
   *  („<sport> · ma · N csillag az ötből") and the line under the way out. */
  sportName: string
  minutes: number
  rpe: number
  /** The WIRE value only (never re-derived here — see SportLogPage's honesty note).
   *  Null hides the counter and the tile entirely, never a fabricated 0 kcal. */
  kcal: { value: number; isEstimate: boolean } | null
  /** The save response's real XP; null hides the row. */
  xpGained: number | null
  /** The way out: straight to Mai. */
  onClose(): void
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

/** hu-HU grouping, with the locale's (narrow) no-break spaces normalised to a plain space. */
function huNumber(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** '4,5' — the Hungarian decimal comma, without depending on the runtime's ICU data. */
function huStars(stars: number): string {
  return String(stars).replace('.', ',')
}

export function SportCeremony({ score, sportName, minutes, rpe, kcal, xpGained, onClose, reducedMotion }: SportCeremonyProps) {
  const pass = useCeremonyPass({ ratio: score.ratio, reducedMotion })
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The title is where the screen starts, for a screen reader and for the keyboard.
  useEffect(() => { headingRef.current?.focus() }, [])

  const counters: [ReactNode, ReactNode][] = [
    [<CeremonyCount key="m" pass={pass} value={minutes} />, 'perc'],
    [<CeremonyCount key="r" pass={pass} value={rpe} />, 'megélt terhelés · 10-ből'],
  ]
  if (kcal) counters.push([<CeremonyCount key="k" pass={pass} value={kcal.value} />, 'kcal'])

  return (
    <Page
      nonav className="ec-page ec-sport"
      foot={<FootCol sub={`${sportName} · elmentve`}><Btn onClick={onClose}>Vissza a mai napra</Btn></FootCol>}
    >
      <CeremonyTop
        context={`${sportName} · ma`} title="Mozgás lezárva" backLabel="Bezárás"
        onBack={onClose} headingRef={headingRef}
      />
      <CeremonyRoot pass={pass} className="ec-cer">
        <CupStage pass={pass} label={`${sportName} · ma · ${huStars(score.stars)} csillag az ötből`}>
          <CeremonyReveal beat={1}>
            <p className="fo-hero-verdict">{verdictFor(score.stars)}</p>
            <p className="fo-hero-sub">A kehely az edzésidőből és az erőfeszítésből telt meg.</p>
          </CeremonyReveal>
        </CupStage>

        <CeremonyReveal beat={2} className="ec-numbers">
          <Section n={1} title="A mai számok" />
          <Card>
            <Facts className="ec-tally" items={counters} />
            {xpGained != null && (
              <div className="ec-xp">
                <Row icon="t-coin" title={`+${huNumber(xpGained)} szerzett XP`} sub="a mai mozgásért" />
              </div>
            )}
          </Card>
          {kcal && (
            <>
              <Section n={2} title="A mai mozgással" />
              <Card gold className="ec-kcal">
                <Row
                  left={<Bub icon="t-bowl" size={46} color="var(--fo-gold)" />}
                  title={`+${huNumber(kcal.value)} kcal került a mai keretedbe`}
                  sub={kcal.isEstimate ? 'Becslés, nem mérés' : 'Saját értéked'}
                />
              </Card>
            </>
          )}
          <Note className="ec-pending">A csillagok az edzésidőből és az erőfeszítésből számolnak, nem gépi értékelés.</Note>
        </CeremonyReveal>
      </CeremonyRoot>
    </Page>
  )
}
