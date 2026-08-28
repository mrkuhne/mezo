import type { Tool } from '@/shared/ui/ToolChip'
import { ToolChip } from '@/shared/ui/ToolChip'
import { cn } from '@/shared/lib/cn'

export function ToolChipRow({ tools, className }: { tools: Tool[]; className?: string }) {
  return (
    <div className={cn('row gap-sm flex-wrap', className)} style={{ marginBottom: 10 }}>
      {tools.map((t, i) => (
        <ToolChip key={i} {...t} />
      ))}
    </div>
  )
}
