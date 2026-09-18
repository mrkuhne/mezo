import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'

export type ToolType = 'read' | 'compute' | 'write'
/** S9.7 provenance (mezo-rj214.7): `why`/`outcome`/`failed` turn each work-strip row into a
 *  provenance card — the planner's half-sentence reason and the tool's own returned text.
 *  All three optional: absent on legacy rows, and `outcome` also goes missing once the
 *  retention scrub empties it while the ask half survives. */
export interface Tool { type: ToolType; name: string; args?: string; why?: string; outcome?: string; failed?: boolean }

export function ToolChip({ type, name, args, className }: Tool & { className?: string }) {
  return (
    <span className={cn('toolchip', type, className)}>
      <Icon name="tool" size={10} />
      {name}
      {args && <span style={{ opacity: 0.7 }}>({args})</span>}
    </span>
  )
}
