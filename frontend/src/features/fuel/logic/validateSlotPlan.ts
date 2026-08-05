// Meal-slot templates (mezo-7102) — Tier 1 of the two-tier AI evaluation (design spec §4): a pure,
// deterministic guardrail pass the editor runs live on every keystroke, well before the on-demand
// LLM verdict (Tier 2, `useSlotTemplateEvaluation`). Two input shapes because pct/role/anchor rules
// are cheapest read straight off the raw `rows`, while time-position rules need the already
// resolved (clamped into the eating span, gap-pushed, sorted) `compiled` windows from
// `compileTemplate` — both are inputs so the editor can validate a live, still-uncompiled edit.
// Never throws; only appends issues.

import {
  daySpan,
  EVENING_SHARE_WARN,
  KITCHEN_CLOSE_OFFSET_MIN,
  MAX_TEMPLATE_SLOTS,
  MIN_SLOT_GAP_MIN,
  PRE_WORKOUT_SLOT_WARN_KCAL,
  PRE_WORKOUT_SLOT_WARN_PCT,
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
  ctx: { wake: string; bed: string; dayType: SlotTemplateDayType; budgetKcal: number },
): { errors: SlotPlanIssue[]; warnings: SlotPlanIssue[] } {
  const errors: SlotPlanIssue[] = []
  const warnings: SlotPlanIssue[] = []
  const { wakeMin, bedMin, span } = daySpan(ctx.wake, ctx.bed)

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
  if (compiled.some(w => w.time < wakeMin || w.time > bedMin)) {
    errors.push({ code: 'out_of_span', text: 'Van olyan ablak, ami az ébredés–lefekvés időszakon kívülre esik.' })
  }
  if (ctx.dayType === 'rest' && rows.some(r => r.anchor.type === 'training_start' || r.anchor.type === 'training_end')) {
    errors.push({ code: 'rest_training_anchor', text: 'Pihenőnapon nem lehet edzéshez kötött időzítést használni.' })
  }

  // ── warnings (advisory, never block save) ────────────────────────────────
  const sorted = [...compiled].sort((a, z) => a.time - z.time)
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
  const eveningPct = compiled
    .filter(w => w.time >= lastThirdStart)
    .reduce((sum, w) => sum + (w.budgetPct ?? 0), 0)
  if (eveningPct > EVENING_SHARE_WARN * 100) {
    warnings.push({ code: 'evening_heavy', text: 'A nap utolsó harmadára esik a napi budget nagy része.' })
  }
  const kitchenClose = bedMin - KITCHEN_CLOSE_OFFSET_MIN
  const closedWindow = compiled.find(w => w.time >= kitchenClose)
  if (closedWindow) {
    warnings.push({ code: 'past_kitchen_close', text: `„${closedWindow.label}" a konyhazárás után van.` })
  }

  return { errors, warnings }
}
