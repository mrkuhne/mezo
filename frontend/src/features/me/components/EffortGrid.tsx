// ============================================================
// Mezo · EffortGrid (mezo-9k99; Folyadék F2 mezo-n4wf5.2) — the four Fogg ability factors as
// three-grade segment rows, the derived difficulty + XP as a level, and the "make it tiny" advice
// on the heaviest factor. One block, two hosts (prototype vilagos/nap.js `effortCard`): the
// wizard's act step and the habit editor's „Mennyibe kerül?" card. The XP is READ here, never
// set — that is the point.
// ============================================================
import {
  EFFORT_ADVICE, EFFORT_FACTORS, effortLevel, effortSum, effortWeakest, effortXp,
  type EffortState,
} from '@/features/me/logic/habitEffort'
import { Level, Note, Seg, Why } from '@/shared/ui/folyadek'

/** The level's fill: the lightest rating still shows a readable band, the heaviest is nearly full. */
const levelPct = (sum: number) => Math.min(100, 30 + sum * 8.5)

export function EffortGrid({ value, onChange, xpOverride }: {
  value: EffortState
  onChange: (next: EffortState) => void
  /** Shown instead of the derived XP while the grid is unrated (a stored value being kept). */
  xpOverride?: number
}) {
  const level = effortLevel(value)
  const weakest = effortWeakest(value)
  return (
    <>
      {EFFORT_FACTORS.map((f) => (
        <div key={f.key} className="rb-eff">
          <div className="rb-eff-h">
            <b>{f.label}</b>
            <small>{f.hint}</small>
          </div>
          <Seg
            aria-label={f.label}
            items={f.opts.map((opt, grade) => ({ key: String(grade), label: opt }))}
            value={value[f.key] == null ? '' : String(value[f.key])}
            onChange={(grade) => onChange({ ...value, [f.key]: Number(grade) as 0 | 1 | 2 })}
          />
        </div>
      ))}
      <div className="rb-effout" data-testid="effort-out">
        <Level pct={levelPct(effortSum(value))} height={22} label={level.label} value={`+${xpOverride ?? effortXp(value)} XP / alkalom`} />
        <Note>{level.sub.charAt(0).toUpperCase() + level.sub.slice(1)}.</Note>
      </div>
      {weakest != null && (
        <div data-testid="effort-tiny">
          <Why icon="t-scissors">{EFFORT_ADVICE[weakest]}</Why>
        </div>
      )}
    </>
  )
}
