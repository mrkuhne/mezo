// Meal-slot templates (mezo-7102) — Tier 1 of the two-tier AI evaluation (design spec §4): a pure,
// deterministic guardrail pass the editor runs live on every keystroke, well before the on-demand
// LLM verdict (Tier 2, `useSlotTemplateEvaluation`). Two input shapes because pct/role/anchor rules
// are cheapest read straight off the raw `rows`, while time-position rules need the already
// resolved (clamped into the eating span, gap-pushed, sorted) `compiled` windows from
// `compileTemplate` — both are inputs so the editor can validate a live, still-uncompiled edit.
// Never throws; only appends issues.
//
// ── Axis convention (mezo-7102 fix wave, finding F1) ────────────────────────────────────────────
// `compiled` windows carry wall-clock minutes mod 1440 (0..1439) — `compileTemplate`'s contract
// (see its header) — even though they were resolved/clamped internally on the UNWRAPPED continuous
// day axis (`daySpan`). Before comparing a compiled time against `wakeMin`/`bedMin`/`kitchenClose`
// (all on that unwrapped axis, so `bedMin` may exceed 1440 on a midnight-crossing day) this module
// re-`unwrapDayMinute`s it, exactly like `dayZones.ts`/`FuelMaiPage.tsx` do for rendering. The two
// modules share this ONE convention — keep both headers in sync if it ever changes.
//
// ── RAW anchors vs clamped windows (finding F2) ─────────────────────────────────────────────────
// `ctx.rawTimes` (optional, `resolveAnchorTimes`'s output — index-aligned with `rows`, already on
// the unwrapped axis, null for a training-anchored row dropped on a blockless day) is the row's
// authored anchor BEFORE clamp/gap-push. When supplied, `out_of_span` and `past_kitchen_close`
// evaluate these raw anchors instead of the clamped `compiled` windows — an anchor placed far
// outside the eating span is a save-blocking error, not something the clamp silently repairs
// (spec §4). `gap`/`evening_heavy` always read the clamped `compiled` windows: they describe the
// FINAL layout the user will actually see, not the raw authored intent.

import {
  daySpan,
  EVENING_SHARE_WARN,
  KITCHEN_CLOSE_OFFSET_MIN,
  MAX_TEMPLATE_SLOTS,
  MIN_SLOT_GAP_MIN,
  PRE_WORKOUT_SLOT_WARN_KCAL,
  PRE_WORKOUT_SLOT_WARN_PCT,
  toHHmm,
  unwrapDayMinute,
} from '@/data/fuel/fuelConfig'
import type { PlannedWindow } from '@/features/fuel/logic/buildDayPlan'
import type { SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

export interface SlotPlanIssue {
  code: string
  text: string
}

export function validateSlotPlan(
  rows: SlotTemplateRow[],
  compiled: PlannedWindow[],
  ctx: {
    wake: string
    bed: string
    dayType: SlotTemplateDayType
    budgetKcal: number
    /** `resolveAnchorTimes`'s output (mezo-7102 fix wave, F2) — see the module header. */
    rawTimes?: (number | null)[]
  },
): { errors: SlotPlanIssue[]; warnings: SlotPlanIssue[] } {
  const errors: SlotPlanIssue[] = []
  const warnings: SlotPlanIssue[] = []
  const { wakeMin, bedMin, span, crossesMidnight } = daySpan(ctx.wake, ctx.bed)

  // Re-unwrap the compiled (wall-clock mod-1440) windows onto the same continuous axis as
  // wakeMin/bedMin — a no-op on a non-crossing day (see module header).
  const unwrapped = compiled.map(w => ({ ...w, time: unwrapDayMinute(toHHmm(w.time), wakeMin, crossesMidnight) }))

  // ── errors (block save) ──────────────────────────────────────────────────
  const sumPct = Math.round(rows.reduce((sum, r) => sum + r.budgetPct, 0) * 100) / 100
  if (Math.abs(sumPct - 100) > 1) {
    errors.push({ code: 'sum_pct', text: `„A budgetek összege ${sumPct}% — 100% kell legyen"` })
  }
  if (rows.length < 2) {
    errors.push({ code: 'too_few', text: 'Legalább 2 étkezési ablak kell a tervhez.' })
  }
  if (rows.length > MAX_TEMPLATE_SLOTS) {
    errors.push({ code: 'too_many', text: `Legfeljebb ${MAX_TEMPLATE_SLOTS} étkezési ablak lehet egy tervben.` })
  }
  const outOfSpan = ctx.rawTimes
    ? ctx.rawTimes.some(t => t != null && (t < wakeMin || t > bedMin))
    : unwrapped.some(w => w.time < wakeMin || w.time > bedMin)
  if (outOfSpan) {
    errors.push({ code: 'out_of_span', text: 'Van olyan ablak, ami az ébredés–lefekvés időszakon kívülre esik.' })
  }
  if (ctx.dayType === 'rest' && rows.some(r => r.anchor.type === 'training_start' || r.anchor.type === 'training_end')) {
    errors.push({ code: 'rest_training_anchor', text: 'Pihenőnapon nem lehet edzéshez kötött időzítést használni.' })
  }

  // ── warnings (advisory, never block save) ────────────────────────────────
  const sorted = [...unwrapped].sort((a, z) => a.time - z.time)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time - sorted[i - 1].time < MIN_SLOT_GAP_MIN) {
      warnings.push({
        code: 'gap',
        text: `„${sorted[i - 1].label}" és „${sorted[i].label}" között ${MIN_SLOT_GAP_MIN} percnél kisebb a rés.`,
      })
    }
  }
  for (const row of rows) {
    if (row.role !== 'pre_workout') continue
    const kcal = (row.budgetPct / 100) * ctx.budgetKcal
    if (row.budgetPct > PRE_WORKOUT_SLOT_WARN_PCT || kcal > PRE_WORKOUT_SLOT_WARN_KCAL) {
      warnings.push({ code: 'pre_workout_big', text: `„${row.label}" edzés előtti ablaka túl nagy.` })
    }
  }
  const lastThirdStart = wakeMin + (span * 2) / 3
  const eveningPct = unwrapped
    .filter(w => w.time >= lastThirdStart)
    .reduce((sum, w) => sum + (w.budgetPct ?? 0), 0)
  if (eveningPct > EVENING_SHARE_WARN * 100) {
    warnings.push({ code: 'evening_heavy', text: 'A nap utolsó harmadára esik a napi budget nagy része.' })
  }
  const kitchenClose = bedMin - KITCHEN_CLOSE_OFFSET_MIN
  if (ctx.rawTimes) {
    const idx = ctx.rawTimes.findIndex(t => t != null && t >= kitchenClose)
    if (idx >= 0) warnings.push({ code: 'past_kitchen_close', text: `„${rows[idx].label}" a konyhazárás után van.` })
  } else {
    const closedWindow = unwrapped.find(w => w.time >= kitchenClose)
    if (closedWindow) warnings.push({ code: 'past_kitchen_close', text: `„${closedWindow.label}" a konyhazárás után van.` })
  }

  return { errors, warnings }
}
