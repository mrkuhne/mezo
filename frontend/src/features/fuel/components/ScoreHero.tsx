// ============================================================
// Mezo · ScoreHero (MealScoreSheet header block) — Logolás 2.1 (mezo-zeeq)
// 112px score ring with the tone word beside it, macro facts as chips (Rost only when
// the meal carries fiberG — never fabricated), and the confidence bar. The tone
// (jó / közepes / gyenge) is the same ladder the block pill uses (logic/scoreTone.ts)
// and washes the hero's background.
// ============================================================
import type { FuelMeal } from '@/data/types'
import { toneOf } from '@/features/fuel/logic/scoreTone'

const SIZE = 112
const STROKE = 8
const R = SIZE / 2 - STROKE
const C = 2 * Math.PI * R

export function ScoreHero({ meal, scorePct, confidence }: { meal: FuelMeal; scorePct: number; confidence: number }) {
  const pct = Math.round(scorePct)
  const tone = toneOf(pct)
  const conf = Math.round(confidence * 100)
  return (
    <div className={`sb-hero ${tone.cls}`}>
      <div className="sb-hero-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle className="sb-hero-t" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
          <circle className="sb-hero-f" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE}
            strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} />
        </svg>
        <span className="sb-hero-n" aria-label={`${pct} a 100-ból`}><b>{pct}</b><small>/ 100</small></span>
      </div>
      <div className="sb-hero-meta">
        <div className="sb-hero-word">{tone.word}</div>
        <div className="sb-hero-facts">
          <span><i>kcal</i>{meal.kcal}</span>
          <span><i>P</i>{meal.p} g</span>
          <span><i>C</i>{meal.c} g</span>
          <span><i>F</i>{meal.f} g</span>
          {meal.fiberG != null && <span><i>Rost</i>{meal.fiberG} g</span>}
        </div>
        <div className="sb-hero-conf">
          Konfidencia
          <span className="bar"><i style={{ width: `${conf}%` }} /></span>
          <b>{conf}%</b>
        </div>
      </div>
    </div>
  )
}
