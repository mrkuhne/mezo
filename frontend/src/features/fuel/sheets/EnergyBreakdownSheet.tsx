import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Acts, FoSheetHead, Lab, Lk, Note, Row, Txt } from '@/shared/ui/folyadek'
import { Kv, SplitBar } from '@/features/fuel/components/folyadek'
import { CONFIDENCE_WORD, dec, round10 } from '@/features/fuel/sheets/learnedBaseFormat'
import { Eq3, rich } from '@/features/fuel/sheets/tanulasPieces'

// Shared, presentational explanation of a composed daily-energy number (base + movement ± deficit).
// Opened from the Fuel Mai equation sheet („Részletesen, honnan jön a keret") and the Én settings' Alap-TDEE row; both build
// the `EnergyBreakdown` prop from their own data (no data hooks here). Design: docs/superpowers/specs/2026-07-27-energy-breakdown-explanation-design.md.
// Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js sheet `energy` — one vessel holding the
// parts (`SplitBar`) with the sum under it, then the three sections, each a label, a small equation of tiles (the result on
// the liquid) and its sentence. The section named by `initial` carries the domain colour on its label.

export type EnergySection = 'base' | 'movement' | 'deficit'
export interface EnergyBlock {
  label: string
  kind: 'gym' | 'sport' | 'run'
  min: number
  kcal: number
  /** Actually logged (mezo-tb3s2) vs. still-scheduled and not yet logged. */
  done: boolean
}
/** One summand of the served movement (mezo-32m82): the weekly plan's share of the day, and the
 *  unplanned credit. The parts ARE the total — the `+ … =` row closes on `movement.kcal`. */
export interface EnergyPart {
  key: 'planned' | 'extra'
  label: string
  kcal: number
}
export interface EnergyBreakdown {
  base: {
    kcal: number; bmr: number; neat: number; neatLabel: string; formula: 'KATCH' | 'MSJ'
    /** Learned-base provenance (mezo-zz91i). Absent/`'formula'` → the BMR × NEAT tiles (unchanged). */
    source?: 'formula' | 'learned'
    /** BMR × NEAT, shown next to a learned base. */
    formulaKcal?: number
    /** Learned base uncertainty (±1 SD kcal); null for formula. */
    sdKcal?: number | null
    confidence?: 'low' | 'medium' | 'high' | null
  }
  /** `parts` (Fuel, the served day): the summands that close on `kcal`; `blocks` are then only
   *  informational per-session previews, shown without operators. No `parts` (the Én hub's TDEE):
   *  one weekly-average tile. */
  movement: {
    kcal: number; isWeeklyAvg: boolean; parts?: EnergyPart[]; blocks?: EnergyBlock[]
    /** Today's not-yet-logged planned sessions' estimated kcal (mezo-tb3s2) — display only, absent
     *  on the Én hub's weekly-average path. */
    pending?: number
    /** Section title override for the weekly-average path (no `parts`) — the Én hub's own
     *  `buildTdeeBreakdown` (mezo-tb3s2). Falls back to the generic label below. */
    label?: string
  }
  deficit?: { kcal: number; rateKgPerWk: number; goalLabel: string; rationale?: string }
  target: number
}

const FORMULA_LABEL = { KATCH: 'Katch-McArdle', MSJ: 'Mifflin-St Jeor' } as const

/** Signed, grouped kcal with a real minus sign. */
const signed = (n: number) => (Math.round(n) < 0 ? `−${fmtGrouped(Math.abs(n))}` : `+${fmtGrouped(n)}`)

function Seg({ on, children }: { on: boolean; children: ReactNode }) {
  return <div className={`ft-seg${on ? ' on' : ''}`}>{children}</div>
}

