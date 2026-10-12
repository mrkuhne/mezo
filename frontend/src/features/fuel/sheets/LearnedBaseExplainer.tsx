import { useState, type ReactNode } from 'react'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { addDays } from '@/shared/lib/dates'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Bub, Facts, FoSheetHead, Level, Lk, Note, Row, Tags, Txt, Vials, type VialItem } from '@/shared/ui/folyadek'
import { Lgd, Tip } from '@/features/fuel/components/folyadek'
import { useExpenditureExplanation } from '@/data/fuel/expenditureHooks'
import type { ExpenditureExplanation } from '@/data/fuel/expenditureApi'
import { LearnedBaseChart } from '@/features/fuel/sheets/LearnedBaseChart'
import { CONFIDENCE_WORD, dec, huShortDate, huWeekRange, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'
import { Tot, rich } from '@/features/fuel/sheets/tanulasPieces'

// „Hogy tanultam?” (mezo-y72o3) — the learned base's explainer: the „A legutóbbi hét részletei” section
// of the learning page. Folyadék (mezo-n4wf5.5): build target fuel.js `tanulas()` section 4 + `HWT()` +
// sheet `hw:<0–5>`. LAYOUT DECISION (prototype, owner OK 2026-10-12): the six steps are no longer six
// inline cells — each is ONE numbered row with a one-line digest of its numbers, and the step itself
// opens in a sheet with „Előző / Következő lépés" between the steps. Same data, same rules:
// honest data — every number comes from the persisted explanation; a step whose data is missing is
// hidden (never a 0 or a guessed fallback) and the rest renumber.

type Confidence = ExpenditureExplanation['confidence']
/** The why-note shows only when the stepped base and the simple estimate really differ. */
export const WHY_NOTE_MIN_GAP_KCAL = 30

const ZONE: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
const CONFIDENCES: Confidence[] = ['low', 'medium', 'high']
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
/**
 * Meter level (0..1). The vessel is three equal zones (low | medium | high); within a zone the
 * ±1 SD places the level linearly (low: 300→200, medium: 200→100, high: 100→0 kcal). The level is
 * always clamped into the SERVED confidence's zone, so the lit word and the level never disagree.
 */
export const meterPosition = (sdKcal: number, confidence: Confidence) => {
  const zone = ZONE[confidence]
  const hi = 300 - zone * 100 // the zone's left-edge SD
  return (zone + clamp01((hi - sdKcal) / 100)) / 3
}

type StepKey = 'data' | 'chart' | 'calc' | 'filtered' | 'sure' | 'steps'
interface Step { key: StepKey; title: string; sub: string }

/** `+ 132` / `− 132` for the digest of the calculation. */
const term = (n: number) => `${Math.round(n) < 0 ? '−' : '+'} ${fmtGrouped(Math.abs(n))}`

export function LearnedBaseExplainerBody({ explanation: x, reducedMotion }: {
  explanation: ExpenditureExplanation
  /** Test seam; defaults to `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}) {
  const M = useM()
  const T = M.fuelTanulas
  const H = T.how
  const [open, setOpen] = useState<number | null>(null)

  // `tissueRateKgPerWeek` is null on HOLDING rows / without a filter trace → no calculation step at all.
  const hasCalc = x.avgIntakeKcal != null && x.tissueRateKgPerWeek != null && x.avgMovementKcal != null && x.simpleBaseKcal != null
  const hasChart = x.series.length > 0
  const suspicious = x.excludedDays.filter(d => d.reason === 'suspicious')
  const marked = x.excludedDays.filter(d => d.reason === 'marked')
  const hasFiltered = x.excludedDays.length > 0 || x.waterEvents.length > 0 || x.unloggedDays > 0
  const showStart = x.startBaseKcal !== x.formulaBaseKcal
  const stepped = Math.round(x.stepKcal) !== 0
  const sd = String(round10(x.posteriorSdKcal))
  const simple = x.simpleBaseKcal
  const tissueKcal = x.tissueKcalPerDay ?? 0

  // Consecutive numbering over the steps actually shown.
  const steps: Step[] = [
    { key: 'data', title: H.data.title, sub: H.data.sub(x.usableDays, x.weighInDays, x.historyWeeks) },
    ...(hasChart ? [{ key: 'chart' as const, title: H.chart.title, sub: H.chart.sub }] : []),
    ...(hasCalc ? [{
      key: 'calc' as const,
      title: H.calc.title,
      sub: H.calc.sub(`${fmtGrouped(x.avgIntakeKcal!)} ${term(-tissueKcal)} ${term(-x.avgMovementKcal!)} ≈ ${fmtGrouped(round10(simple!))}`),
    }] : []),
    ...(hasFiltered ? [{
      key: 'filtered' as const,
      title: H.filtered.title,
      sub: [
        suspicious.length > 0 && marked.length > 0 ? H.filtered.subLeftOutBoth(suspicious.length, marked.length)
          : x.excludedDays.length > 0 ? H.filtered.subLeftOut(x.excludedDays.length) : null,
        x.waterEvents.length > 0 ? H.filtered.subWater : null,
        x.unloggedDays > 0 ? H.filtered.subUnlogged(x.unloggedDays) : null,
      ].filter(Boolean).join(' · '),
    }] : []),
    { key: 'sure', title: H.sure.title, sub: H.sure.sub(sd, CONFIDENCE_WORD[x.confidence].toLowerCase()) },
    {
      key: 'steps',
      title: H.steps.title,
      sub: [
        fmtGrouped(x.formulaBaseKcal),
        ...(showStart ? [fmtGrouped(x.startBaseKcal)] : []),
        ...(stepped ? [signed(x.stepKcal)] : []),
        fmtGrouped(x.appliedBaseKcal),
      ].join(' → '),
    },
  ]
  const stepsNo = steps.length // „Hogyan léptem" is always the last one
  const showWhy = simple != null && Math.abs(x.appliedBaseKcal - simple) >= WHY_NOTE_MIN_GAP_KCAL

  const body = (key: StepKey): ReactNode => {
    switch (key) {
      case 'data':
        return (
          <>
            <Facts items={[[x.usableDays, H.data.days], [x.weighInDays, H.data.weighIns], [x.historyWeeks, H.data.weeks]]} />
            <Txt>{H.data.text}</Txt>
          </>
        )
      case 'chart':
        return (
          <>
            <LearnedBaseChart series={x.series} historyWeeks={x.historyWeeks} reducedMotion={reducedMotion} />
            <Lgd items={[['liq', H.chart.legendCounts], ['hatch', H.chart.legendIncomplete], ['tr', H.chart.legendTrend], ['water', H.chart.legendWater]]} />
          </>
        )
      case 'calc': {
        const ate = x.avgIntakeKcal!
        const rate = x.tissueRateKgPerWeek!
        const afterTissue = ate - tissueKcal
        const afterMove = afterTissue - x.avgMovementKcal!
        const pct = (v: number) => (ate > 0 ? Math.max(0, Math.min(100, (v / ate) * 100)) : 0)
        const rows: Array<[icon: 't-bowl' | 't-weight' | 't-steps', label: string, sub: string, value: string, level: number]> = [
          ['t-bowl', H.calc.ate, H.calc.ateSub(x.usableDays), fmtGrouped(ate), 100],
          rate > 0 ? ['t-weight', H.calc.gained, H.calc.gainedSub(dec(rate, 2)), signed(-tissueKcal), pct(afterTissue)]
            : rate < 0 ? ['t-weight', H.calc.lost, H.calc.lostSub(dec(Math.abs(rate), 2)), signed(-tissueKcal), pct(afterTissue)]
              : ['t-weight', H.calc.flat, H.calc.flatSub, signed(-tissueKcal), pct(afterTissue)],
          ['t-steps', H.calc.moved, H.calc.movedSub, signed(-x.avgMovementKcal!), pct(afterMove)],
        ]
        return (
          <>
            {rows.map(([icon, label, sub, value, level]) => (
              <div key={icon} className="ft-gr">
                <Bub icon={icon} size={30} />
                <span><b>{label}</b><small>{sub}</small></span>
                <em>{value}</em>
                <Level pct={level} height={12} />
              </div>
            ))}
            <Tot label={H.calc.total} value={`≈ ${fmtGrouped(round10(simple!))}`} unit="kcal" />
            {showWhy && (
              <Txt className="ft-why">
                {rich((x.confidence === 'high' ? H.calc.whySure : H.calc.whyUnsure)(fmtGrouped(x.appliedBaseKcal), fmtGrouped(round10(simple!)), stepsNo))}
              </Txt>
            )}
            <Note>{H.calc.note}</Note>
          </>
        )
      }
      case 'filtered':
        return (
          <>
            {suspicious.length > 0 && (
              <>
                <Tip icon="t-shield" color="var(--fo-warn)" title={H.filtered.suspicious(suspicious.length)}>{H.filtered.suspiciousText}</Tip>
                <Tags className="ft-chips" items={suspicious.map(d => H.filtered.dayKcal(huShortDate(d.date), fmtGrouped(d.kcal)))} />
              </>
            )}
            {marked.length > 0 && (
              <>
                <Tip icon="t-shield" color="var(--fo-warn)" title={H.filtered.marked(marked.length)}>{H.filtered.markedText(marked.length)}</Tip>
                <Tags className="ft-chips" items={marked.map(d => H.filtered.dayKcal(huShortDate(d.date), fmtGrouped(d.kcal)))} />
              </>
            )}
            {x.waterEvents.map(w => (
              <Tip key={w.date} icon="t-water" color="var(--fx-water)" title={H.filtered.water(huShortDate(w.date))}>{H.filtered.waterText(dec(w.kg, 1))}</Tip>
            ))}
            {x.unloggedDays > 0 && (
              <Tip icon="t-calendar" color="var(--fo-faint)" title={H.filtered.unlogged(x.unloggedDays)}>{H.filtered.unloggedText}</Tip>
            )}
          </>
        )
      case 'sure': {
        const text = x.confidence === 'low' ? H.sure.textLow : x.confidence === 'medium' ? H.sure.textMedium : H.sure.textHigh
        return (
          <>
            <Txt>{rich(text(sd))}</Txt>
            <div className="ft-meter" role="img" aria-label={H.sure.meterAria(CONFIDENCE_WORD[x.confidence])}>
              <Level pct={meterPosition(x.posteriorSdKcal, x.confidence) * 100} height={22} />
              <div className="ft-gb3">
                {CONFIDENCES.map(c => <span key={c} className={c === x.confidence ? 'on' : undefined}>{CONFIDENCE_WORD[c]}</span>)}
              </div>
            </div>
            {x.confidence !== 'high' && <Note>{H.sure.more}</Note>}
          </>
        )
      }
      case 'steps': {
        // the three bases share one scale (the lowest at 40 %, the highest at 72 %); the step is its own small amount
        const bases = [x.formulaBaseKcal, ...(showStart ? [x.startBaseKcal] : []), x.appliedBaseKcal]
        const min = Math.min(...bases)
        const max = Math.max(...bases)
        const lvl = (v: number) => (max === min ? 56 : 40 + ((v - min) / (max - min)) * 32)
        const vials: VialItem[] = [
          { label: H.steps.formula, value: fmtGrouped(x.formulaBaseKcal), pct: lvl(x.formulaBaseKcal), color: 'var(--fo-faint)' },
          ...(showStart ? [{ label: H.steps.earlier, value: fmtGrouped(x.startBaseKcal), pct: lvl(x.startBaseKcal) }] : []),
          ...(stepped ? [{
            label: H.steps.thisWeek, value: signed(x.stepKcal), pct: Math.max(12, Math.min(60, (Math.abs(x.stepKcal) / 150) * 60)),
            color: x.stepKcal < 0 ? 'var(--fo-warn)' : 'var(--fo-ok)',
          }] : []),
          { label: H.steps.now, value: fmtGrouped(x.appliedBaseKcal), pct: lvl(x.appliedBaseKcal) },
        ]
        return (
          <>
            <Vials className="ft-steps" items={vials} height={92} />
            <Txt>{H.steps.text}</Txt>
          </>
        )
      }
    }
  }

  const at = open != null ? Math.min(open, steps.length - 1) : null
  const range = huWeekRange(x.weekStart, addDays(x.weekStart, 6))

  return (
    <>
      {steps.map((s, i) => (
        <Row key={s.key} className="ft-step" left={<span className="ft-dd">{i + 1}</span>} title={s.title} sub={s.sub} onClick={() => setOpen(i)} />
      ))}
      {at != null && (
        <Sheet className="fo-sheet ft-how-sheet" labelledBy="learned-step-title" onClose={() => setOpen(null)}>
          {(close) => (
            <>
              <FoSheetHead icon="t-lens" titleId="learned-step-title" title={H.sheetTitle(at + 1, steps[at].title)} sub={H.sheetSub(range)} onClose={close} />
              {body(steps[at].key)}
              <Acts>
                {at > 0 && <Lk onClick={() => setOpen(at - 1)}>{H.prev}</Lk>}
                {at < steps.length - 1 && <Btn sm onClick={() => setOpen(at + 1)}>{H.next}</Btn>}
                <Lk onClick={close}>{T.close}</Lk>
              </Acts>
            </>
          )}
        </Sheet>
      )}
    </>
  )
}

/** Data-bound explainer — the six rows of the learning page's last section. */
export function LearnedBaseExplainer({ reducedMotion }: { reducedMotion?: boolean }) {
  const H = useM().fuelTanulas.how
  const { data, isPending, isError } = useExpenditureExplanation(true)
  if (data) return <LearnedBaseExplainerBody explanation={data} reducedMotion={reducedMotion} />
  return <Note className="ft-state">{isPending ? H.loading : isError ? H.error : H.empty}</Note>
}
