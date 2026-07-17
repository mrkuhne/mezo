import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'

export type ToolType = 'read' | 'compute' | 'write'
export interface Tool { type: ToolType; name: string; args?: string }

export function ToolChip({ type, name, args, className }: Tool & { className?: string }) {
  return (
    <span className={cn('toolchip', type, className)}>
      <Icon name="tool" size={10} />
      {name}
      {args && <span style={{ opacity: 0.7 }}>({args})</span>}
    </span>
  )
}
