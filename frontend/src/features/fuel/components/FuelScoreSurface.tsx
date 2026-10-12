// ============================================================
// Mezo · FuelScoreSurface (Fuel Titanium, mezo-jb84; Folyadék F5, mezo-n4wf5.5)
//
// EZ NEM EGY ÚJ PONTOZÓ FELÜLET. Ugyanazt a `MealBreakdown` envelope-ot rendereli az étkezés ÉS a recept értékelő
// oldalán — egy felület, két hívó; a SZÁMOK sehol nem mozdulnak (`logic/scoreArithmetic`, `logic/formatImpact`).
//
// FOLYADÉK (prototípus `vilagos/fuel.js` `scoreSurface` + a `dim` lap): a hős a pontszám a tízes skálán, mellette a
// megbízhatóság szintje, alatta a szempontok fiolákban (négy egy sorban); az ítélet az értékelés címsora, alatta Mezo
// olvasata. 1 · „Miből áll össze?" — szempontonként egy kétszintes sor; koppintásra a szempont lapja nyílik.
// 2 · „Ha feljebb vinnéd" — a hatás a tízes skálán, ugyanabból a számból, mint a pontszám (bible F4.8).
// 3 · „Hasznos volt?" — a visszajelzés és a lap jegyzete.
//
// Őszinte-null + szégyenmentesség: egy adat nélküli (súly 0) szempont „még tanulom", nem nulla pont; a hős száma mellől a
// „/10" elmarad (owner); a leggyengébb szempont borostyán, sosem hiba-szín.
//
// A szempont neve, magyarázata, a tény-sorok és a javaslatok SZERVER-szövegek (az étkezéssel együtt tárolva, azon a
// nyelven, amelyen pontozták): úgy jelennek meg, ahogy érkeznek. A logika a stabil `id`-re köt, címkére soha.
// ============================================================
import { useId, useState, type ReactNode } from 'react'
import { fmtNum } from '@/shared/lib/format'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Acts, Btn, Card, Chips, FoSheetHead, Hero, Level, Lk, Note, Row, Section, Txt, Vials, type VialItem,
} from '@/shared/ui/folyadek'
import type { MealBreakdown, MealDimension } from '@/data/types'
import { dimWeightPct } from '@/features/fuel/logic/scoreArithmetic'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { MacroPanel } from '@/features/fuel/components/MacroPanel'
import { MicroPanel } from '@/features/fuel/components/MicroPanel'
import { NovaPanel } from '@/features/fuel/components/NovaPanel'
import { ContextPanel } from '@/features/fuel/components/ContextPanel'
import { MealTimingStrip } from '@/features/fuel/components/MealTimingStrip'
import { ItemRow, Tip } from '@/features/fuel/components/folyadek'

/** A szempont jele, a stabil `id` szerint (prototípus `DIMS`). */
const DIM_ICON: Record<MealDimension['id'], Icon3DName> = {
  macro: 't-macro', nova: 't-processing', context: 't-clock', micro: 't-micro', who: 't-shield',
  fat_quality: 't-avocado', plant_diversity: 't-sprout', energy_density: 't-bolt', portion: 't-portion',
}
const dimIcon = (dim: MealDimension): Icon3DName => DIM_ICON[dim.id] ?? 't-heart'

/** A szempont pontja a tízes skálán — EGY szám, EGY kerekítés: ebből lesz a kiírt érték és a szint is. */
const dimTen = (d: MealDimension): number => Math.round(d.score * 100) / 10
const isOff = (d: MealDimension): boolean => d.weight === 0

/** A leggyengébb és a legerősebb ÉLŐ szempont indexe; csak akkor jelöljük, ha tényleg különböznek. */
function extremes(dims: MealDimension[]): { low: number; high: number } {
  let low = -1, high = -1
  dims.forEach((d, i) => {
    if (isOff(d)) return
    if (low < 0 || dimTen(d) < dimTen(dims[low])) low = i
    if (high < 0 || dimTen(d) > dimTen(dims[high])) high = i
  })
  return low >= 0 && high >= 0 && dimTen(dims[low]) < dimTen(dims[high]) ? { low, high } : { low: -1, high: -1 }
}

