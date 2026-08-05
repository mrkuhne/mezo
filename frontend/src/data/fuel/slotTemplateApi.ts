import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { SlotAnchor, SlotTemplate, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'

type SlotWire = components['schemas']['SlotTemplateSlot']
type ListWire = components['schemas']['SlotTemplateListResponse']
type PutWire = components['schemas']['SlotTemplateRequest']
type EvaluateReqWire = components['schemas']['SlotPlanEvaluateRequest']
type EvaluateResWire = components['schemas']['SlotPlanEvaluateResponse']

/** Mezo's qualitative read on a custom slot split (mezo-7102 Task 12) — the `coachApi.ts`
 *  precedent: the verdict type is declared here, alongside the wire mapping. */
export interface SlotPlanVerdict {
  verdict: 'ok' | 'adjust'
  summary: string
  suggestions: { slotLabel?: string; text: string }[]
}

export interface SlotPlanEvaluateInput {
  dayType: SlotTemplateDayType
  rows: SlotTemplateRow[]
  resolvedTimes: { label: string; time: string }[]
  budget: { kcal: number; p: number; c: number; f: number }
  balanceKcal: number
  blocks: PlannerBlock[]
}

const fromAnchor = (w: SlotWire): SlotAnchor =>
  w.anchorType === 'fixed'
    ? { type: 'fixed', time: w.time ?? '12:00' }
    : { type: w.anchorType as Exclude<SlotAnchor['type'], 'fixed'>, offsetMin: w.offsetMin ?? 0 }

const toWireSlot = (r: SlotTemplateRow): SlotWire => ({
  label: r.label, slotKind: r.slotKind, role: r.role, budgetPct: r.budgetPct,
  anchorType: r.anchor.type,
  time: r.anchor.type === 'fixed' ? r.anchor.time : undefined,
  offsetMin: r.anchor.type === 'fixed' ? undefined : r.anchor.offsetMin,
})

export const slotTemplateApi = {
  list: (): Promise<SlotTemplate[]> =>
    apiFetch<ListWire>('/api/fuel/slot-templates').then(r => r.templates.map(t => ({
      dayType: t.dayType as SlotTemplateDayType,
      slots: t.slots.map(s => ({ label: s.label, slotKind: s.slotKind as SlotTemplateRow['slotKind'], role: s.role as SlotTemplateRow['role'], anchor: fromAnchor(s), budgetPct: s.budgetPct })),
    }))),
  put: (t: SlotTemplate): Promise<void> =>
    apiFetch(`/api/fuel/slot-templates/${t.dayType}`, {
      method: 'PUT',
      body: JSON.stringify({ slots: t.slots.map(toWireSlot) } satisfies PutWire),
    }).then(() => undefined),
  remove: (dayType: SlotTemplateDayType): Promise<void> =>
    apiFetch(`/api/fuel/slot-templates/${dayType}`, { method: 'DELETE' }).then(() => undefined),
  /** Ephemeral — no cache entry, nothing to invalidate; a fresh read of the current draft every
   *  call. 405 (flag off) / 503 (companion off) surface as an `ApiError` the caller degrades on. */
  evaluate: (input: SlotPlanEvaluateInput): Promise<SlotPlanVerdict> =>
    apiFetch<EvaluateResWire>('/api/fuel/slot-templates/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        dayType: input.dayType,
        slots: input.rows.map(toWireSlot),
        resolvedTimes: input.resolvedTimes,
        budget: input.budget,
        balanceKcal: input.balanceKcal,
        blocks: input.blocks.map(b => ({ kind: b.kind, time: b.time, durationMin: b.durationMin })),
      } satisfies EvaluateReqWire),
    }).then(r => ({ verdict: r.verdict, summary: r.summary, suggestions: r.suggestions })),
}