// „Hogy tanultam?” (mezo-3n2so): the learned Alap section ends in ONE row — the learned base's word + σ̂ — to the learning
// page, where the six steps live (with the week-by-week chart and the day switches). Rendered only on the learned path, so
// the formula path (and the Én hub's TDEE) never needs a router.
function LearnedRow({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  const navigate = useNavigate()
  return <Row className="ft-learned" icon="t-lens" title={title} sub={sub} onClick={() => { onClose(); navigate('/fuel/tanulas') }} />
}

export function EnergyBreakdownSheet({ breakdown, initial, onClose }: {
  breakdown: EnergyBreakdown
  initial: EnergySection
  onClose: () => void
}) {
  const M = useM()
  const E = M.fuelTanulas.energy
  const { base, movement, deficit, target } = breakdown
  const kc = fmtGrouped
  const learned = base.source === 'learned'
  const word = base.confidence ? CONFIDENCE_WORD[base.confidence] : null
  const sd = base.sdKcal != null ? String(round10(base.sdKcal)) : null
  const learnedTitle = word && sd ? E.learnedRowFull(word, sd) : word ? E.learnedRowWord(word) : sd ? E.learnedRowSd(sd) : E.learnedRow
  const blocks = movement.blocks ?? []
  const done = blocks.filter(b => b.done)
  const pending = blocks.filter(b => !b.done)

  return (
    <Sheet onClose={onClose} labelledBy="energy-breakdown-title" className="fo-sheet ft-energy">
      {(close) => (
        <>
          <FoSheetHead
            icon="t-ring" titleId="energy-breakdown-title" onClose={close}
            title={E.title(kc(target))}
            sub={movement.isWeeklyAvg ? (deficit ? E.leadWeeklyDeficit : E.leadWeekly) : E.lead}
          />

          {/* The whole number at a glance: one vessel of its parts, and the sum that closes on the target. */}
          <div role="img" aria-label={E.splitAria(kc(base.kcal), kc(movement.kcal), kc(target))}>
            <SplitBar height={30} parts={[
              { label: E.base, pct: Math.max(0, base.kcal), color: 'var(--dom)', value: kc(base.kcal) },
              { label: E.movement, pct: Math.max(0, movement.kcal), color: 'var(--fx-water)', value: `+${kc(movement.kcal)}` },
              ...(deficit ? [{ label: E.deficit, pct: Math.abs(deficit.kcal), color: 'var(--fo-faint)', value: `−${kc(Math.abs(deficit.kcal))}` }] : []),
            ]} />
          </div>
          <div className="ft-sum">
            <span>{kc(base.kcal)} + {kc(movement.kcal)}{deficit && <> − {kc(Math.abs(deficit.kcal))}</>}</span>
            <b>= {kc(target)}</b>
          </div>

          {/* BASE */}
          <Seg on={initial === 'base'}>
            {learned ? (
              <>
                <Lab>{E.secLearned(kc(base.kcal))}</Lab>
                <Eq3
                  terms={base.formulaKcal != null ? [[kc(base.formulaKcal), E.byFormula]] : []} arrow="→"
                  result={[kc(base.kcal), E.learnedBase]}
                />
                <Txt>{rich(base.formulaKcal != null ? E.learnedTextFormula(kc(base.formulaKcal)) : E.learnedText)}</Txt>
                <LearnedRow onClose={onClose} title={learnedTitle} sub={E.learnedRowSub} />
              </>
            ) : (
              <>
                <Lab>{E.secFormula(kc(base.kcal))}</Lab>
                <Eq3
                  terms={[[kc(base.bmr), E.resting(FORMULA_LABEL[base.formula])], [dec(base.neat, 2), E.lifestyle(base.neatLabel || E.lifestyleDefault)]]} op="×"
                  result={[kc(base.kcal), E.base]}
                />
                <Txt>{rich(E.formulaText(FORMULA_LABEL[base.formula]))}</Txt>
              </>
            )}
          </Seg>

          {/* MOVEMENT */}
          <Seg on={initial === 'movement'}>
            {movement.parts ? (
              <>
                <Lab>{E.secMovementToday(signed(movement.kcal))}</Lab>
                <Eq3 terms={movement.parts.map(p => [kc(p.kcal), p.label])} op="+" result={[signed(movement.kcal), E.todayMovement]} />
              </>
            ) : (
              <>
                <Lab>{E.secMovementWeekly(movement.label ?? E.scheduled, signed(movement.kcal))}</Lab>
                <Eq3 terms={[]} result={[signed(movement.kcal), E.weeklyAvg]} />
              </>
            )}
            {movement.parts && done.length > 0 && (
              <div className="ft-info">
                {/* Informational only — the day's sessions are NOT summands of the served total. */}
                <Lab>{E.doneBlocks}</Lab>
                <Kv items={done.map(b => [E.block(b.label, b.min), E.kcal(kc(b.kcal))])} />
              </div>
            )}
            {movement.parts && (movement.pending ?? 0) > 0 && pending.length > 0 && (
              <div className="ft-info pending">
                {/* Not yet logged — previewed separately, still not a summand of `kcal` (mezo-tb3s2).
                    Gated on a not-done block too: the FE's done rule can mark a block done the backend
                    still counts as pending (e.g. a non-meso gym workout) — never a header over nothing. */}
                <Lab>{E.pendingBlocks}</Lab>
                <Kv items={pending.map(b => [E.blockPlanned(b.label, b.min), E.kcal(`+${kc(b.kcal)}`)])} />
              </div>
            )}
            <Note>{movement.parts ? E.movementNote : E.movementNoteWeekly}</Note>
          </Seg>

          {/* DEFICIT — a derivation (goal rate → prescribed daily gap), NOT an exact equation:
              the engine's projected rate tracks the real weight trend, so rate×kcalPerKg need not
              reconcile with the daily balance. Hence "→", and 7700 stays a rough guide in the prose. */}
          {deficit && (
            <Seg on={initial === 'deficit'}>
              <Lab>{E.secDeficit(deficit.goalLabel, signed(deficit.kcal))}</Lab>
              <Eq3
                terms={[[dec(Math.abs(deficit.rateKgPerWk), 2), E.pace]]} arrow="→"
                result={[signed(deficit.kcal), E.dailyDeficit]}
              />
              <Note>
                {deficit.rationale
                  ? deficit.rationale
                  : E.deficitNote(deficit.goalLabel, dec(Math.abs(deficit.rateKgPerWk), 2), kc(Math.abs(deficit.kcal)), kc(7700))}
              </Note>
            </Seg>
          )}

          <Acts><Lk onClick={close}>{M.fuelTanulas.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}
