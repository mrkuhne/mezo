// ============================================================
// Mezo · WindowBlock — one eating window as a full-width stacked block on the
// /fuel/log page (mezo-byo1; prototype fuel-logolas.html `.logblk`, re-cut by
// Logolás 2.1 — mezo-zeeq, prototype fuel-logolas-2.1.html). Replaces the
// retired WindowLane's narrow scroll-snap tile with a wide, state-washed
// card: done (sage wash, KÉSZ ✓, context chip, one row of AI-score pill + kcal,
// four 44px macro rings incl. Rost), now (coral ring, MOST stamp, plan meal,
// primary Logold), missed (dashed amber, "még pótolható", Pótold — never
// punitive), future (plan suggestion, ghost Logold).
//
// The CTAs are a NAVIGATION intent (mezo-bq2t): `onOpen` sends the page to
// /fuel/log/uj with this window in the URL — the block no longer expands a
// composer well in place, so it stays a card and nothing here animates open.
//
// Purely presentational: every datum comes from `WindowTileVM` (fuelSwimlane.ts),
// every action is a prop. Rings sweep by a CSS stroke-dashoffset transition
// flipped one frame after mount (the KeretHero ring recipe); the score pill's
// periodic nudge is pure CSS (prototype.css `fh-aisc-nudge`, reduced-motion off).
// ============================================================
import { useEffect, useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { huInt } from '@/shared/lib/huNum'
import { toneOf } from '@/features/fuel/logic/scoreTone'
import { MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'
import type { TileRingVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'

/** The stamp each state wears in the block's top row (prototype `.wstamp`). */
const STAMP: Partial<Record<WindowTileVM['state'], { text: string; cls: string }>> = {
  done: { text: 'KÉSZ ✓', cls: 'fh-st-done' },
  now: { text: 'MOST', cls: 'fh-st-now' },
  missed: { text: 'KIMARADT', cls: 'fh-st-miss' },
}

const RING = 44
const RING_STROKE = 4.5
const RING_R = RING / 2 - RING_STROKE
const RING_C = 2 * Math.PI * RING_R

const PILL = 30
const PILL_STROKE = 3.5
const PILL_R = PILL / 2 - PILL_STROKE
const PILL_C = 2 * Math.PI * PILL_R

/** One-frame `filled` flip so the CSS stroke-dashoffset transition carries the sweep — the
 *  KeretHero ring recipe (reduced motion: already filled on mount, and the CSS transition is
 *  off, so nothing animates). */
function useFilled(): boolean {
  const reduced = useReducedMotion()
  const [filled, setFilled] = useState(reduced)
  useEffect(() => {
    if (reduced) return
    const raf = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(raf)
  }, [reduced])
  return filled
}

function MacroRing({ ring, filled }: { ring: TileRingVM; filled: boolean }) {
  const frac = Math.max(0, Math.min(1, ring.pct / 100))
  // A logged window's P/C/F rings read as the meal's own build ("az étel 30%-a"), a planned
  // window's — and a done tile's Rost ring — still as the day's keret (mezo-tjua).
  const meal = ring.basis === 'meal'
  return (
    <span
      className="fh-wring"
      role="img"
      aria-label={meal
        ? `${ring.label} ${ring.grams} g, az étel ${ring.pct} százaléka`
        : `${ring.label} ${ring.grams} g, a napi cél ${ring.pct} százaléka`}
    >
      <span className="fh-wring-w">
        <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
          <circle className="fh-wring-t" cx={RING / 2} cy={RING / 2} r={RING_R} strokeWidth={RING_STROKE} />
          <circle className="fh-wring-f" cx={RING / 2} cy={RING / 2} r={RING_R} strokeWidth={RING_STROKE}
            stroke={ring.color} strokeDasharray={RING_C} strokeDashoffset={filled ? RING_C - frac * RING_C : RING_C} />
        </svg>
        <i aria-hidden="true">{ring.letter}</i>
      </span>
      <b>{ring.grams}<em> g</em></b>
      <small>{ring.pct}%{meal ? '' : ' napi'}</small>
    </span>
  )
}

function ScorePill({ tile, filled, onScore }: { tile: WindowTileVM; filled: boolean; onScore: (mealId: string) => void }) {
  // Fresh log: the AI score has not landed yet — say so, never show a fabricated number
  // and never a red/failing tone (guardrail: honest states, never punitive).
  if (tile.scorePct == null) return <span className="fh-scorech is-pend">✨ folyamatban</span>
  const tone = toneOf(tile.scorePct)
  const frac = tile.scorePct / 100
  const body = (
    <>
      <span className="fh-aisc-r">
        <svg width={PILL} height={PILL} viewBox={`0 0 ${PILL} ${PILL}`} aria-hidden="true">
          <circle className="fh-aisc-t" cx={PILL / 2} cy={PILL / 2} r={PILL_R} strokeWidth={PILL_STROKE} />
          <circle className="fh-aisc-f" cx={PILL / 2} cy={PILL / 2} r={PILL_R} strokeWidth={PILL_STROKE}
            strokeDasharray={PILL_C} strokeDashoffset={filled ? PILL_C - frac * PILL_C : PILL_C} />
        </svg>
        <i aria-hidden="true">✨</i>
      </span>
      <span className="fh-aisc-t2"><b>{tile.scorePct}</b><small>{tone.word}</small></span>
    </>
  )
  // A breakdown-less meal has no score sheet to open (MealScoreSheet renders null) —
  // it stays inert rather than a dead tap.
  if (!tile.scorable || tile.mealId == null) return <span className={`fh-aisc ${tone.cls}`}>{body}</span>
  return (
    <button type="button" className={`fh-aisc ${tone.cls} is-tap`} onClick={() => onScore(tile.mealId!)}
      aria-label={`${tile.name} · AI score részletek`}>
      {body}
      <span className="fh-aisc-chev" aria-hidden="true">›</span>
    </button>
  )
}

export interface WindowBlockProps {
  tile: WindowTileVM
  /** Navigate to the logging page for this window — `ai` = the ✨ AI ghost CTA (panel armed). */
  onOpen: (ai: boolean) => void
  /** A done block's score pill → MealScoreSheet. */
  onScore: (mealId: string) => void
}

export function WindowBlock({ tile, onOpen, onScore }: WindowBlockProps) {
  const stamp = STAMP[tile.state]
  const done = tile.state === 'done'
  const filled = useFilled()
  return (
    <div className={`flog-blk is-${tile.state}`} data-state={tile.state}>
      <div className="flog-in">
        <div className="flog-top">
          <time>{tile.time}</time>
          <span className="flog-lbl">{tile.label}</span>
          {/* The role the meal was SCORED under — only a scored done meal carries one. */}
          {done && tile.context && (
            <span className={`fh-ctx is-${tile.context}`}>
              <i aria-hidden="true" />
              {MEAL_CONTEXT_LABEL[tile.context]}
            </span>
          )}
          {stamp && <span className={`fh-wstamp ${stamp.cls}`}>{stamp.text}</span>}
        </div>
        {done ? (
          <>
            <div className="flog-main">
              <div className="flog-icon"><ClayIcon name={tile.icon} size={34} /></div>
              <div className="flog-txt">
                <div className="flog-name">{tile.name}</div>
              </div>
            </div>
            {/* One row: the AI-score pill and the kcal, side by side (mezo-zeeq). Honest kcal:
                a meal the composition carries no kcal for shows no cell at all. */}
            <div className="flog-srow">
              <ScorePill tile={tile} filled={filled} onScore={onScore} />
              {tile.kcal != null && (
                <div className="flog-kcal"><b>{huInt(tile.kcal)}</b><small>kcal</small></div>
              )}
            </div>
            <div className="flog-rings is-done">
              {tile.rings.map(r => <MacroRing key={r.key} ring={r} filled={filled} />)}
            </div>
          </>
        ) : (
          <div className="flog-main">
            <div className="flog-icon"><ClayIcon name={tile.icon} size={34} /></div>
            <div className="flog-txt">
              <div className={`flog-name${tile.ghost ? ' is-ghost' : ''}`}>{tile.name}</div>
              {/* Meta line, honest: "a tervből" only with a real plan suggestion behind it;
                  a missed window says what it can still be, never what was lost. */}
              {tile.state === 'missed'
                ? <div className="flog-meta">még pótolható</div>
                : tile.fromPlan ? <div className="flog-meta">a tervből</div> : null}
            </div>
            <div className="flog-data">
              {tile.kcal != null && (
                <div className="flog-kcal"><b>{huInt(tile.kcal)}</b><small>kcal terv</small></div>
              )}
              <div className="flog-rings">
                {tile.rings.map(r => <MacroRing key={r.key} ring={r} filled={filled} />)}
              </div>
            </div>
          </div>
        )}
        {!done && (
          <div className="flog-ctas">
            <button
              type="button"
              className={tile.state === 'now' ? 'cta-primary' : 'cta-ghost'}
              onClick={() => onOpen(false)}
              aria-label={`${tile.state === 'missed' ? 'Pótold' : 'Logold'} · ${tile.label}`}
            >
              {tile.state === 'missed' ? 'Pótold' : 'Logold'}
            </button>
            <button type="button" className="cta-ghost" onClick={() => onOpen(true)}
              aria-label={`AI naplózás · ${tile.label}`}>
              ✨ AI
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
