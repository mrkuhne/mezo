// ============================================================
// Mezo · WindowLane — the Fuel hub's window swimlane (Design 2.0 F3.1, mezo-d20.4.1)
// Source of truth: docs/design_2.0/2026-08-27-fuel-design-iterations.md §1-2 +
// prototype fuel-body.html `.wlane` / `.wtile` (values ×1.18).
//
// One horizontally scroll-snapping tile per user-scheduled eating window, each
// carrying a kcal mini-tile and three mini macro rings (P coral · C amber ·
// F lavender, fill = the meal's share of the DAILY target). States: done (sage
// wash, KÉSZ ✓, meal name, AI-score chip), now (coral ring, MOST stamp, plan meal,
// Logold), missed (dashed amber, "még pótolható", Pótold — never punitive), future
// (plan suggestion, ghost Logold). The lane carries NO header (iterations §2) and
// ends with the out-of-window log tile.
//
// Purely presentational: every datum comes from `WindowLaneVM` (fuelSwimlane.ts),
// every action is a prop. The one behavior it owns is the initial auto-scroll to
// the MOST tile — a scroll position, not an animation, so there is nothing for the
// reduced-motion guard to switch off (`behavior: 'auto'`, never smooth).
// ============================================================
import { useEffect, useRef } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { huInt } from '@/shared/lib/huNum'
import type { TileRingVM, WindowLaneVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'

/** The stamp each state wears in the tile's top row (prototype `.wstamp`). */
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

function MacroBlock({ tile }: { tile: WindowTileVM }) {
  return (
    <>
      {/* Honest kcal: a window the composition carries no kcal for shows no kcal tile at
          all — no "0 kcal", no "—" theatre on a surface that is not a stat cell. */}
      {tile.kcal != null && (
        <div className="fh-wkcal"><b>{huInt(tile.kcal)}</b><small>kcal</small></div>
      )}
      <div className="fh-wrings">
        {tile.rings.map(r => <MiniRing key={r.key} ring={r} />)}
      </div>
    </>
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

export interface WindowLaneProps {
  vm: WindowLaneVM
  /** Log into THAT window's slot (the mezo-bnsf contract: the window IS the slot). */
  onLog: (tile: WindowTileVM) => void
  /** AI-log into that window's slot. */
  onAiLog: (tile: WindowTileVM) => void
  /** Out-of-window log — the lane's trailing tile, slot-less. */
  onFreeLog: () => void
  onFreeAiLog: () => void
  /** A done tile's score chip → MealScoreSheet. */
  onScore: (mealId: string) => void
  /** No eating window scheduled at all today → the lane leads with the üres-nap tile. */
  onPlanDay?: () => void
  emptyDay?: boolean
}

export function WindowLane({
  vm, onLog, onAiLog, onFreeLog, onFreeAiLog, onScore, onPlanDay, emptyDay = false,
}: WindowLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  // Auto-scroll to the MOST tile, once (the prototype's `laneScrolled` latch): re-centering
  // on every re-render would fight the user's own scrolling.
  useEffect(() => {
    const lane = laneRef.current
    if (lane == null || scrolledRef.current || vm.nowKey == null) return
    const now = lane.querySelector<HTMLElement>('[data-now="true"]')
    if (now == null) return
    scrolledRef.current = true
    lane.scrollLeft = Math.max(0, now.offsetLeft - lane.offsetLeft - 40)
  }, [vm.nowKey])

  return (
    <div className="fh-lanewrap">
      <div className="fh-lane" ref={laneRef}>
        {emptyDay && (
          <div className="fh-wtile is-add">
            <div className="fh-wicon"><ClayIcon name="i-fuel" size={36} /></div>
            <div className="fh-wlbl">Üres nap</div>
            <div className="fh-wname is-ghost">Nincs mai terv</div>
            <button type="button" className="fh-wcta is-primary" onClick={onPlanDay}>＋ tervezz</button>
          </div>
        )}

        {vm.tiles.map((t) => {
          const stamp = STAMP[t.state]
          return (
            <div
              key={t.key}
              className={`fh-wtile is-${t.state}`}
              data-now={t.state === 'now' ? 'true' : undefined}
              data-state={t.state}
            >
              <div className="fh-wtop">
                <time>{t.time}</time>
                {stamp && <span className={`fh-wstamp ${stamp.cls}`}>{stamp.text}</span>}
              </div>
              <div className="fh-wicon"><ClayIcon name={t.icon} size={38} /></div>
              <div className="fh-wlbl">{t.label}</div>
              <div className={`fh-wname${t.ghost ? ' is-ghost' : ''}`}>{t.name}</div>
              {/* Meta line, honest: "a tervből" only with a real plan suggestion behind it;
                  a missed window says what it can still be, never what was lost. */}
              {t.state === 'missed'
                ? <div className="fh-wmeta">még pótolható</div>
                : t.fromPlan ? <div className="fh-wmeta">a tervből</div> : null}
              <MacroBlock tile={t} />
              {t.state === 'done'
                ? <div className="fh-wscore"><ScoreChip tile={t} onScore={onScore} /></div>
                : (
                  <>
                    <button
                      type="button"
                      className={`fh-wcta ${t.state === 'now' ? 'is-primary' : 'is-ghost'}`}
                      onClick={() => onLog(t)}
                      aria-label={`${t.state === 'missed' ? 'Pótold' : 'Logold'} · ${t.label}`}
                    >
                      {t.state === 'missed' ? 'Pótold' : 'Logold'}
                    </button>
                    {/* The per-window AI path the retired window-island L1 owned (mezo-53su) —
                        kept as the tile's secondary CTA until the unified log flow (F3.2)
                        absorbs AI as a SOURCE inside one logging surface. */}
                    <button type="button" className="fh-wcta is-ghost" onClick={() => onAiLog(t)}
                      aria-label={`AI naplózás · ${t.label}`}>
                      ✨ AI
                    </button>
                  </>
                )}
            </div>
          )
        })}

        {/* Trailing out-of-window tile — the standing log path (mezo-66te): the window CTAs
            all vanish once every window is done, so the lane must always end with a door. */}
        <div className="fh-wtile is-add">
          <div className="fh-wicon"><ClayIcon name="i-fuel" size={36} /></div>
          <div className="fh-wlbl">Ablakon kívül</div>
          <button type="button" className="fh-wcta is-primary" onClick={onFreeLog}>＋ Logolás</button>
          <button type="button" className="fh-wcta is-ghost" onClick={onFreeAiLog}>✨ AI napló</button>
        </div>
      </div>
    </div>
  )
}
