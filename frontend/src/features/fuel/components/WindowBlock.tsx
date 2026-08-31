// ============================================================
// Mezo · WindowBlock — one eating window as a full-width stacked block on the
// /fuel/log page (mezo-byo1; prototype fuel-logolas.html `.logblk`). Replaces
// the retired WindowLane's narrow scroll-snap tile with a wide, state-washed
// card: done (sage wash, KÉSZ ✓, meal name, AI-score chip), now (coral ring,
// MOST stamp, plan meal, primary Logold), missed (dashed amber, "még
// pótolható", Pótold — never punitive), future (plan suggestion, ghost Logold).
//
// The block owns the EXPAND-IN-PLACE well: when `open`, the CTA row hides and
// `children` (the MealComposer the page mounts) renders inside the grid-rows
// 0fr→1fr container — pure CSS expansion, switched off by the reduced-motion
// media query, so there is nothing here for a JS motion guard to manage.
//
// Purely presentational: every datum comes from `WindowTileVM` (fuelSwimlane.ts),
// every action is a prop. MiniRing/ScoreChip carry over from WindowLane verbatim.
// ============================================================
import type { ReactNode } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { huInt } from '@/shared/lib/huNum'
import type { TileRingVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'

/** The stamp each state wears in the block's top row (prototype `.wstamp`). */
const STAMP: Partial<Record<WindowTileVM['state'], { text: string; cls: string }>> = {
  done: { text: 'KÉSZ ✓', cls: 'fh-st-done' },
  now: { text: 'MOST', cls: 'fh-st-now' },
  missed: { text: 'KIMARADT', cls: 'fh-st-miss' },
}

function MiniRing({ ring }: { ring: TileRingVM }) {
  // The conic sweep fills instead of appearing already full — the WeekScoreRing recipe
  // (`useCountUp` drives `--v`), which is also the reduced-motion guard: the hook jumps
  // straight to the target when the user asked for less motion.
  const swept = useCountUp(ring.pct)
  return (
    <span className="fh-wring">
      <i
        style={{ '--c': ring.color, '--v': swept } as React.CSSProperties}
        data-l={ring.letter}
        role="img"
        aria-label={`${ring.label} ${ring.grams} g, a napi cél ${ring.pct} százaléka`}
      />
      <small>{ring.grams} g</small>
    </span>
  )
}

function ScoreChip({ tile, onScore }: { tile: WindowTileVM; onScore: (mealId: string) => void }) {
  // Fresh log: the AI score has not landed yet — say so, never show a fabricated number
  // and never a red/failing tone (guardrail: honest states, never punitive).
  if (tile.scorePct == null) return <span className="fh-scorech is-pend">✨ folyamatban</span>
  const cls = `fh-scorech${tile.scorePct < 90 ? ' is-mid' : ''}`
  const label = `✨ ${tile.scorePct} p`
  // A breakdown-less meal has no score sheet to open (MealScoreSheet renders null) —
  // it stays inert text rather than a dead tap.
  if (!tile.scorable || tile.mealId == null) return <span className={cls}>{label}</span>
  return (
    <button type="button" className={`${cls} is-tap`} onClick={() => onScore(tile.mealId!)}
      aria-label={`${tile.name} · AI score részletek`}>
      {label}
    </button>
  )
}

export interface WindowBlockProps {
  tile: WindowTileVM
  /** The in-place composer well is expanded (the page mounts it as `children`). */
  open: boolean
  /** Open the composer for this window — `ai` = the ✨ AI ghost CTA (panel armed). */
  onOpen: (ai: boolean) => void
  /** A done block's score chip → MealScoreSheet. */
  onScore: (mealId: string) => void
  children?: ReactNode
}

export function WindowBlock({ tile, open, onOpen, onScore, children }: WindowBlockProps) {
  const stamp = STAMP[tile.state]
  const done = tile.state === 'done'
  return (
    <div className={`flog-blk is-${tile.state}${open ? ' is-open' : ''}`} data-state={tile.state}>
      <div className="flog-in">
        <div className="flog-top">
          <time>{tile.time}</time>
          <span className="flog-lbl">{tile.label}</span>
          {stamp && <span className={`fh-wstamp ${stamp.cls}`}>{stamp.text}</span>}
        </div>
        <div className="flog-main">
          <div className="flog-icon"><ClayIcon name={tile.icon} size={34} /></div>
          <div className="flog-txt">
            <div className={`flog-name${tile.ghost ? ' is-ghost' : ''}`}>{tile.name}</div>
            {/* Meta line, honest: "a tervből" only with a real plan suggestion behind it;
                a missed window says what it can still be, never what was lost; a done
                block's meta slot carries the score chip. */}
            {done
              ? <div className="flog-meta"><ScoreChip tile={tile} onScore={onScore} /></div>
              : tile.state === 'missed'
                ? <div className="flog-meta">még pótolható</div>
                : tile.fromPlan ? <div className="flog-meta">a tervből</div> : null}
          </div>
          {/* Honest kcal: a window the composition carries no kcal for shows no kcal cell
              at all — no "0 kcal", no "—" theatre on a surface that is not a stat cell. */}
          <div className="flog-data">
            {tile.kcal != null && (
              <div className="flog-kcal"><b>{huInt(tile.kcal)}</b><small>kcal</small></div>
            )}
            <div className="flog-rings">
              {tile.rings.map(r => <MiniRing key={r.key} ring={r} />)}
            </div>
          </div>
        </div>
        {!done && (
          <div className="flog-ctas">
            <button
              type="button"
              className={tile.state === 'now' ? 'cta-primary' : 'cta-ghost'}
              onClick={() => onOpen(false)}
              aria-label={`${tile.state === 'missed' ? 'Pótold' : 'Logold'} · ${tile.label}`}
              aria-expanded={open}
            >
              {tile.state === 'missed' ? 'Pótold' : 'Logold'}
            </button>
            <button type="button" className="cta-ghost" onClick={() => onOpen(true)}
              aria-label={`AI naplózás · ${tile.label}`} aria-expanded={open}>
              ✨ AI
            </button>
          </div>
        )}
        <div className="flog-composer">
          <div className="flog-cin">
            {children && <div className="flog-cbody">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
