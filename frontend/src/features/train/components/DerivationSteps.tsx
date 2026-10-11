// ============================================================
// Mezo · DerivationSteps — „Honnan jön ez a szám": the four layers behind a muscle's
// weekly set count (mezo-d20.15; Folyadék F3 mezo-n4wf5.3, prototype vilagos/edzes.js
// `izom()` section 4). Four numbered rows in plain words:
//   1 Kiinduló ajánlás — the baseline table's three landmarks (VolumeProfile.source.baseline)
//   2 Fókusz · {tier}  — the tier's own ramp: where it starts, its ceiling, the weekly step
//   3 Rád szabva       — the engine's adjustments (source.adjustments), honestly empty when
//                        it made none
//   4 Ebben a tervben  — the arc's own week-by-week planned series up to now, and Monday
// then how sure the band is (source.confidence) as a level, and the „Felülír" link, which
// has never had a real path (inert unless `onOverride` is given).
// The data source is unchanged — only the face and the words: no MEV / MAV / MRV, no
// „baseline", no „plafon".
// ============================================================
import type { MuscleTier, VolumeProfile } from '@/data/types'
import { DayNum } from '@/features/train/components/folyadek'
import { tierLabel } from '@/features/train/logic/tierLabel'
import { Acts, Level, Lk, Row } from '@/shared/ui/folyadek'

/** The three landmarks in the owner's words. */
const LANDMARK: Record<'mev' | 'mav' | 'mrv', string> = { mev: 'az alsó jelölés', mav: 'a közép', mrv: 'a felső érték' }

/** „2-vel", „3-mal" — the instrumental suffix of a numeral read aloud (1–10; beyond that the plain number). */
const WITH: Record<number, string> = { 1: '1-gyel', 2: '2-vel', 3: '3-mal', 4: '4-gyel', 5: '5-tel', 6: '6-tal', 7: '7-tel', 8: '8-cal', 9: '9-cel', 10: '10-zel' }

/** One adjustment's effect in words: „a felső érték 2-vel lejjebb". */
export function effectText(delta: Partial<Record<'mev' | 'mav' | 'mrv', number>>): string {
  return (Object.entries(delta) as ['mev' | 'mav' | 'mrv', number][])
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${LANDMARK[k]} ${WITH[Math.abs(v)] ?? `${Math.abs(v)} szettel`} ${v > 0 ? 'feljebb' : 'lejjebb'}`)
    .join(', ')
}

export interface DerivationStepsProps {
  profile: VolumeProfile
  tier: MuscleTier
  ceiling: number
  weekOneValue: number
  /** through the current week, in order — the LAST entry is „most". */
  series: { week: number; planned: number }[]
  /** how many sets the Monday rollover adds — already clamped to the ceiling by
   *  `nextStep`/`MuscleWeekTile.step`; 0 renders as a plain '=' hold. */
  step: number
  onOverride?: () => void
}

export function DerivationSteps({ profile, tier, ceiling, weekOneValue, series, step, onOverride }: DerivationStepsProps) {
  const { source } = profile
  const confidencePct = Math.round(source.confidence * 100)
  const stepText = step > 0 ? `+${step}` : '='

  return (
    <>
      <Row left={<DayNum>1</DayNum>} title="Kiinduló ajánlás"
        sub={`ennyitől fejlődik: ${source.baseline.mev} · közép: ${source.baseline.mav} · legfeljebb: ${source.baseline.mrv}`} />
      <Row left={<DayNum>2</DayNum>} title={`Fókusz · ${tierLabel(tier)}`}
        sub={tier === 'maintain'
          ? `tart: ${profile.mev} · hetente +0`
          : `indul: ${weekOneValue} · felső érték: ${ceiling} · hetente ${stepText}`} />
      <Row left={<DayNum>3</DayNum>} title="Rád szabva"
        sub={source.adjustments.length === 0
          ? 'nincs igazítás — a kiinduló ajánlás érvényes'
          : source.adjustments.map((a, i) => (
              <span key={i} className={a.warning ? 'ep-adj warn' : 'ep-adj'}>
                {i > 0 && <br />}
                {a.label}{effectText(a.delta) && ` — ${effectText(a.delta)}`}
              </span>
            ))} />
      <Row left={<DayNum>4</DayNum>} title="Ebben a tervben"
        sub={[
          ...series.map((s, i) => `${s.week}. hét${i === series.length - 1 ? ' · most' : ''}: ${s.planned}`),
          `hétfőn: ${stepText}`,
        ].join(' · ')} />
      <div className="ep-hero-level">
        <Level pct={confidencePct} height={18} label="Mennyire biztos a sáv" value={`${confidencePct}%`} />
      </div>
      <Acts>
        <Lk disabled={!onOverride} title={onOverride ? undefined : 'hamarosan'} onClick={onOverride}>
          {onOverride ? 'Felülír' : 'Felülír · hamarosan'}
        </Lk>
      </Acts>
    </>
  )
}
