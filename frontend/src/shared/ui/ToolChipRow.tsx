import type { Tool } from '@/shared/ui/ToolChip'
import { ToolChip } from '@/shared/ui/ToolChip'

export function ToolChipRow({ tools }: { tools: Tool[] }) {
  return (
    <div className="row gap-sm flex-wrap" style={{ marginBottom: 10 }}>
      {tools.map((t, i) => (
        <ToolChip key={i} {...t} />
      ))}
    </div>
  )
}
