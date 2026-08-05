import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { SlotAnchor, SlotTemplate, SlotTemplateDayType, SlotTemplateRow } from '@/data/types'

type SlotWire = components['schemas']['SlotTemplateSlot']
type ListWire = components['schemas']['SlotTemplateListResponse']
type PutWire = components['schemas']['SlotTemplateRequest']

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
}