const chunk = <T,>(a: T[], size: number): T[][] => a.reduce<T[][]>((rows, x, i) => {
  if (i % size === 0) rows.push([])
  rows[rows.length - 1].push(x)
  return rows
}, [])

/** Egy szempont lapja (prototípus `dim`): a pont a cím, alatta a szempont neve; súly, lefedettség, a szint, a szerver
 *  magyarázata és a szempont SAJÁT tényei a meglévő panelekből. A payload-mező a kapu (nem az id): egy régi, cache-elt
 *  envelope ismert id-t hozhat a payloadja nélkül. */
function DimSheet({ dim, low, onClose }: { dim: MealDimension; low: boolean; onClose: () => void }) {
  const M = useM()
  const S = M.fuelEtkezes.score
  const titleId = useId()
  const off = isOff(dim)
  const value = fmtNum(dimTen(dim), 1)
  return (
    <Sheet onClose={onClose} labelledBy={titleId} className="fo-sheet fe-dimsheet">
      {(close) => (
        <>
          <FoSheetHead icon={dimIcon(dim)} title={off ? '—' : value} sub={<span id={titleId}>{dim.label}</span>} onClose={close} />
          <Chips className="fe-chips" items={[
            S.weight(dimWeightPct(dim)),
            ...(dim.coverage != null ? [S.coverage(Math.round(dim.coverage * 100))] : []),
          ]} />
          <div className="fe-eqb" role="img" aria-label={off ? S.levelAriaOff(dim.label) : S.levelAria(dim.label, value)}>
            <Level pct={off ? 0 : dimTen(dim) * 10} height={22} color={low ? 'var(--fo-warn)' : 'var(--dom)'} />
          </div>
          {off ? (
            <Tip icon="t-info" title={S.honestly}>{S.honestlyBody}</Tip>
          ) : (
            <>
              {dim.detail && <Txt><SafeMarkdown text={dim.detail} /></Txt>}
              <div className="fe-panel">
                {dim.id === 'macro' && 'macroRatio' in dim && <MacroPanel dim={dim} />}
                {dim.id === 'micro' && 'micros' in dim && <MicroPanel dim={dim} />}
                {dim.id === 'nova' && 'nova' in dim && <NovaPanel dim={dim} />}
                {dim.id === 'context' && 'timing' in dim && dim.timing != null && <MealTimingStrip timing={dim.timing} />}
                {(dim.id === 'context' || dim.id === 'who' || dim.id === 'fat_quality'
                  || dim.id === 'plant_diversity' || dim.id === 'energy_density' || dim.id === 'portion')
                  && 'context' in dim && <ContextPanel dim={dim} />}
              </div>
            </>
          )}
          {dim.note && <Tip icon="t-score" title={S.mezoNote}><SafeMarkdown text={dim.note} /></Tip>}
          <Acts><Lk onClick={close}>{S.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}

export interface FuelScoreSurfaceProps {
  breakdown: MealBreakdown
  /** 0–100. A hívó adja, mert az étkezésnél a mentett `score`, a receptnél a súlyozott összeg a forrás. */
  scorePct: number
  /** A hős felirata: mire szól az értékelés („Reggeli · 07:20", „Recept · sablon · 1 adag · 345 kcal"). */
  label: ReactNode
  tagline: string | null
  /** Mezo prózája — null, amíg készül vagy ha ki van kapcsolva. */
  summary: string | null
  coachPending?: boolean
  improve: MealBreakdown['improve']
  /** A hős gombja: vissza ahhoz, amiről az értékelés szól („Az étkezés részletei", „A recept részletei"). */
  detail: { label: string; onClick: () => void }
  /** A próza alatti visszajelzés-csík; a hívó dönti el, van-e mire szavazni. */
  feedback?: ReactNode
  /** A lap alján álló, felületfüggő jegyzet. */
  note: ReactNode
}

export function FuelScoreSurface({
  breakdown, scorePct, label, tagline, summary, coachPending, improve, detail, feedback, note,
}: FuelScoreSurfaceProps) {
  const M = useM()
  const S = M.fuelEtkezes.score
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const dims = breakdown.dimensions
  const openDim = openIdx == null ? null : dims[openIdx] ?? null
  const { low, high } = extremes(dims)
  const score = fmtNum(scorePct / 10, 1)
  const confidence = Math.round(breakdown.confidence * 100)
  // A tárolt címsor mondatként áll a hősben: pontot kap, ha nincs a végén írásjel.
  const verdict = tagline ? (/[.!?…]$/.test(tagline.trim()) ? tagline.trim() : `${tagline.trim()}.`) : S.verdictFallback(score)

  const vial = (d: MealDimension, i: number): VialItem => {
    const short = S.short[d.id as keyof typeof S.short] ?? S.short.other
    if (isOff(d)) {
      return {
        label: short, icon: dimIcon(d), color: 'var(--fo-faint)', pct: 0, value: '—', note: S.learning,
        onClick: () => setOpenIdx(i), ariaLabel: S.dimAriaOff(d.label),
      }
    }
    const value = fmtNum(dimTen(d), 1)
    return {
      label: short, icon: dimIcon(d), color: i === low ? 'var(--fo-warn)' : 'var(--dom)', pct: dimTen(d) * 10, value,
      note: i === low ? S.weakest : i === high ? S.strongest : S.weight(dimWeightPct(d)),
      onClick: () => setOpenIdx(i), ariaLabel: S.dimAria(d.label, value),
    }
  }
  const vialRows = chunk(dims.map(vial), 4)

  return (
    <>
      <Hero className="fe-ghero fe-schero" label={label} verdict={verdict}
        sub={summary ? <SafeMarkdown text={summary} /> : coachPending ? S.readingPending : undefined}
        actions={<Btn onClick={detail.onClick}>{detail.label}</Btn>}>
        <div className="fe-sc">
          {/* a szám mellől a „/10" elmarad (owner) */}
          <span className="fo-big" role="img" aria-label={S.heroAria(score)}><span aria-hidden="true">{score}</span></span>
          <span className="c"><Level pct={confidence} height={14} label={S.confidence(confidence)} /></span>
        </div>
        <div className="fe-8">
          {vialRows.map((items, r) => <Vials key={r} items={items} height={92} />)}
        </div>
      </Hero>

      <Section n={1} title={S.madeOf} />
      <Card className="fe-dims">
        {dims.map((d, i) => {
          const off = isOff(d)
          const value = fmtNum(dimTen(d), 1)
          return (
            <ItemRow key={`${d.id}-${i}`} icon={dimIcon(d)} title={d.label} onClick={() => setOpenIdx(i)}
              sub={off ? S.leftOut : d.detail ? <span className="fe-det"><SafeMarkdown text={d.detail} /></span> : undefined}
              value={off ? '—' : value}>
              <Level pct={off ? 0 : dimTen(d) * 10} height={8} color={i === low ? 'var(--fo-warn)' : 'var(--dom)'} />
              <small className="fe-shn">
                {off ? S.learningLittle : i === low ? S.weightWeakest(dimWeightPct(d)) : S.weight(dimWeightPct(d))}
              </small>
            </ItemRow>
          )
        })}
        <Note>{S.tapRow}</Note>
      </Card>

      {improve.length > 0 && (
        <>
          <Section n={2} title={S.raise} />
          <Card className="fe-impc">
            {improve.map((it, i) => (
              <Row key={i} icon="t-bolt" title={<SafeMarkdown text={it.text} />}
                right={<span className="v fe-imp">{formatImpact(it.impact)}</span>} />
            ))}
          </Card>
        </>
      )}

      {feedback ? (
        <>
          <Section n={improve.length > 0 ? 3 : 2} title={S.useful} />
          <Card className="fe-fbc">
            {feedback}
            <Note>{note}</Note>
          </Card>
        </>
      ) : (
        <Card className="fe-fbc"><Note>{note}</Note></Card>
      )}

      {openDim && <DimSheet dim={openDim} low={openIdx === low} onClose={() => setOpenIdx(null)} />}
    </>
  )
}
