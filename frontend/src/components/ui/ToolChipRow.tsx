import type { Tool } from '@/components/ui/ToolChip'
import { ToolChip } from '@/components/ui/ToolChip'

export function ToolChipRow({ tools }: { tools: Tool[] }) {
  return (
    <div className="row gap-sm flex-wrap" style={{ marginBottom: 10 }}>
      {tools.map((t, i) => (
        <ToolChip key={i} {...t} />
      ))}
    </div>
  )
}
