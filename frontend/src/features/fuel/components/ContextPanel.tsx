// ============================================================
// Mezo · ContextPanel (időzítés & kontextus + a generikus sor-dimenziók tényei)
// Folyadék F5 (mezo-n4wf5.5): the label–value rows are the Fuel-shared `Kv` tiles (prototype `kv(rows)` on the `dim` sheet).
// Both halves are SERVER text, stored with the meal in the language it was scored in: rendered as they arrive, never
// translated and never matched on the client.
// ============================================================
import type { ContextDimension, RowsDimension } from '@/data/types'
import { Kv } from '@/features/fuel/components/folyadek'

export function ContextPanel({ dim }: { dim: ContextDimension | RowsDimension }) {
  return <Kv items={dim.context.map(c => [c.label, c.value] as [string, string])} />
}
